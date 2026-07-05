// 解答フロー制御: カウントダウン・解答送信・解答後の動画再開・reveal シーク
import type { QuizData } from '@/types'
import { GameState } from '@/types'
import { ANSWER_COUNTDOWN_INTERVAL_MS } from '@/constants/timing'
import type { useGameStore } from '@/stores/gameStore'
import { logger } from '@/utils/logger'
import type { TimeManager } from './timeManager'
import type { InternalPlayerControl } from './internalPlayerControl'
import type { ThresholdEngine } from './thresholdEngine'
import type { AudioManager } from './audioManager'
import { SOUND_TYPE } from '@/constants/audio'

/**
 * 解答フロー制御
 * 解答カウントダウン、解答送信、解答後の動画再開、jumpToRevealPeriod シークを担う。
 */
export class AnswerFlowController {
  private playerControl: InternalPlayerControl
  private quizData: QuizData
  private gameStore: ReturnType<typeof useGameStore>
  private timeManager: TimeManager
  private thresholdEngine: ThresholdEngine
  private audioManager?: AudioManager

  // 解答カウントダウンタイマー（ANSWERING中の制限時間管理）
  private answerCountdownInterval: number | null = null

  constructor(
    playerControl: InternalPlayerControl,
    quizData: QuizData,
    gameStore: ReturnType<typeof useGameStore>,
    timeManager: TimeManager,
    thresholdEngine: ThresholdEngine,
    audioManager?: AudioManager,
  ) {
    this.playerControl = playerControl
    this.quizData = quizData
    this.gameStore = gameStore
    this.timeManager = timeManager
    this.thresholdEngine = thresholdEngine
    this.audioManager = audioManager
  }

  /**
   * 解答カウントダウンタイマーを開始
   * ANSWERING状態に入った時に呼び出す
   */
  startAnswerCountdown(): void {
    this.stopAnswerCountdown()

    // answerTimeRemainingをリセット（再入場時のため）
    this.gameStore.resetAnswerTime()

    this.resumeAnswerCountdown()
  }

  /**
   * 解答カウントダウンタイマーを再開（External Pause復帰時用）
   * answerTimeRemainingはリセットせず、現在値から継続する
   */
  resumeAnswerCountdown(): void {
    this.stopAnswerCountdown()

    this.answerCountdownInterval = window.setInterval(() => {
      const remaining = this.gameStore.decrementAnswerTime()

      if (remaining <= 0) {
        this.handleAnswerTimeout()
      }
    }, ANSWER_COUNTDOWN_INTERVAL_MS)

    logger.log(
      '[AnswerFlowController] Answer countdown started:',
      this.gameStore.answerTimeRemaining,
    )
  }

  /**
   * 解答カウントダウンタイマーを停止
   */
  stopAnswerCountdown(): void {
    if (this.answerCountdownInterval !== null) {
      window.clearInterval(this.answerCountdownInterval)
      this.answerCountdownInterval = null
    }
  }

  /**
   * 解答制限時間切れ処理
   * カウントダウンが0になった時に呼ばれる。
   * その時点の入力内容で正誤判定を行う（未入力なら空文字 = 不正解）。
   */
  private handleAnswerTimeout(): void {
    this.stopAnswerCountdown()
    logger.log('[AnswerFlowController] Answer timeout')

    // 入力途中の内容をそのまま送信して判定する（制限時間切れによる自動確定）
    const result = this.gameStore.handleAnswerSubmit(this.gameStore.answerInput, 'timeout')
    if (result) {
      this.resumeVideoAfterAnswer(result)
    }
  }

  /**
   * 解答送信処理（App.vueから呼び出される）
   * gameStoreの判定を呼び出し、結果に応じて動画再開・タイマー停止を行う
   */
  handleAnswerSubmit(answer: string): void {
    this.stopAnswerCountdown()

    const result = this.gameStore.handleAnswerSubmit(answer)
    if (!result) return

    this.resumeVideoAfterAnswer(result)
  }

  /**
   * 解答結果に応じて動画を再開する
   * @param result handleAnswerSubmitの戻り値
   */
  private resumeVideoAfterAnswer(result: { isCorrect: boolean; isFinal: boolean }): void {
    // 正誤判定後の効果音（正解音 / 不正解音）
    this.audioManager?.playSound(result.isCorrect ? SOUND_TYPE.CORRECT : SOUND_TYPE.INCORRECT)

    if (result.isFinal) {
      // 正解 or 最終不正解 → 遷移を一元決定する
      const questionIndex = this.gameStore.currentQuestionIndex

      // jumpToRevealPeriod=true かつ currentVideoTime < revealTime のとき REVEALING へ直接遷移
      const jumped = this.jumpToRevealIfConfigured(questionIndex, result.isCorrect)

      if (!jumped) {
        // REVEALING へジャンプしなかった場合は WAITING へ遷移
        this.gameStore.transitionToState(GameState.WAITING)

        // jumpToRevealPeriodでない場合は通常の動画再開
        if (!(this.gameStore.effectiveSettings?.jumpToRevealPeriod ?? false)) {
          this.playerControl.playVideo()
        }
      }
    } else {
      // リトライ可能 → QUESTIONING へ戻し動画再開
      this.gameStore.transitionToState(GameState.QUESTIONING)
      this.playerControl.playVideo()
    }
  }

  /**
   * 解答送信後の処理（jumpToRevealPeriod対応）
   * jumpToRevealPeriod=true かつ currentVideoTime < revealTime のときのみシーク
   * @param questionIndex 問題インデックス
   * @param isCorrect 正解かどうか
   * @returns REVEALING へジャンプ（シーク＋遷移）した場合 true
   */
  jumpToRevealIfConfigured(questionIndex: number, isCorrect: boolean): boolean {
    logger.log('[AnswerFlowController] submitAnswer:', questionIndex, 'isCorrect:', isCorrect)

    if (!(this.gameStore.effectiveSettings?.jumpToRevealPeriod ?? false)) {
      // jumpToRevealPeriod=false の場合、何もしない
      return false
    }

    const question = this.quizData.questions[questionIndex]
    const currentVideoTime = this.timeManager.getCurrentVideoTime()

    // currentVideoTime < revealTime の場合のみシーク
    if (currentVideoTime < question.revealTime) {
      // consumed[questionIndex].reveal を先に設定して二重発火を防ぐ
      this.thresholdEngine.markRevealConsumed(questionIndex)

      // revealTime にシーク
      this.playerControl.seekTo(question.revealTime)
      this.playerControl.playVideo()

      // REVEALING 状態への遷移
      this.gameStore.transitionToState(GameState.REVEALING)

      logger.log('[AnswerFlowController] Jumped to reveal period:', question.revealTime)
      return true
    }

    return false
  }
}

export function createAnswerFlowController(
  playerControl: InternalPlayerControl,
  quizData: QuizData,
  gameStore: ReturnType<typeof useGameStore>,
  timeManager: TimeManager,
  thresholdEngine: ThresholdEngine,
  audioManager?: AudioManager,
): AnswerFlowController {
  return new AnswerFlowController(
    playerControl,
    quizData,
    gameStore,
    timeManager,
    thresholdEngine,
    audioManager,
  )
}
