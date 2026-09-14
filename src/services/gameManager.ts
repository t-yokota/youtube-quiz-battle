// ゲーム管理サービス（ファサード）
import { isIOS } from '@/utils/isIOS'
import type { QuizData, YouTubePlayerManager } from '@/types'
import { GameState, ButtonState, YouTubePlayerState } from '@/types'
import { createTimeManager, TimeManager } from './timeManager'
import {
  BUTTON_PUSHED_DURATION_MS,
  ANSWER_START_DELAY_MS,
  BUTTON_CHECK_RELEASE_MS,
  VIDEO_START_DELAY_MS,
  GATE_WARMUP_PLAY_MS,
  SEEK_TOLERANCE_SEC,
  INTERNAL_SEEK_TIMEOUT_MS,
  END_SEEK_RETRY_MS,
} from '@/constants/timing'
import type { useGameStore } from '@/stores/gameStore'
import type { useSettingsStore } from '@/stores/settingsStore'
import { logger } from '@/utils/logger'
import { createInternalPlayerControl, InternalPlayerControl } from './internalPlayerControl'
import { createThresholdEngine, ThresholdEngine } from './thresholdEngine'
import { createAnswerFlowController, AnswerFlowController } from './answerFlowController'
import {
  createExternalPauseController,
  ExternalPauseController,
  type ExternalPauseReason,
} from './externalPauseController'
import type { AudioManager } from './audioManager'
import { SOUND_TYPE } from '@/constants/audio'

/**
 * ゲーム管理システム（ファサード）
 * 公開 API を維持しつつ、閾値走査（ThresholdEngine）・解答フロー（AnswerFlowController）・
 * External Pause（ExternalPauseController）へ処理を委譲する
 */
export class GameManager {
  private timeManager: TimeManager
  private playerControl: InternalPlayerControl
  private thresholdEngine: ThresholdEngine
  private answerFlow: AnswerFlowController
  private externalPause: ExternalPauseController
  private gameStore: ReturnType<typeof useGameStore>
  private quizData: QuizData
  private audioManager?: AudioManager
  private settingsStore?: ReturnType<typeof useSettingsStore>

  // ゲートのウォームアップ停止タイマー（ボタン押下と競合しないよう管理する）
  private warmupStopTimer: number | null = null
  private buttonTimers = new Set<number>()
  private endRecovery: {
    target: number
    resume: boolean
    retryAt: number
    deadline: number
  } | null = null
  private destroyed = false

  private scheduleButtonStep(callback: () => void, delay: number): void {
    const expectedState = this.gameStore.currentState
    const questionIndex = this.gameStore.currentQuestionIndex
    const timer = window.setTimeout(() => {
      this.buttonTimers.delete(timer)
      if (
        this.destroyed ||
        this.gameStore.currentState !== expectedState ||
        this.gameStore.currentQuestionIndex !== questionIndex
      )
        return
      callback()
    }, delay)
    this.buttonTimers.add(timer)
  }

  private cancelPendingTimers(): void {
    this.endRecovery = null
    for (const timer of this.buttonTimers) window.clearTimeout(timer)
    this.buttonTimers.clear()
    this.clearWarmupStop(false)
    this.answerFlow.stopAnswerCountdown()
    this.timeManager.cancelInternalSeek()
    this.audioManager?.stopSound()
  }

  constructor(
    playerManager: YouTubePlayerManager,
    quizData: QuizData,
    gameStore: ReturnType<typeof useGameStore>,
    audioManager?: AudioManager,
    settingsStore?: ReturnType<typeof useSettingsStore>,
  ) {
    this.quizData = quizData
    this.gameStore = gameStore
    this.audioManager = audioManager
    this.settingsStore = settingsStore
    this.timeManager = createTimeManager()
    this.playerControl = createInternalPlayerControl(playerManager)
    this.thresholdEngine = createThresholdEngine(quizData, gameStore)
    this.answerFlow = createAnswerFlowController(
      this.playerControl,
      quizData,
      gameStore,
      this.timeManager,
      this.thresholdEngine,
      audioManager,
    )
    this.externalPause = createExternalPauseController(
      this.playerControl,
      gameStore,
      this.timeManager,
      this.thresholdEngine,
      this.answerFlow,
      () => this.acceptVideoEnd(),
    )
  }

