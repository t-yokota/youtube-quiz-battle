import { GameState } from '@/types'
import { YouTubePlayerState } from '@/types/youtubePlayer'
import {
  STALL_WALL_MS,
  STALL_VIDEO_DELTA_SEC,
  YOUTUBE_REWIND_THRESHOLD_SEC,
  READY_PLAY_SUPPRESS_MS,
} from '@/constants/timing'
import type { useGameStore } from '@/stores/gameStore'
import { logger } from '@/utils/logger'
import type { TimeManager } from './timeManager'
import type { InternalPlayerControl } from './internalPlayerControl'
import type { ThresholdEngine } from './thresholdEngine'
import type { AnswerFlowController } from './answerFlowController'

/**
 * External Pause 制御
 * 外部要因による一時停止（visibility/user/stall）の開始・解除、
 * visibility/pagehide/pageshow ハンドラ、プレイヤー状態変化ハンドラ、
 * stall 検出、YouTube rewind 補正を担う。
 */
export class ExternalPauseController {
  private playerControl: InternalPlayerControl
  private gameStore: ReturnType<typeof useGameStore>
  private timeManager: TimeManager
  private thresholdEngine: ThresholdEngine
  private answerFlow: AnswerFlowController

  // External Pause関連
  private externalPaused: boolean = false
  private externalPausedReason: 'visibility' | 'user' | 'stall' | 'orientation' | null = null

  // 再生停滞（stall）の検出用
  private lastWallMs: number = 0
  private lastVideoTime: number = 0

  // YouTube Playerによる巻き戻し関連
  private hasPassedRewindThreshold: boolean = false // 閾値通過フラグ

  // リプレイ直後の spurious PLAYING（seekTo(0) 起因）を無視する期限
  private readyPlaySuppressUntil: number = 0

  // 登録済みイベントリスナーの参照（destroy() で解除するために保持）
  private visibilityChangeHandler: (() => void) | null = null
  private pageHideHandler: (() => void) | null = null
  private pageShowHandler: (() => void) | null = null

  constructor(
    playerControl: InternalPlayerControl,
    gameStore: ReturnType<typeof useGameStore>,
    timeManager: TimeManager,
    thresholdEngine: ThresholdEngine,
    answerFlow: AnswerFlowController,
  ) {
    this.playerControl = playerControl
    this.gameStore = gameStore
    this.timeManager = timeManager
    this.thresholdEngine = thresholdEngine
    this.answerFlow = answerFlow
  }

  /**
   * External Pauseのハンドリングを初期化
   */
  initialize(): void {
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
    return this.externalPaused && this.externalPausedReason !== 'user'
  }

  /**
   * External Pauseを開始
   * @param reason 一時停止の要因
   */
  pauseExternal(reason: 'visibility' | 'user' | 'stall' | 'orientation'): void {
    if (this.externalPaused) return

    // 一時停止開始
    this.externalPaused = true
    this.externalPausedReason = reason

    const currentVideoTime = this.playerControl.getCurrentTime()
    const previousVideoTime = this.timeManager.getPreviousVideoTime()

    logger.log('[ExternalPauseController] External pause started:', reason, {
      current: currentVideoTime,
      previous: previousVideoTime,
    })

    // 動画を停止
    // ANSWERING中は既に動画停止済みなのでpauseVideo()不要、カウントダウンのみ停止
    if (this.gameStore.currentState === GameState.ANSWERING) {
      this.answerFlow.stopAnswerCountdown()
    } else {
      this.playerControl.pauseVideo()
    }
  }

  /**
   * External Pauseを解除
   */
  resumeExternal(): void {
    if (!this.externalPaused) return

    // 一時停止解除
    const prevReason = this.externalPausedReason
    this.externalPaused = false
    this.externalPausedReason = null

    const previousVideoTime = this.timeManager.getPreviousVideoTime()
    const currentVideoTime = this.playerControl.getCurrentTime()

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

    // 動画を再開
    // ANSWERING中は動画再開せず、カウントダウン再開のみ
    if (this.gameStore.currentState === GameState.ANSWERING) {
      this.answerFlow.resumeAnswerCountdown()
    } else {
      this.playerControl.playVideo()
    }
  }

  /**
   * 指定した reason で一時停止中の場合のみ External Pauseを解除
   * （visibility/pagehide/pageshow と同じパターンを orientation にも適用するため）
   * @param reason 解除条件として照合する一時停止の要因
   */
  resumeExternalIfReason(reason: 'visibility' | 'user' | 'stall' | 'orientation'): void {
    if (this.externalPausedReason === reason) {
      this.resumeExternal()
    }
  }

