// 時間管理サービス
import { GameState } from '@/types'
import type { QuizQuestion } from '@/types'
import { SEEK_TOLERANCE_SEC } from '@/constants/timing'

/**
 * 時間管理システム
 * 動画再生時間の管理、シーク検出、状態判定を行う
 */
export class TimeManager {
  private currentVideoTime: number = 0
  private watchedVideoTime: number = 0

  constructor(private questions: QuizQuestion[]) {}

  /**
   * 現在の動画時間を取得
   */
  getCurrentVideoTime(): number {
    return this.currentVideoTime
  }

  /**
   * 視聴済み最大時間を取得
   */
  getWatchedVideoTime(): number {
    return this.watchedVideoTime
  }

  /**
   * 現在の動画時間を更新
   * @param time 新しい動画時間
   */
  updateCurrentVideoTime(time: number): void {
    this.currentVideoTime = time
  }

  /**
   * 視聴済み最大時間を更新
   * @param time 新しい動画時間
   */
  updateWatchedVideoTime(time: number): void {
    this.watchedVideoTime = Math.max(this.watchedVideoTime, time)
  }

  /**
   * シークが検出されたか判定
   * @param newTime 新しい動画時間
   * @returns シークが検出された場合true
   */
  isSeekDetected(newTime: number): boolean {
    return Math.abs(newTime - this.watchedVideoTime) > SEEK_TOLERANCE_SEC
  }

  /**
   * 現在の時間と問題インデックスから適切なゲーム状態を判定
   * @param currentQuestionIndex 現在の問題インデックス（-1: 問題開始前, 0~: 配列インデックス）
   * @returns 判定されたゲーム状態
   */
  getCurrentGameState(currentQuestionIndex: number): GameState {
    const time = this.currentVideoTime

    // 問題開始前
    if (currentQuestionIndex === -1) {
      if (this.questions.length === 0) return GameState.FINISHED

      const firstQuestion = this.questions[0]
      if (time < firstQuestion.startTime) {
        return GameState.TALKING
      }
      // 最初の問題の開始時刻に到達
      return GameState.QUESTIONING
    }

    // 全問題終了後（インデックスが範囲外, 呼び出し元が既にインデックスを進めている場合のガード）
    if (currentQuestionIndex >= this.questions.length) {
      return GameState.FINISHED
    }

    const currentQuestion = this.questions[currentQuestionIndex]

    // 現在の問題内での状態判定（優先順位順）
    if (time < currentQuestion.startTime) {
      // まだ問題開始前（TALKING区間）
      return GameState.TALKING
    }

    // 1. REVEALING（最優先）
    if (time >= currentQuestion.revealTime && time < currentQuestion.endTime) {
      return GameState.REVEALING
    }

    // 2. OthersAnsweringPeriods（動画内プレイヤーの解答中）
    if (this.isInOthersAnsweringPeriod(time, currentQuestion)) {
      return GameState.WAITING
    }

    // 3. QUESTIONING（問読み区間）
    if (time >= currentQuestion.startTime && time < currentQuestion.revealTime) {
      return GameState.QUESTIONING
    }

    // 4. 現在の問題が終了
    if (time >= currentQuestion.endTime) {
      // 現在の問題が終了
      // 次の問題があるか確認
      if (currentQuestionIndex + 1 < this.questions.length) {
        const nextQuestion = this.questions[currentQuestionIndex + 1]
        if (time < nextQuestion.startTime) {
          return GameState.TALKING
        } else {
          // 次の問題が既に開始している
          return GameState.QUESTIONING
        }
      } else {
        // 全問題終了
        return GameState.FINISHED
      }
    }

    // デフォルト（通常は到達しない）
    return GameState.WAITING
  }

  /**
   * 指定時間が問題区間内（startTime <= time < revealTime）にあるか判定
   * @param time 判定する時間
   * @param question 問題データ
   * @returns 問題区間内ならtrue
   */
  isInQuestionPeriod(time: number, question: QuizQuestion): boolean {
    return time >= question.startTime && time < question.revealTime
  }

  /**
   * 指定時間が正解発表区間内（revealTime <= time < endTime）にあるか判定
   * @param time 判定する時間
   * @param question 問題データ
   * @returns 正解発表区間内ならtrue
   */
  isInRevealPeriod(time: number, question: QuizQuestion): boolean {
    return time >= question.revealTime && time < question.endTime
  }

  /**
   * 指定時間が他プレイヤー解答期間内にあるか判定
   * @param time 判定する時間
   * @param question 問題データ
   * @returns 他プレイヤー解答期間内ならtrue
   */
  isInOthersAnsweringPeriod(time: number, question: QuizQuestion): boolean {
    if (!question.othersAnsweringPeriods) return false

    return question.othersAnsweringPeriods.some((period) => {
      return time >= period.startTime && time < period.endTime
    })
  }

  /**
   * 時間範囲内の他プレイヤー解答期間を検出
   * @param startTime 開始時間
   * @param endTime 終了時間
   * @param question 問題データ
   * @returns 他プレイヤー解答期間が検出された場合true
   */
  hasOthersAnsweringPeriodInRange(
    startTime: number,
    endTime: number,
    question: QuizQuestion,
  ): boolean {
    if (!question.othersAnsweringPeriods) return false

    return question.othersAnsweringPeriods.some((period) => {
      // 期間の重なり判定
      return !(endTime <= period.startTime || startTime >= period.endTime)
    })
  }

  /**
   * リセット（テスト用）
   */
  reset(): void {
    this.currentVideoTime = 0
    this.watchedVideoTime = 0
  }
}

/**
 * TimeManagerインスタンスを作成
 */
export function createTimeManager(questions: QuizQuestion[]): TimeManager {
  return new TimeManager(questions)
}
