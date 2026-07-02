// ゲーム管理サービス（ファサード）
import type { QuizData, YouTubePlayerManager } from '@/types'
import { GameState, ButtonState } from '@/types'
import { createTimeManager, TimeManager } from './timeManager'
import { BUTTON_PUSHED_DURATION_MS, BUTTON_CHECK_RELEASE_MS } from '@/constants/timing'
import type { useGameStore } from '@/stores/gameStore'
import { logger } from '@/utils/logger'
import { createInternalPlayerControl, InternalPlayerControl } from './internalPlayerControl'
import { createThresholdEngine, ThresholdEngine } from './thresholdEngine'
import { createAnswerFlowController, AnswerFlowController } from './answerFlowController'
import { createExternalPauseController, ExternalPauseController } from './externalPauseController'

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

  constructor(
    playerManager: YouTubePlayerManager,
    quizData: QuizData,
    gameStore: ReturnType<typeof useGameStore>,
  ) {
    this.quizData = quizData
    this.gameStore = gameStore
    this.timeManager = createTimeManager(quizData.questions)
    this.playerControl = createInternalPlayerControl(playerManager)
    this.thresholdEngine = createThresholdEngine(quizData, gameStore)
    this.answerFlow = createAnswerFlowController(
      this.playerControl,
      quizData,
      gameStore,
      this.timeManager,
      this.thresholdEngine,
    )
    this.externalPause = createExternalPauseController(
      this.playerControl,
      gameStore,
      this.timeManager,
      this.thresholdEngine,
      this.answerFlow,
    )
  }

  /**
   * ゲームをリセットして最初から開始できるようにする
   * 「もう一度プレイ」ボタン押下時に呼び出される
   */
  resetGame(): void {
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
    if (this.gameStore.currentState !== GameState.FINISHED) return

    logger.log('[GameManager] Replay requested')

    // External Pause状態もクリア
    this.externalPause.resetPauseState()

    // ゲームリセット
    this.resetGame()

    // 動画を0秒にシーク
    this.playerControl.seekTo(0)

    // READY状態へ遷移
    this.gameStore.transitionToState(GameState.READY)
  }

  /**
   * 解答送信処理（App.vueから呼び出される）
   */
  handleAnswerSubmit(answer: string): void {
    this.answerFlow.handleAnswerSubmit(answer)
  }

  /**
   * ボタン押下処理
   * QuizButton の press イベントから App 経由で呼び出される
   * ボタン状態遷移・ゲーム状態遷移・動画制御を統合的に処理する
   */
  handleButtonPress(): void {
    if (!this.gameStore.isButtonEnabled) return

    logger.log(`[GameManager] Button pressed in state: ${this.gameStore.currentState}`)

    const stateAtPress = this.gameStore.currentState

    // ボタン状態遷移: STANDBY -> PUSHED -> RELEASED
    this.gameStore.setButtonState(ButtonState.PUSHED)
    setTimeout(() => {
      this.gameStore.setButtonState(ButtonState.RELEASED)

      if (stateAtPress === GameState.READY) {
        // ボタンチェック: BUTTON_CHECK_RELEASE_MS後にTALKING状態へ遷移し、動画再生開始
        setTimeout(() => {
          this.gameStore.setButtonState(ButtonState.STANDBY)
          this.gameStore.transitionToState(GameState.TALKING)
          // 動画再生開始
          this.playerControl.playVideo()
        }, BUTTON_CHECK_RELEASE_MS)
      } else if (stateAtPress === GameState.QUESTIONING) {
        // 早押し: ANSWERING状態へ遷移し、動画一時停止
        this.gameStore.transitionToState(GameState.ANSWERING)
        // 動画一時停止
        this.playerControl.pauseVideo()
        // カウントダウンタイマー開始
        this.answerFlow.startAnswerCountdown()
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
  pauseExternal(reason: 'visibility' | 'user' | 'stall'): void {
    this.externalPause.pauseExternal(reason)
  }

  /**
   * External Pauseを解除
   */
  resumeExternal(): void {
    this.externalPause.resumeExternal()
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

  /**
   * 動画時間の更新とシーク検出・状態遷移処理
   * @param current 現在の動画時間（秒）
   */
  updateVideoTime(current: number): void {
    // External Pause中は時間更新をスキップ
    if (this.externalPause.isExternalPaused()) {
      return
    }

    // FINISHED状態の場合は時間更新・状態遷移をスキップ（resetGame()でのみ解除）
    if (this.gameStore.currentState === GameState.FINISHED) {
      return
    }

    const prev = this.timeManager.getPreviousVideoTime()

    // 現在時刻を更新
    this.timeManager.updateCurrentVideoTime(current)

    // YouTube Player巻き戻り閾値の通過チェック
    this.externalPause.updateRewindThreshold(current)

    // シーク検出
    if (this.timeManager.isSeekDetected(current)) {
      logger.log('[GameManager] Seek detected:', prev, '->', current)

      if (
        this.gameStore.currentState === GameState.ANSWERING ||
        this.quizData.settings.disableSeekbar
      ) {
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
   * 解答送信後の処理（jumpToRevealPeriod対応）
   * @param questionIndex 問題インデックス
   * @param isCorrect 正解かどうか
   */
  submitAnswer(questionIndex: number, isCorrect: boolean): void {
    this.answerFlow.jumpToRevealIfConfigured(questionIndex, isCorrect)
  }

  /**
   * GameManager の破棄処理（リソースリーク防止）
   * - 解答カウントダウンタイマーを停止
   * - setupVisibilityHandlers で登録した document/window リスナーを解除
   */
  destroy(): void {
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
): GameManager {
  return new GameManager(playerManager, quizData, gameStore)
}
