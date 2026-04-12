/**
 * スペースキーのグローバルキーボードハンドラ判定ユーティリティ
 *
 * KeyboardEvent を受け取り、アプリとしてスペースキー早押しとして処理すべきかを判定する。
 * フォーカス要素への入力・操作を妨げないために次のケースでは false を返す:
 *   - Space 以外のキー
 *   - キー長押しによる repeat イベント
 *   - Alt / Ctrl / Meta 修飾キー付き（OS/ブラウザショートカット優先）
 *   - input / textarea / contentEditable フォーカス中（文字入力中）
 *   - button / a / select フォーカス中（各要素の Space→click 動作を妨げない）
 */
export function shouldHandleSpaceKey(e: KeyboardEvent): boolean {
  if (e.code !== 'Space') return false
  if (e.repeat) return false
  if (e.altKey || e.ctrlKey || e.metaKey) return false

  const target = e.target as HTMLElement
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable ||
    target instanceof HTMLButtonElement ||
    target instanceof HTMLAnchorElement ||
    target instanceof HTMLSelectElement
  ) {
    return false
  }

  return true
}
