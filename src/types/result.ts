// 解答結果の型定義

// 個別問題の解答結果
export interface QuestionResult {
  questionNumber: number // 問題番号（1-indexed）
  isCorrect: boolean // 正解かどうか
  correctAnswer: string // 正解（answers配列の最初の要素）
  userAnswers: string[] // ユーザーの解答履歴（複数回解答の場合は複数要素）
  skipped: boolean // スキップされた問題かどうか
  timesUntilPress: number[] // 各試行で解答権を得るまでの秒（Analytics用）
  submissionTypes: ('manual' | 'timeout')[] // 各試行の送信種別（Analytics用）
}