  /**
   * ゲームをリセットして最初から開始できるようにする
   * 「もう一度プレイ」ボタン押下時に呼び出される
   */
  resetGame(): void {
    if (this.destroyed) return
    this.cancelPendingTimers()
    this.externalPause.resetPauseState()
    // カウントダウンタイマーを停止
    this.answerFlow.stopAnswerCountdown()

    // YouTube Player巻き戻しフラグをリセット
    this.externalPause.resetRewindThreshold()

    // 問題の消費フラグをリセット
    this.thresholdEngine.resetAll()

    // ゲームストアの状態をリセット
    this.gameStore.resetGame()

    // 時間管理システムの時間変数をリセット（currentVideoTime, previousVideoTimeを0に）
    this.timeManager.resetTimeValues()

    logger.log('[GameManager] Game reset')
  }

  /**
   * もう一度プレイ
   * FINISHED状態からゲームリセット → 動画を0秒にシーク → READY状態へ遷移
   */
  handleReplay(): void {
    if (this.destroyed) return
    if (this.gameStore.currentState !== GameState.FINISHED) return

    logger.log('[GameManager] Replay requested')

    // External Pause状態もクリア
    this.externalPause.resetPauseState()

    // ゲームリセット
    this.resetGame()

    // 動画を0秒にシークして一時停止（再生は READY からのボタンチェックで開始する）
    this.playerControl.seekTo(0)
    this.playerControl.pauseVideo()

    // READY状態へ遷移
    this.gameStore.transitionToState(GameState.READY)
  }

  /**
   * 解答送信処理（App.vueから呼び出される）
   */
  handleAnswerSubmit(answer: string): void {
    if (this.destroyed) return
    this.answerFlow.handleAnswerSubmit(answer)
  }

  /**
   * 開始ゲートのタップ内から呼ぶ動画ウォームアップ:
   * 一瞬（GATE_WARMUP_PLAY_MS）実再生してから停止し先頭へ戻す。
   * iOS にユーザー操作由来の再生実績を作り、ボタンチェック後の遅延 playVideo を
   * 許可させる。ウォームアップ中の PLAYING は無視され TALKING へは遷移しない
   */
  warmupVideoPlayback(): void {
    if (this.destroyed) return
    this.clearWarmupStop(false)
    this.externalPause.beginGateWarmup()
    this.playerControl.playVideo()
    this.warmupStopTimer = window.setTimeout(() => {
      this.warmupStopTimer = null
      this.stopWarmupNow()
    }, GATE_WARMUP_PLAY_MS)
  }

  /**
   * ウォームアップ再生を停止して先頭へ戻す（READY のままゲーム開始を待つ）
   */
  private stopWarmupNow(): void {
    this.externalPause.endGateWarmup()
    this.playerControl.pauseVideo()
    this.playerControl.seekTo(0)
    this.timeManager.resetTimeValues()
  }

  /**
   * 保留中のウォームアップ停止タイマーを解除する
   * @param stopNow true なら停止処理をその場で実行（check ON の押下時）、
   *                false ならタイマーだけ破棄して再生を続行（check OFF の押下時）
   */
  private clearWarmupStop(stopNow: boolean): void {
    if (this.warmupStopTimer === null) return
    window.clearTimeout(this.warmupStopTimer)
    this.warmupStopTimer = null
    if (stopNow) {
      this.stopWarmupNow()
    } else {
      this.externalPause.endGateWarmup()
    }
  }

