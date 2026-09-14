import { GameState } from '@/types'
import { YouTubePlayerState } from '@/types/youtubePlayer'
import {
  STALL_WALL_MS,
  STALL_VIDEO_DELTA_SEC,
  YOUTUBE_REWIND_THRESHOLD_SEC,
} from '@/constants/timing'
import type { useGameStore } from '@/stores/gameStore'
import { logger } from '@/utils/logger'
import type { TimeManager } from './timeManager'
import type { InternalPlayerControl } from './internalPlayerControl'
import type { ThresholdEngine } from './thresholdEngine'
import type { AnswerFlowController } from './answerFlowController'

export type ExternalPauseReason = 'visibility' | 'user' | 'stall' | 'orientation' | 'settings'
type ExternalResumeTarget = 'video' | 'none'

function isVideoPlaybackState(state: GameState): boolean {
  return (
    state === GameState.TALKING ||
    state === GameState.QUESTIONING ||
    state === GameState.WAITING ||
    state === GameState.REVEALING
  )
}

/**
 * External Pause 制御
 * 外部要因による一時停止（visibility/user/stall/orientation/settings）の開始・解除、
 * visibility/pagehide/pageshow ハンドラ、プレイヤー状態変化ハンドラ、
 * stall 検出、YouTube rewind 補正を担う。
 */
export class ExternalPauseController {
  private playerControl: InternalPlayerControl
  private gameStore: ReturnType<typeof useGameStore>
  private timeManager: TimeManager
  private thresholdEngine: ThresholdEngine

  // External Pause関連
  private pauseReasons = new Set<ExternalPauseReason>()

  private get externalPaused(): boolean {
    return this.pauseReasons.size > 0
  }
  private externalResumeTarget: ExternalResumeTarget = 'none'

  // 再生停滞（stall）の検出用
  private lastWallMs: number = 0
  private lastVideoTime: number = 0

  // YouTube Playerによる巻き戻し関連
  private hasPassedRewindThreshold: boolean = false // 閾値通過フラグ

  // リプレイの先頭シーク完了前に遅れて届く PLAYING を識別するライフサイクルフラグ
  private replayResetPending: boolean = false

  // READY中に唯一許可する、開始ゲートの短いウォームアップ再生
  private gateWarmupActive: boolean = false
  private destroyed = false

  // 登録済みイベントリスナーの参照（destroy() で解除するために保持）
  private visibilityChangeHandler: (() => void) | null = null
  private pageHideHandler: (() => void) | null = null
  private pageShowHandler: (() => void) | null = null

  constructor(
    playerControl: InternalPlayerControl,
    gameStore: ReturnType<typeof useGameStore>,
    timeManager: TimeManager,
    thresholdEngine: ThresholdEngine,
    _answerFlow: AnswerFlowController,
    private readonly acceptVideoEnd: () => boolean = () => true,
  ) {
    this.playerControl = playerControl
    this.gameStore = gameStore
    this.timeManager = timeManager
    this.thresholdEngine = thresholdEngine
    this.playerControl.setPlaybackGuard(() => {
      if (this.destroyed) return false
      if (!this.externalPaused) return true
      // 解答期限後などの再生要求は、停止理由がすべて解除されるまで保留する。
      this.externalResumeTarget = 'video'
      return false
    })
  }

  /**
   * External Pauseのハンドリングを初期化
   */
  initialize(): void {
    if (this.destroyed) return
    this.setupVisibilityHandlers()
    this.setupPlayerStateHandlers()
    this.lastWallMs = performance.now()
    this.lastVideoTime = this.playerControl.getCurrentTime()
  }

  /**
   * External Pause状態を取得
   */
  isExternalPaused(): boolean {
    return this.externalPaused
  }

  /**
   * 時間更新（updateVideoTime）をスキップすべきか。
   * user 一時停止中はスキップしない: 停止中のシークバー操作（特に末尾へのシーク）を
   * 検出するため。動画時間は凍結しているので通常の窓走査は無害で、
   * シークのジャンプだけが検出される。visibility 等は YouTube 巻き戻り補正のためスキップを維持
   */
  shouldSkipTimeUpdate(): boolean {
    return [...this.pauseReasons].some((reason) => reason !== 'user')
  }

