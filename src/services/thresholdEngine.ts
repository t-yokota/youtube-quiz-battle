// 閾値走査エンジン: consumed フラグの唯一の所有者
import type { QuizData, QuizQuestion } from '@/types'
import { GameState } from '@/types'
import { TIME_EPSILON_SEC } from '@/constants/timing'
import type { useGameStore } from '@/stores/gameStore'
import { logger } from '@/utils/logger'

/**
 * Single-Shot Guard: 問題単位のstart/reveal/end消費フラグ
 */
interface ConsumedFlags {
  start: boolean
  reveal: boolean
  end: boolean
}

/**
 * 閾値走査エンジン
 * consumed フラグの管理、時間窓 (prev, curr] の閾値走査・シーク消費・スキップ記録・
 * start/reveal/end ハンドラを担う。
 */
export class ThresholdEngine {
  private quizData: QuizData
  private gameStore: ReturnType<typeof useGameStore>

  // Single-Shot Guard: 問題ごとの閾値消費フラグ
  private consumed: Record<number, ConsumedFlags> = {}

  constructor(quizData: QuizData, gameStore: ReturnType<typeof useGameStore>) {
    this.quizData = quizData
    this.gameStore = gameStore
  }

  /**
   * (prev, curr] 窓内の閾値を走査して処理する
   * @param prev 前回の previousVideoTime
   * @param curr 現在の previousVideoTime
   */
  processTimeWindow(prev: number, curr: number): void {
    // すべての問題の閾値を走査して処理
    for (const question of this.quizData.questions) {
      this.applyThresholds(prev, curr, question)
    }
  }

  /**
   * シーク操作で飛ばした問題を消費（不参加）扱いにする
   * @param prev 直前の動画再生位置
   * @param curr 現在の動画再生位置
   */
  consumeQuestionsBySeek(prev: number, curr: number): void {
    if (curr > prev) {
      // 前方シーク: [prev, curr]区間と重なる問題をendTimeまで消費（不参加）
      for (const question of this.quizData.questions) {
        // 重なり判定: q.startTime < curr && q.endTime > prev
        if (question.startTime < curr && question.endTime > prev) {
          const c =
            this.consumed[question.index] ??
            (this.consumed[question.index] = { start: false, reveal: false, end: false })
          c.start = true
          c.reveal = true
          c.end = true
          this.recordSkippedQuestion(question.index, true)
          logger.log('[ThresholdEngine] Consumed question by forward seek:', question.index)
        }
      }
    } else {
      // 後方シーク: prevが問題区間内だった場合、その問題を消費（不参加）
      for (const question of this.quizData.questions) {
        // prev が [startTime, endTime) 区間内か判定
        if (prev >= question.startTime && prev < question.endTime) {
          const c =
            this.consumed[question.index] ??
            (this.consumed[question.index] = { start: false, reveal: false, end: false })
          c.start = true
          c.reveal = true
          c.end = true
          this.recordSkippedQuestion(question.index, true)
          logger.log('[ThresholdEngine] Consumed question by backward seek:', question.index)
        }
      }
    }

    // シーク後の状態遷移
    const lastQuestion = this.quizData.questions[this.quizData.questions.length - 1]
    const allConsumed = this.quizData.questions.every((q) => {
      const c = this.consumed[q.index]
      return c && c.start && c.reveal && c.end
    })
    if (allConsumed && curr >= lastQuestion.endTime) {
      this.gameStore.transitionToState(GameState.FINISHED)
    } else {
      // シーク先が未消費の問題区間内ならWAITING、それ以外はTALKING
      const inUnconsumedQuestionRange = this.quizData.questions.some((q) => {
        const c = this.consumed[q.index]
        const isConsumed = c && c.start && c.reveal && c.end
        return !isConsumed && curr >= q.startTime && curr < q.endTime
      })
      this.gameStore.transitionToState(
        inUnconsumedQuestionRange ? GameState.WAITING : GameState.TALKING,
      )
    }

    // シークで問題を離脱したため、解答途中の表示状態（不正解表示・入力内容・解答履歴）を
    // クリアする。残っていると遷移先の REVEALING 等で前問の不正解 UI が誤表示される
    this.gameStore.initializeForQuestion()
  }

