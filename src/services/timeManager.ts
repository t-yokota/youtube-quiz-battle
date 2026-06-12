// 時間管理サービス
import type { QuizQuestion } from '@/types'
import { SEEK_TOLERANCE_SEC } from '@/constants/timing'

/**
 * 時間管理システム
 * 動画再生時間の管理、シーク検出、状態判定を行う
 */
export class TimeManager {
  private currentVideoTime: number = 0
  private previousVideoTime: number = 0

  constructor(private questions: QuizQuestion[]) {}

  /**
   * 現在の動画時間を取得
   */
  getCurrentVideoTime(): number {
    return this.currentVideoTime
  }

  /**
   * 直前の動画再生位置を取得（シーク検出用）
   */
  getPreviousVideoTime(): number {
    return this.previousVideoTime
  }

  /**
   * 現在の動画時間を更新
   * @param time 新しい動画時間
   */
  updateCurrentVideoTime(time: number): void {
    this.currentVideoTime = time
  }

  /**
   * 直前の動画再生位置を更新（シーク検出用）
   * @param time 新しい動画時間
   */
  updatePreviousVideoTime(time: number): void {
    this.previousVideoTime = time
  }

  /**
   * シークが検出されたか判定
   * @param newTime 新しい動画時間
   * @returns シークが検出された場合true
   */
  isSeekDetected(newTime: number): boolean {
    return Math.abs(newTime - this.previousVideoTime) > SEEK_TOLERANCE_SEC
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
   * 時間変数をリセット
   * ゲームリセット時に使用
   */
  resetTimeValues(): void {
    this.currentVideoTime = 0
    this.previousVideoTime = 0
  }
}

/**
 * TimeManagerインスタンスを作成
 */
export function createTimeManager(questions: QuizQuestion[]): TimeManager {
  return new TimeManager(questions)
}