  /**
   * External Pauseを開始
   * @param reason 一時停止の要因
   */
  pauseExternal(reason: ExternalPauseReason): void {
    if (this.destroyed) return
    if (this.pauseReasons.has(reason)) return
    if (!this.externalPaused) {
      this.externalResumeTarget =
        reason !== 'user' &&
        isVideoPlaybackState(this.gameStore.currentState) &&
        (this.playerControl.isPlaybackStateExpected(YouTubePlayerState.PLAYING) ||
          this.playerControl.getPlayerState() === YouTubePlayerState.PLAYING ||
          this.playerControl.getPlayerState() === YouTubePlayerState.BUFFERING)
          ? 'video'
          : 'none'
    }
    // 能動的な停止が重なったら、停滞待ちはその停止に引き継ぐ。
    this.pauseReasons = new Set(
      [...this.pauseReasons].filter((r) => reason === 'stall' || r !== 'stall'),
    )
    this.pauseReasons.add(reason)
    if (
      reason !== 'user' &&
      reason !== 'stall' &&
      this.gameStore.currentState !== GameState.ANSWERING
    )
      this.playerControl.pauseVideo()
  }

  /**
   * External Pauseを解除
   */
  resumeExternal(reason?: ExternalPauseReason): void {
    if (this.destroyed) return
    if (!this.externalPaused) return

    // 一時停止解除
    const prevReason = reason ?? [...this.pauseReasons].join(',')
    this.pauseReasons = reason
      ? new Set([...this.pauseReasons].filter((r) => r !== reason))
      : new Set()
    if (this.externalPaused) return
    const resumeTarget = this.externalResumeTarget
    this.externalResumeTarget = 'none'

    const previousVideoTime = this.timeManager.getPreviousVideoTime()
    const currentVideoTime = this.playerControl.getCurrentTime()
    this.lastWallMs = performance.now()
    this.lastVideoTime = currentVideoTime

    // YouTube Playerの巻き戻し仕様への対応
    // - 5秒未満の位置から動画の再生を開始し、5秒を超える前に一度タブを移動・戻って動画を再開すると、タブ移動前の再生開始位置まで動画が巻き戻る
    // - 冒頭0秒からの再生開始時/5秒未満の位置にシークバーで移動したあとの再生開始時に、上記現象の発生条件を満たす
    // - タブに戻って動画の再開をする前にシークバーを操作すると、タブ移動前の再生開始位置ではなくシークバー操作後の位置から動画が再生される
    if (
      previousVideoTime < YOUTUBE_REWIND_THRESHOLD_SEC &&
      currentVideoTime < YOUTUBE_REWIND_THRESHOLD_SEC &&
      currentVideoTime < previousVideoTime
    ) {
      // 冒頭5秒以内の範囲でシステムによる動画の巻き戻りが発生した場合

      // 巻き戻り閾値を一度通過済みかをチェック
      // - 通過していない：冒頭からの再生開始直後
      // - 通過している　：シークバーで閾値以降から冒頭に戻ってきて動画を再開中
      if (!this.hasPassedRewindThreshold) {
        // 冒頭からの再生開始直後の場合：問題を最初からやり直せるようにconsumedフラグをリセット
        logger.log(
          '[ExternalPauseController] System rewind detected immediately after starting playback',
        )
        this.thresholdEngine.resetUnansweredConsumed()
      }

      // シーク検知の回避のためにpreviousVideoTimeを更新
      this.timeManager.updatePreviousVideoTime(currentVideoTime)
      logger.log(
        '[ExternalPauseController] Updated previousVideoTime to avoid seek detection caused by system rewind:',
        {
          previous: this.timeManager.getPreviousVideoTime(),
        },
      )
    }

    logger.log('[ExternalPauseController] External pause ended:', prevReason, {
      current: currentVideoTime,
      previous: this.timeManager.getPreviousVideoTime(),
    })

    // 解答中は期限が動き続けるため、復帰時にタイマーを作り直さない。
    if (
      resumeTarget === 'video' &&
      !this.gameStore.isAnswerPending &&
      isVideoPlaybackState(this.gameStore.currentState)
    ) {
      this.playerControl.playVideo()
    }
  }