  /**
   * submitAnswer の二重発火防止用: reveal フラグのみ先行消費
   * @param questionIndex 問題インデックス
   */
  markRevealConsumed(questionIndex: number): void {
    const c =
      this.consumed[questionIndex] ??
      (this.consumed[questionIndex] = { start: false, reveal: false, end: false })
    c.reveal = true
  }

  /**
   * システム巻き戻り時: 解答記録がない（または skipped の）問題の consumed をリセット。
   * skipped 結果は gameStore.removeResult で削除する。
   */
  resetUnansweredConsumed(): void {
    for (const question of this.quizData.questions) {
      const c = this.consumed[question.index]
      if (c) {
        // 解答記録がない場合のみリセット（既に結果が記録された問題はリセットしない）
        const recorded = this.gameStore.results.find((r) => r.questionNumber === question.index + 1)
        if (!recorded || recorded.skipped) {
          // skipped結果が残っていると重複ガードで再記録できないため削除
          if (recorded?.skipped) {
            this.gameStore.removeResult(question.index + 1)
          }
          this.consumed[question.index] = { start: false, reveal: false, end: false }
          logger.log('[ThresholdEngine] Reset consumed flags for question:', question.index)
        }
      }
    }
  }

  /**
   * resetGame 用: 全 consumed を破棄
   */
  resetAll(): void {
    this.consumed = {}
  }

  /**
   * (prev, curr] 窓内の閾値を適用（Single-Shot Guard）
   * @param prev 前回の previousVideoTime
   * @param curr 現在の previousVideoTime
   * @param question 対象の問題
   */
  private applyThresholds(prev: number, curr: number, question: QuizQuestion): void {
    const c =
      this.consumed[question.index] ??
      (this.consumed[question.index] = { start: false, reveal: false, end: false })

    // start 閾値
    if (
      prev + TIME_EPSILON_SEC < question.startTime &&
      curr + TIME_EPSILON_SEC >= question.startTime
    ) {
      // currentQuestionIndexを更新（動画再生位置ベースの表示用）
      this.gameStore.setCurrentQuestionIndex(question.index)

      if (!c.start) {
        c.start = true
        this.onStart(question) // 副作用あり：初期化、QUESTIONING状態へ
      } else {
        // 消費済み：不参加、スキップとして記録
        this.recordSkippedQuestion(question.index, true)
        // 副作用なしで WAITING 状態へ遷移（スキップ済み問題）
        this.gameStore.transitionToState(GameState.WAITING)
        logger.log('[ThresholdEngine] Skipped question (already consumed):', question.index)
      }
    }

    // othersAnsweringPeriods 閾値（問題区間内の動画内プレイヤー解答期間）
    if (question.othersAnsweringPeriods) {
      for (const period of question.othersAnsweringPeriods) {
        // 期間開始閾値
        if (
          prev + TIME_EPSILON_SEC < period.startTime &&
          curr + TIME_EPSILON_SEC >= period.startTime
        ) {
          // WAITING 状態へ遷移（動画内プレイヤーの解答中）
          this.gameStore.transitionToState(GameState.WAITING)
          logger.log(
            '[ThresholdEngine] Entered OthersAnsweringPeriod:',
            period.startTime,
            '-',
            period.endTime,
          )
        }

        // 期間終了閾値
        if (prev + TIME_EPSILON_SEC < period.endTime && curr + TIME_EPSILON_SEC >= period.endTime) {
          // QUESTIONING 状態へ復帰
          this.gameStore.transitionToState(GameState.QUESTIONING)
          logger.log(
            '[ThresholdEngine] Exited OthersAnsweringPeriod:',
            period.startTime,
            '-',
            period.endTime,
          )
        }
      }
    }

    // reveal 閾値
    if (
      prev + TIME_EPSILON_SEC < question.revealTime &&
      curr + TIME_EPSILON_SEC >= question.revealTime
    ) {
      if (!c.reveal) {
        c.reveal = true
        this.onReveal(question) // 副作用あり：正解表示、REVEALING状態へ
      } else {
        // 副作用なしで REVEALING 状態へ遷移（既に消費済み）
        this.gameStore.transitionToState(GameState.REVEALING)
        logger.log('[ThresholdEngine] Already revealed (consumed):', question.index)
      }
    }

    // end 閾値
    if (prev + TIME_EPSILON_SEC < question.endTime && curr + TIME_EPSILON_SEC >= question.endTime) {
      if (!c.end) {
        c.end = true
        this.onEnd(question) // 副作用あり：スコア集計、TALKING/FINISHED状態へ
      } else {
        // 消費済み：既に終了済み
        logger.log('[ThresholdEngine] Already ended (consumed):', question.index)

        // すべての問題が消費済みかチェック
        const allConsumed = this.quizData.questions.every(
          (q) =>
            this.consumed[q.index]?.start &&
            this.consumed[q.index]?.reveal &&
            this.consumed[q.index]?.end,
        )

        // 最後の問題のendTimeを通過したかチェック
        const lastQuestion = this.quizData.questions[this.quizData.questions.length - 1]
        if (allConsumed && question.index === lastQuestion.index) {
          // 副作用なしで FINISHED 状態へ遷移
          this.gameStore.transitionToState(GameState.FINISHED)
          logger.log(
            '[ThresholdEngine] All questions consumed and last question ended, transitioning to FINISHED',
          )
        } else {
          // 副作用なしで TALKING 状態へ遷移
          this.gameStore.transitionToState(GameState.TALKING)
        }
      }
    }
  }

