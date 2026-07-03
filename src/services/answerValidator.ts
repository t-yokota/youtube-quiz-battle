// 解答検証サービス

// ひらがな（U+3041-3096）→ カタカナ への変換シフト量
const HIRAGANA_TO_KATAKANA_SHIFT = 0x60
const HIRAGANA_RANGE_START = 0x3041
const HIRAGANA_RANGE_END = 0x3096
// 繰り返し記号 ゝ(U+309D) ゞ(U+309E) → ヽ ヾ（同じ +0x60 シフトで変換できる）
const HIRAGANA_ITERATION_START = 0x309d
const HIRAGANA_ITERATION_END = 0x309e

// 長音記号の異体字（ー/―/－/ｰ）を「ー」に統一するための正規表現
const RE_CHOON_VARIANTS = /[ー―－ｰ]/g

// 日本語文字（ひらがな・カタカナ・漢字・半角カナ等）の存在検出用正規表現
// design.md L1229-1235 の RE_JP をそのまま使用
const RE_JP = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ｦ-ﾟ々〻ゝ-ゞヽ-ヾ]/u

/**
 * 解答を検証する
 * Phase 3 (Task 21): 正規化パイプラインを既定 ON 化
 *
 * @param userInput ユーザーの入力
 * @param correctAnswers 正解パターンの配列
 * @param normalize 正規化を有効にするか（既定ON）
 * @returns 正解かどうか
 */
export function validate(
  userInput: string,
  correctAnswers: string[],
  normalize: boolean = true,
): boolean {
  if (normalize) {
    const normalizedInput = normalizeAnswer(userInput)
    return correctAnswers.some((answer) => normalizeAnswer(answer) === normalizedInput)
  }

  // 正規化なし: 完全一致判定
  return correctAnswers.some((answer) => answer === userInput)
}

/**
 * 入力文字列に日本語文字が含まれるかを判定する
 *
 * @param s 判定対象文字列
 * @returns 日本語文字が含まれるか
 */
export function containsJapanese(s: string): boolean {
  const normalized = s.normalize('NFKC')
  return RE_JP.test(normalized)
}

/**
 * ひらがなをカタカナに変換する（ゝゞ含む）
 *
 * @param input 入力文字列
 * @returns カタカナ化された文字列
 */
function hiraganaToKatakana(input: string): string {
  return Array.from(input)
    .map((char) => {
      const codePoint = char.codePointAt(0)
      if (
        codePoint !== undefined &&
        ((codePoint >= HIRAGANA_RANGE_START && codePoint <= HIRAGANA_RANGE_END) ||
          (codePoint >= HIRAGANA_ITERATION_START && codePoint <= HIRAGANA_ITERATION_END))
      ) {
        return String.fromCodePoint(codePoint + HIRAGANA_TO_KATAKANA_SHIFT)
      }
      return char
    })
    .join('')
}

/**
 * 解答文字列を正規化する
 * パイプライン: NFKC → casefold → trim → (日本語含有時のみ)かな統一・長音統一
 *
 * @param input 入力文字列
 * @returns 正規化された文字列
 */
export function normalizeAnswer(input: string): string {
  const nfkcNormalized = input.normalize('NFKC')
  const caseFolded = nfkcNormalized.toLowerCase()
  const trimmed = caseFolded.trim()

  if (!containsJapanese(trimmed)) {
    return trimmed
  }

  const katakanaUnified = hiraganaToKatakana(trimmed)
  return katakanaUnified.replace(RE_CHOON_VARIANTS, 'ー')
}