  /**
   * 横画面検出時の External Pause（orientation 用）
   * visibility と同じく、動画再生状態の PLAYING または ANSWERING のときだけ
   * External Pauseにする。READY等に残留したPLAYINGは停止だけ行い、復帰対象にしない。
   */
  pauseExternalForOrientation(): void {
    const playerState = this.playerControl.getPlayerState()
    const currentState = this.gameStore.currentState
    if (
      this.externalPaused ||
      currentState === GameState.ANSWERING ||
      (isVideoPlaybackState(currentState) &&
        (playerState === YouTubePlayerState.PLAYING ||
          playerState === YouTubePlayerState.BUFFERING))
    ) {
      this.pauseExternal('orientation')
    } else if (!isVideoPlaybackState(currentState) && playerState === YouTubePlayerState.PLAYING) {
      this.playerControl.pauseVideo()
    }
  }

  /**
   * 指定した reason で一時停止中の場合のみ External Pauseを解除
   * （visibility/pagehide/pageshow と同じパターンを orientation にも適用するため）
   * @param reason 解除条件として照合する一時停止の要因
   */
  resumeExternalIfReason(reason: ExternalPauseReason): void {
    if (this.pauseReasons.has(reason)) {
      this.resumeExternal(reason)
    }
  }

  /**
   * 可視性変化（visibility）イベントハンドラーを設定
   */
  setupVisibilityHandlers(): void {
    if (this.destroyed || this.visibilityChangeHandler) return
    this.visibilityChangeHandler = () => {
      if (document.hidden) {
        this.pauseForVisibility()
      } else {
        this.resumeFromVisibility()
      }
    }
    document.addEventListener('visibilitychange', this.visibilityChangeHandler)

    this.pageHideHandler = () => {
      const playerState = this.playerControl.getPlayerState()
      const currentState = this.gameStore.currentState
      logger.log('[ExternalPauseController] Page hide', {
        playerState,
        currentState,
      })
      this.pauseForVisibility()
    }
    window.addEventListener('pagehide', this.pageHideHandler)

    this.pageShowHandler = () => {
      logger.log('[ExternalPauseController] Page show', {
        pauseReasons: [...this.pauseReasons],
        willResume: this.pauseReasons.has('visibility'),
      })
      this.resumeFromVisibility()
    }
    window.addEventListener('pageshow', this.pageShowHandler)
  }

  private pauseForVisibility(): void {
    const currentState = this.gameStore.currentState
    const playerState = this.playerControl.getPlayerState()

    if (this.externalPaused || currentState === GameState.ANSWERING) {
      this.pauseExternal('visibility')
      return
    }

    if (
      isVideoPlaybackState(currentState) &&
      (playerState === YouTubePlayerState.PLAYING || playerState === YouTubePlayerState.BUFFERING)
    ) {
      this.pauseExternal('visibility')
      return
    }

    // READY / LOADING / FINISHED は停止が正。Player側に遅れたPLAYINGが残っていても
    // External Pauseにはせず停止だけを確定し、復帰時の自動再生対象にしない。
    if (!isVideoPlaybackState(currentState) && playerState === YouTubePlayerState.PLAYING) {
      logger.log(
        '[ExternalPauseController] Suppressed playback while page is hidden:',
        currentState,
      )
      this.playerControl.pauseVideo()
    }
  }

  private resumeFromVisibility(): void {
    if (this.pauseReasons.has('visibility')) {
      this.resumeExternal('visibility')
    }
  }