  /**
   * 可視性変化（visibility）イベントハンドラーを設定
   */
  setupVisibilityHandlers(): void {
    this.visibilityChangeHandler = () => {
      if (document.hidden) {
        // タブが非表示になった時：動画が再生中またはANSWERING中にpause
        const playerState = this.playerControl.getPlayerState()
        if (
          playerState === YouTubePlayerState.PLAYING ||
          this.gameStore.currentState === GameState.ANSWERING
        ) {
          this.pauseExternal('visibility')
        }
      } else {
        // タブが表示された時：visibility pauseの場合のみresume
        if (this.externalPausedReason === 'visibility') {
          this.resumeExternal()
        }
      }
    }
    document.addEventListener('visibilitychange', this.visibilityChangeHandler)

    this.pageHideHandler = () => {
      const playerState = this.playerControl.getPlayerState()
      const isAnswering = this.gameStore.currentState === GameState.ANSWERING
      logger.log('[ExternalPauseController] Page hide', {
        playerState,
        isAnswering,
        willPause: playerState === YouTubePlayerState.PLAYING || isAnswering,
      })
      if (playerState === YouTubePlayerState.PLAYING || isAnswering) {
        this.pauseExternal('visibility')
      }
    }
    window.addEventListener('pagehide', this.pageHideHandler)

    this.pageShowHandler = () => {
      logger.log('[ExternalPauseController] Page show', {
        externalPausedReason: this.externalPausedReason,
        willResume: this.externalPausedReason === 'visibility',
      })
      if (this.externalPausedReason === 'visibility') {
        this.resumeExternal()
      }
    }
    window.addEventListener('pageshow', this.pageShowHandler)
  }

  /**
   * プレイヤー状態変化イベントハンドラーを設定
   */
  setupPlayerStateHandlers(): void {
    this.playerControl.onStateChange((state) => {
      // 内部操作による状態変化は除外
      if (this.playerControl.isInternalAction()) return

      // 動画末尾（ENDED）に到達した場合: シーク操作の user pause が残っていると
      // PLAYING が二度と来ず解除不能になるため、External Pause を解除して
      // 時間更新（シーク消費 → FINISHED 判定）を通す。再生はしない
      if (state === YouTubePlayerState.ENDED) {
        if (this.externalPaused) {
          logger.log('[ExternalPauseController] Video ended - clearing external pause')
          this.externalPaused = false
          this.externalPausedReason = null
        }
        return
      }

      // ユーザ操作による状態変化（user）をハンドリング
      // PAUSED状態になった場合
      if (state === YouTubePlayerState.PAUSED) {
        // ANSWERING中の一時停止は内部操作（handleButtonPress由来）の
        // 非同期到達なので無視する
        if (this.gameStore.currentState === GameState.ANSWERING) return
        // READY中は動画停止が正常状態（リプレイ時のpauseVideo()が非同期到達するため）
        if (this.gameStore.currentState === GameState.READY) return
        this.pauseExternal('user')
      }

      // PLAYING状態になった場合
      if (state === YouTubePlayerState.PLAYING) {
        // ANSWERING中にユーザーが再生ボタンを押した場合、即座に停止
        if (this.gameStore.currentState === GameState.ANSWERING) {
          this.playerControl.pauseVideo()
          return
        }

        // READY中にプレイヤーから直接再生された場合はボタンチェックを封じて TALKING へ
        // （再生中にボタンチェックが走ると問題開始と衝突して状態不整合になるため）
        if (!this.externalPaused && this.gameStore.currentState === GameState.READY) {
          // リプレイの seekTo(0) 起因の spurious PLAYING は無視して停止状態を復元する
          if (performance.now() < this.readyPlaySuppressUntil) {
            logger.log('[ExternalPauseController] Suppressed spurious PLAYING after replay')
            this.playerControl.pauseVideo()
            return
          }
          logger.log('[ExternalPauseController] Playback started from player during READY')
          this.gameStore.transitionToState(GameState.TALKING)
          return
        }

        // External Pauseから復帰
        if (this.externalPaused) {
          this.resumeExternal()
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
      wallDelta >= STALL_WALL_MS &&
      videoDelta < STALL_VIDEO_DELTA_SEC
    ) {
      this.pauseExternal('stall')
    }

    // 再生停滞から復帰
    if (
      this.externalPaused &&
      this.externalPausedReason === 'stall' &&
      videoDelta >= STALL_VIDEO_DELTA_SEC
    ) {
      this.resumeExternal()
    }

    // 次回の比較用に記録
    this.lastWallMs = currentWallMs
    this.lastVideoTime = currentVideoTime
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
   * 直後の seekTo(0) が発火させる spurious PLAYING の無視期限もここで設定する
   */
  resetPauseState(): void {
    this.externalPaused = false
    this.externalPausedReason = null
    this.readyPlaySuppressUntil = performance.now() + READY_PLAY_SUPPRESS_MS
  }

  /**
   * 登録済みイベントリスナーを解除（リソースリーク防止）
   *
   * 注意: setupPlayerStateHandlers が登録する onStateChange コールバックは
   * YouTubePlayerManager 側に解除 API がないため、ここでは解除しない。
   * App.vue の onUnmounted で destroy() の直後に playerManager.destroy() を呼び、
   * プレイヤー本体ごと破棄することでコールバックも到達しなくなる。
   */
  destroy(): void {
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
): ExternalPauseController {
  return new ExternalPauseController(
    playerControl,
    gameStore,
    timeManager,
    thresholdEngine,
    answerFlow,
  )
}
