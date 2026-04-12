// 解答検証サービス

/**
 * 解答を検証する（完全一致判定）
 * Phase 2 MVP: 正規化なし + 完全一致のみ
 * Phase 3 (Task 21): 全角半角・仮名揺れ対応を追加予定
 *
 * @param userInput ユーザーの入力
 * @param correctAnswers 正解パターンの配列
 * @param normalize 正規化を有効にするか（既定OFF）
 * @returns 正解かどうか
 */
export function validate(
  userInput: string,
  correctAnswers: string[],
  normalize: boolean = false,
): boolean {
  if (normalize) {
    const normalizedInput = normalizeAnswer(userInput)
    return correctAnswers.some(
      (answer) => normalizeAnswer(answer) === normalizedInput,
    )
  }

  // 正規化なし: 完全一致判定
  return correctAnswers.some((answer) => answer === userInput)
}

/**
 * 解答文字列を正規化する（trim + NFKC）
 * Phase 2 MVP では既定OFFだが、内部実装は用意しておく
 *
 * @param input 入力文字列
 * @returns 正規化された文字列
 */
export function normalizeAnswer(input: string): string {
  return input.trim().normalize('NFKC')
}
