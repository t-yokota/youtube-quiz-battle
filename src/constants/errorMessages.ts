// エラーメッセージ定義（design.md L1849-1858 を移植）

export const ERROR_MESSAGES = {
  YOUTUBE_LOAD_FAILED: 'YouTube動画の読み込みに失敗しました。ページを再読み込みしてください。',
  AUDIO_LOAD_FAILED: '音声ファイルの読み込みに失敗しました。ページを再読み込みしてください。',
  IMAGE_LOAD_FAILED: '画像ファイルの読み込みに失敗しました。ページを再読み込みしてください。',
  QUIZ_DATA_LOAD_FAILED: 'クイズデータの読み込みに失敗しました。ページを再読み込みしてください。',
  QUIZ_DATA_NOT_FOUND: 'URLの指定が正しいか確認してください。',
  QUIZ_DATA_INVALID: 'クイズデータの形式が正しくありません。ページを再読み込みしてください。',
  NETWORK_ERROR: 'ネットワークエラーが発生しました。接続を確認してページを再読み込みしてください。',
  GENERIC_ERROR: 'エラーが発生しました。ページを再読み込みしてください。',
} as const

/**
 * エラーダイアログの見出し（コード別。未定義のコードは DEFAULT_ERROR_TITLE）
 */
export const DEFAULT_ERROR_TITLE = 'エラーが発生しました'

export const ERROR_TITLES: Partial<Record<keyof typeof ERROR_MESSAGES, string>> = {
  QUIZ_DATA_NOT_FOUND: 'クイズが見つかりません',
  NETWORK_ERROR: 'ネットワークエラー',
}