  /**
   * ボタン押下処理
   * QuizButton の press イベントから App 経由で呼び出される
   * ボタン状態遷移・ゲーム状態遷移・動画制御を統合的に処理する
   */
  handleButtonPress(): void {
    if (this.destroyed || !this.gameStore.isButtonEnabled) return

    logger.log(`[GameManager] Button pressed in state: ${this.gameStore.currentState}`)

    const stateAtPress = this.gameStore.currentState
    const answerStartDelay = isIOS() ? BUTTON_PUSHED_DURATION_MS : ANSWER_START_DELAY_MS

    // ボタンチェック演出 OFF: READY では単なる動画再生ボタンとして動作する（Task 19-4）
    // 演出（PUSHED→RELEASED→STANDBY）・効果音なしで即 TALKING へ遷移し再生開始
    if (stateAtPress === GameState.READY && !this.gameStore.isButtonCheckEnabled) {
      // ウォームアップ停止タイマーが残っていると直後の再生が巻き込まれて止まるため破棄。
      // 再生位置だけ先頭に揃えて続行する
      this.clearWarmupStop(false)
      this.playerControl.seekTo(0)
      this.timeManager.resetTimeValues()
      this.externalPause.completeReplayReset()
      this.gameStore.transitionToState(GameState.TALKING)
      this.playerControl.playVideo()
      return
    }

    // ボタンチェック開始時: ウォームアップがまだ再生中なら即時停止に前倒し
    // （チェック中は動画停止が正。タイマーに任せると押下音と停止が競合する）
    if (stateAtPress === GameState.READY) {
      this.clearWarmupStop(true)
    }

    // 早押し: 動画停止と押下音はタップの同期処理内で行う
    // （iOS では動画再生中に音を鳴らすと音声セッションに奪われて頭が切れるため、
    //   旧版と同じく「先に動画を止めてから鳴らす」順序にする）
    if (stateAtPress === GameState.QUESTIONING) {
      this.playerControl.pauseVideo()

      // 押下タイミングを記録（Analytics用。問題開始からの経過秒を小数1桁に丸める）
      const question = this.gameStore.currentQuestionData
      if (question) {
        const timeUntilPress =
          Math.round(Math.max(0, this.playerControl.getCurrentTime() - question.startTime) * 10) /
          10
        this.gameStore.recordButtonPress(timeUntilPress)
      }
    }

    // ボタン押下音（QUESTIONING は直前で動画停止済み）
    this.audioManager?.playSound(SOUND_TYPE.BUTTON)

    // ボタン状態遷移: STANDBY -> PUSHED -> RELEASED
    this.gameStore.setButtonState(ButtonState.PUSHED)
    this.scheduleButtonStep(() => {
      this.gameStore.setButtonState(ButtonState.RELEASED)

      if (stateAtPress === GameState.READY) {
        // ボタンチェック: BUTTON_CHECK_RELEASE_MS後にTALKING状態へ遷移し、動画再生開始
        this.scheduleButtonStep(() => {
          this.gameStore.setButtonState(ButtonState.STANDBY)
          // ボタンチェック完了時の正解音（STANDBY復帰時）
          this.audioManager?.playSound(SOUND_TYPE.CORRECT)
          this.externalPause.completeReplayReset()
          this.gameStore.transitionToState(GameState.TALKING)
          // 動画再生開始は少し遅らせ、正解音と動画音声の重なりを避ける
          this.scheduleButtonStep(() => {
            // 外部停止中の再生要求は制御層で保留し、最後の停止解除後に開始する。
            if (this.gameStore.currentState !== GameState.TALKING) return
            this.playerControl.playVideo()
          }, VIDEO_START_DELAY_MS)
        }, BUTTON_CHECK_RELEASE_MS)
      } else if (stateAtPress === GameState.QUESTIONING) {
        // 点灯を先に表示し、押下からの待ち時間が終わってから解答を開始する。
        this.scheduleButtonStep(
          () => {
            // 早押し: ANSWERING状態へ遷移（動画は押下の同期処理で停止済み）
            // リトライ時は前回の不正解表示と入力内容をクリアしてから解答アクションに入る（Task 21-3）
            this.gameStore.clearAnswerResult()
            this.gameStore.updateAnswerInput('')
            this.gameStore.transitionToState(GameState.ANSWERING)
            // カウントダウンタイマー開始
            this.answerFlow.startAnswerCountdown()
          },
          Math.max(0, answerStartDelay - BUTTON_PUSHED_DURATION_MS),
        )
      }
    }, BUTTON_PUSHED_DURATION_MS)
  }

  /**
   * External Pause状態を取得
   */
  isExternalPaused(): boolean {
    return this.externalPause.isExternalPaused()
  }

  /**
   * External Pauseを開始
   * @param reason 一時停止の要因
   */
  pauseExternal(reason: ExternalPauseReason): void {
    this.externalPause.pauseExternal(reason)
  }

  /**
   * 横画面検出時の External Pause（再生中 or ANSWERING のときのみ停止する）
   */
  pauseExternalForOrientation(): void {
    this.externalPause.pauseExternalForOrientation()
  }