  /**
   * プレイヤー状態変化イベントハンドラーを設定
   */
  setupPlayerStateHandlers(): void {
    if (this.destroyed) return
    this.playerControl.syncPlaybackIntentFromPlayer()
    this.playerControl.onStateChange((state) => {
      if (this.destroyed) return
      // 動画末尾（ENDED）に到達した場合: External Pause を解除し、
      // 未消費の残り問題をすべて確定させて FINISHED まで進める
      // 終了確定の前に、ゲーム側で禁止シーク・遅延通知を判定する。
      if (state === YouTubePlayerState.ENDED) {
        if (!this.acceptVideoEnd()) return
        if (this.externalPaused) {
          logger.log('[ExternalPauseController] Video ended - clearing external pause')
          this.pauseReasons = new Set()
          this.externalResumeTarget = 'none'
        }
        if (this.gameStore.currentState !== GameState.FINISHED) {
          logger.log('[ExternalPauseController] Video ended - finalizing remaining questions')
          this.thresholdEngine.finalizeAtVideoEnd()
        }
        return
      }

      // ユーザ操作による状態変化（user）をハンドリング
      // PAUSED状態になった場合
      if (state === YouTubePlayerState.PAUSED) {
        // 最後のアプリ内pauseVideo()に対応する非同期通知は状態変化として扱わない
        if (this.playerControl.isPlaybackStateExpected(state)) return
        this.playerControl.acceptExternalPlaybackState(YouTubePlayerState.PAUSED)
        // ANSWERING中の一時停止は内部操作（handleButtonPress由来）の
        // 非同期到達なので無視する
        if (this.gameStore.currentState === GameState.ANSWERING) return
        // READY中は動画停止が正常状態（リプレイ時のpauseVideo()が非同期到達するため）
        if (this.gameStore.currentState === GameState.READY) return
        this.pauseExternal('user')
      }

      // PLAYING状態になった場合
      if (state === YouTubePlayerState.PLAYING) {
        const isExpectedPlayback = this.playerControl.isPlaybackStateExpected(state)

        // 演出待ち・解答中の再生要求は即座に停止する。
        if (this.gameStore.isAnswerPending || this.gameStore.currentState === GameState.ANSWERING) {
          this.playerControl.pauseVideo()
          return
        }

        // READYでは開始ゲートのウォームアップだけを許可する。正規のゲーム開始処理は
        // 先にTALKINGへ遷移してからplayVideo()するため、それ以外の非再生状態では停止を維持する。
        if (!isVideoPlaybackState(this.gameStore.currentState)) {
          if (
            this.gameStore.currentState === GameState.READY &&
            this.gateWarmupActive &&
            isExpectedPlayback
          ) {
            return
          }
          if (this.replayResetPending) {
            logger.log('[ExternalPauseController] Suppressed spurious PLAYING after replay')
          } else {
            logger.log(
              '[ExternalPauseController] Suppressed unexpected PLAYING in state:',
              this.gameStore.currentState,
            )
          }
          this.playerControl.pauseVideo()
          return
        }

        if (this.pauseReasons.has('stall')) {
          this.resumeExternal('stall')
          return
        }

        // 最後のアプリ内playVideo()に対応する非同期通知は状態変化として扱わない
        if (isExpectedPlayback) return

        this.playerControl.acceptExternalPlaybackState(YouTubePlayerState.PLAYING)

        // Player UIでユーザー一時停止から再開した場合は、既に再生が始まっているため
        // External Pause状態だけを解除し、playVideo()は重ねて呼ばない。
        if (this.pauseReasons.size === 1 && this.pauseReasons.has('user')) {
          this.resumeExternal('user')
        } else if (this.externalPaused) {
          // visibility / orientation / stall 中にPlayerが独自に再生した場合は、対応する
          // ライフサイクル復帰処理まで停止を維持する。
          this.playerControl.pauseVideo()
        }
      }
    })
  }

