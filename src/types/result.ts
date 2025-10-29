// 解答結果の型定義

// 個別問題の解答結果
export interface QuestionResult {
  questionNumber: number // 問題番号（1-indexed）
  isCorrect: boolean // 正解かどうか
  correctAnswer: string // 正解（answers配列の最初の要素）
  userAnswer: string // ユーザーの解答
}