  /**
   * External Pauseを解除
   */
  resumeExternal(): void {
    this.externalPause.resumeExternal()
  }

  /**
   * 指定した reason で一時停止中の場合のみ External Pauseを解除
   * @param reason 解除条件として照合する一時停止の要因
   */
  resumeExternalIfReason(reason: ExternalPauseReason): void {
    this.externalPause.resumeExternalIfReason(reason)
  }

  /**
   * 可視性変化（visibility）イベントハンドラーを設定
   */
  setupVisibilityHandlers(): void {
    this.externalPause.setupVisibilityHandlers()
  }

  /**
   * プレイヤー状態変化イベントハンドラーを設定
   */
  setupPlayerStateHandlers(): void {
    this.externalPause.setupPlayerStateHandlers()
  }

  /**
   * 再生停滞（stall）を検出
   * @param currentWallMs 現在の壁時計時間（ミリ秒）
   * @param currentVideoTime 現在の動画時間（秒）
   */
  checkStall(currentWallMs: number, currentVideoTime: number): void {
    this.externalPause.checkStall(currentWallMs, currentVideoTime)
  }

  /**
   * External Pauseのハンドリングを初期化
   */
  initializeExternalPauseHandling(): void {
    this.externalPause.initialize()
  }

  /** 終了イベントにも通常のシーク禁止を適用し、残問確定より先に戻す。 */
  private acceptVideoEnd(): boolean {
    const state = this.gameStore.currentState
    if (state === GameState.READY || state === GameState.LOADING || state === GameState.FINISHED)
      return false
    if (this.endRecovery) return false
    const target = this.timeManager.getInternalSeekTarget()
    if (target === null && state !== GameState.ANSWERING && !this.isSeekbarDisabled()) return true

    const current = this.playerControl.getCurrentTime()
    const duration = this.playerControl.getDuration()
    const previous = this.timeManager.getPreviousVideoTime()
    // 現在時刻だけではなく、最後に確認した正常位置も終端付近なら自然終了とする。
    // ENDEDより時刻通知が遅れても、離れた位置からの終了を単に無視せず復帰させる。
    if (
      target === null &&
      state !== GameState.ANSWERING &&
      Number.isFinite(duration) &&
      duration > 0 &&
      Math.abs(previous - duration) <= SEEK_TOLERANCE_SEC &&
      Math.abs(current - duration) <= SEEK_TOLERANCE_SEC
    )
      return true

    const now = performance.now()
    this.endRecovery = {
      target: target ?? previous,
      resume:
        state !== GameState.ANSWERING &&
        !this.externalPause.isExternalPaused() &&
        this.playerControl.isPlaybackStateExpected(YouTubePlayerState.PLAYING),
      retryAt: now,
      deadline: now + INTERNAL_SEEK_TIMEOUT_MS,
    }
    this.timeManager.beginInternalSeek(this.endRecovery.target)
    this.retryEndRecovery()
    return false
  }

  private retryEndRecovery(): void {
    const recovery = this.endRecovery
    if (!recovery) return
    this.endRecovery = { ...recovery, retryAt: performance.now() + END_SEEK_RETRY_MS }
    try {
      // 終端でplayVideoが先頭へ戻す場合にも、最後の指示を目的位置へのseekにする。
      if (
        recovery.resume &&
        !this.externalPause.isExternalPaused() &&
        this.gameStore.currentState !== GameState.ANSWERING
      )
        this.playerControl.playVideo()
      else this.playerControl.pauseVideo()
      this.playerControl.seekTo(recovery.target)
      this.timeManager.updateCurrentVideoTime(recovery.target)
    } catch (error) {
      this.endRecovery = null
      this.timeManager.cancelInternalSeek()
      throw error
    }
  }

  /** 外部停止中でも復帰位置を確認する。新しい内部操作・reset/destroyでは旧復帰を失効。 */
  private waitForEndRecovery(current: number): boolean {
    const recovery = this.endRecovery
    if (!recovery) return false
    if (this.timeManager.getInternalSeekTarget() !== recovery.target) {
      this.endRecovery = null
      return false
    }
    if (
      Math.abs(current - recovery.target) <= SEEK_TOLERANCE_SEC &&
      this.playerControl.getPlayerState() !== YouTubePlayerState.ENDED
    ) {
      this.endRecovery = null
      this.timeManager.shouldWaitForInternalSeek(current)
      if (recovery.resume) this.externalPause.resumeExternalIfReason('stall')
      return false
    }
    const now = performance.now()
    if (now >= recovery.deadline) {
      this.endRecovery = null
      this.timeManager.cancelInternalSeek()
      return false
    }
    if (now >= recovery.retryAt) this.retryEndRecovery()
    return true
  }