  /**
   * スキップ・未解答の問題を記録（0点、不参加扱い）
   * @param questionIndex 問題インデックス
   * @param isSkip 真のスキップか（consumed start経由=true、onEnd経由=false）
   */
  private recordSkippedQuestion(questionIndex: number, isSkip: boolean): void {
    const question = this.quizData.questions[questionIndex]
    if (!question) return

    // pendingUserAnswersは現在解答中の問題にのみ紐付ける
    const isCurrentQuestion = questionIndex === this.gameStore.currentQuestionIndex
    const userAnswers = isCurrentQuestion ? [...this.gameStore.pendingUserAnswers] : []
    const hasAttempted = isCurrentQuestion && this.gameStore.pendingUserAnswers.length > 0

    this.gameStore.recordResult(
      questionIndex + 1,
      false,
      question.answers[0],
      userAnswers,
      isSkip && !hasAttempted,
    )

    logger.log(
      '[ThresholdEngine] Recording',
      isSkip ? 'skipped' : hasAttempted ? 'incomplete answer' : 'unanswered',
      'question:',
      questionIndex,
    )
  }

  /**
   * 問題開始ハンドラ（時間経過起点）
   * @param question 問題データ
   */
  private onStart(question: QuizQuestion): void {
    logger.log('[ThresholdEngine] onStart:', question.index)

    // ゲームストアの currentQuestionIndex を更新
    this.gameStore.setCurrentQuestionIndex(question.index)

    // 問題単位の状態初期化（remainingAttempts / answerResult / answerInput をリセット）
    this.gameStore.initializeForQuestion()

    // QUESTIONING 状態へ遷移
    this.gameStore.transitionToState(GameState.QUESTIONING)
  }

  /**
   * 正解発表開始ハンドラ（時間経過起点）
   * @param question 問題データ
   */
  private onReveal(question: QuizQuestion): void {
    logger.log('[ThresholdEngine] onReveal:', question.index)

    // REVEALING 状態へ遷移
    this.gameStore.transitionToState(GameState.REVEALING)
  }

  /**
   * 正解発表終了ハンドラ（時間経過起点）
   * @param question 問題データ
   */
  private onEnd(question: QuizQuestion): void {
    logger.log('[ThresholdEngine] onEnd:', question.index)

    // この問題の結果が未記録（スキップ・未解答）の場合、未解答として記録
    this.recordSkippedQuestion(question.index, false)

    // 最後の問題かどうかをチェック
    const lastQuestion = this.quizData.questions[this.quizData.questions.length - 1]
    if (question.index === lastQuestion.index) {
      // 最後の問題 → FINISHED 状態へ遷移
      this.gameStore.transitionToState(GameState.FINISHED)
    } else {
      // 次の問題がある → TALKING 状態へ遷移
      this.gameStore.transitionToState(GameState.TALKING)
    }
  }
}

export function createThresholdEngine(
  quizData: QuizData,
  gameStore: ReturnType<typeof useGameStore>,
): ThresholdEngine {
  return new ThresholdEngine(quizData, gameStore)
}