  /**
   * 再生停滞（stall）を検出
   * @param currentWallMs 現在の壁時計時間（ミリ秒）
   * @param currentVideoTime 現在の動画時間（秒）
   */
  checkStall(currentWallMs: number, currentVideoTime: number): void {
    if (this.destroyed) return
    const wallDelta = currentWallMs - this.lastWallMs
    const videoDelta = currentVideoTime - this.lastVideoTime

    // プレイヤー状態を確認
    const playerState = this.playerControl.getPlayerState()
    const playbackIntended =
      playerState === YouTubePlayerState.PLAYING || playerState === YouTubePlayerState.BUFFERING

    // 再生停滞検出
    if (
      !this.externalPaused &&
      playbackIntended &&
      isVideoPlaybackState(this.gameStore.currentState) &&
      wallDelta >= STALL_WALL_MS &&
      videoDelta < STALL_VIDEO_DELTA_SEC
    ) {
      this.pauseExternal('stall')
    }

    // 再生停滞から復帰
    if (
      this.externalPaused &&
      this.pauseReasons.has('stall') &&
      videoDelta >= STALL_VIDEO_DELTA_SEC
    ) {
      this.resumeExternal('stall')
    }

    // 毎tickではなく、最後に進行を確認した時刻から停滞時間を積算する。
    if (
      !playbackIntended ||
      !isVideoPlaybackState(this.gameStore.currentState) ||
      (this.externalPaused && !this.pauseReasons.has('stall')) ||
      Math.abs(videoDelta) >= STALL_VIDEO_DELTA_SEC ||
      currentWallMs < this.lastWallMs
    ) {
      this.lastWallMs = currentWallMs
      this.lastVideoTime = currentVideoTime
    }
  }

  /**
   * YouTube Player巻き戻り閾値の通過チェック（updateVideoTime から毎フレーム呼ばれる）
   * @param current 現在の動画時間（秒）
   */
  updateRewindThreshold(current: number): void {
    if (!this.hasPassedRewindThreshold && current >= YOUTUBE_REWIND_THRESHOLD_SEC) {
      this.hasPassedRewindThreshold = true
      logger.log(
        '[ExternalPauseController] Passed YouTube rewind threshold:',
        YOUTUBE_REWIND_THRESHOLD_SEC,
      )
    }
  }

  /**
   * resetGame 用: YouTube Player巻き戻しフラグをリセット
   */
  resetRewindThreshold(): void {
    this.hasPassedRewindThreshold = false
  }

  /**
   * handleReplay 用: External Pause状態をクリア
   * 直後の seekTo(0) が発火させる spurious PLAYING の抑止状態も開始する
   */
  resetPauseState(): void {
    this.pauseReasons = new Set()
    this.externalResumeTarget = 'none'
    this.gateWarmupActive = false
    this.replayResetPending = true
    this.lastWallMs = performance.now()
    this.lastVideoTime = this.playerControl.getCurrentTime()
  }

  /**
   * READY からの正常な開始操作が完了したため、リプレイの抑止状態を解除する
   */
  completeReplayReset(): void {
    this.replayResetPending = false
  }

  /** READY中の開始ゲートウォームアップ再生を許可する。 */
  beginGateWarmup(): void {
    this.gateWarmupActive = true
  }

  /** 開始ゲートウォームアップの再生許可を終了する。 */
  endGateWarmup(): void {
    this.gateWarmupActive = false
  }

  /**
   * 登録済みイベントリスナーを解除（リソースリーク防止）
   *
   * Playerの遅延通知もdestroyedガードで失効させる。
   */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler)
      this.visibilityChangeHandler = null
    }
    if (this.pageHideHandler) {
      window.removeEventListener('pagehide', this.pageHideHandler)
      this.pageHideHandler = null
    }
    if (this.pageShowHandler) {
      window.removeEventListener('pageshow', this.pageShowHandler)
      this.pageShowHandler = null
    }
  }
}

export function createExternalPauseController(
  playerControl: InternalPlayerControl,
  gameStore: ReturnType<typeof useGameStore>,
  timeManager: TimeManager,
  thresholdEngine: ThresholdEngine,
  answerFlow: AnswerFlowController,
  acceptVideoEnd?: () => boolean,
): ExternalPauseController {
  return new ExternalPauseController(
    playerControl,
    gameStore,
    timeManager,
    thresholdEngine,
    answerFlow,
    acceptVideoEnd,
  )
}