  /**
   * 動画時間の更新とシーク検出・状態遷移処理
   * @param current 現在の動画時間（秒）
   */
  updateVideoTime(current: number): void {
    if (this.destroyed || this.gameStore.currentState === GameState.READY) return
    if (this.waitForEndRecovery(current)) return
    // External Pause中は時間更新をスキップ（ただし user 一時停止中はシーク検出のため通す）
    if (this.externalPause.shouldSkipTimeUpdate()) {
      return
    }

    // FINISHED状態の場合は時間更新・状態遷移をスキップ（resetGame()でのみ解除）
    if (this.gameStore.currentState === GameState.FINISHED) {
      return
    }

    if (this.timeManager.shouldWaitForInternalSeek(current)) return

    const prev = this.timeManager.getPreviousVideoTime()

    // 現在時刻を更新
    this.timeManager.updateCurrentVideoTime(current)

    // YouTube Player巻き戻り閾値の通過チェック
    this.externalPause.updateRewindThreshold(current)

    // シーク検出
    if (this.timeManager.isSeekDetected(current)) {
      logger.log('[GameManager] Seek detected:', prev, '->', current)

      if (this.gameStore.currentState === GameState.ANSWERING || this.isSeekbarDisabled()) {
        // ANSWERING中 or disableSeekbar=true: 動画時間を強制リセット
        this.playerControl.seekTo(prev)
        // currentVideoTimeも元に戻す（submitAnswer内のrevealTime比較に影響するため）
        this.timeManager.updateCurrentVideoTime(prev)
        logger.log('[GameManager] Forced reset to:', prev)
        // previousVideoTimeは維持（更新しない）
      } else {
        // disableSeekbar=false: シークで飛ばした問題を消費（不参加）扱いに
        this.thresholdEngine.consumeQuestionsBySeek(prev, current)
        // previousVideoTimeを更新
        this.timeManager.updatePreviousVideoTime(current)
      }

      return
    }

    // 通常の時間更新: (prev, curr] 窓内の閾値を走査して状態遷移を処理
    this.thresholdEngine.processTimeWindow(prev, current)

    // previousVideoTimeを更新
    this.timeManager.updatePreviousVideoTime(current)
  }

  /**
   * シークバー無効の実効値を解決する
   * ユーザー設定（settingsStore.disableSeekbarOverride）> クイズデータの設定（Task 19-3）
   */
  private isSeekbarDisabled(): boolean {
    return this.settingsStore?.disableSeekbarOverride ?? this.quizData.settings.disableSeekbar
  }

  /**
   * 解答送信後の処理（jumpToRevealPeriod対応）
   * @param questionIndex 問題インデックス
   * @param isCorrect 正解かどうか
   */
  submitAnswer(questionIndex: number, isCorrect: boolean): void {
    if (this.destroyed) return
    this.answerFlow.jumpToRevealIfConfigured(questionIndex, isCorrect)
  }

  /**
   * GameManager の破棄処理（リソースリーク防止）
   * - 解答カウントダウンタイマーを停止
   * - setupVisibilityHandlers で登録した document/window リスナーを解除
   */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.cancelPendingTimers()
    if (this.warmupStopTimer !== null) {
      window.clearTimeout(this.warmupStopTimer)
      this.warmupStopTimer = null
    }
    this.externalPause.endGateWarmup()
    this.answerFlow.stopAnswerCountdown()
    this.externalPause.destroy()

    logger.log('[GameManager] Destroyed')
  }
}

/**
 * GameManagerインスタンスを作成
 */
export function createGameManager(
  playerManager: YouTubePlayerManager,
  quizData: QuizData,
  gameStore: ReturnType<typeof useGameStore>,
  audioManager?: AudioManager,
  settingsStore?: ReturnType<typeof useSettingsStore>,
): GameManager {
  return new GameManager(playerManager, quizData, gameStore, audioManager, settingsStore)
}
