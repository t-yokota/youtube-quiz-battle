import { describe, it, expect } from 'vitest'
import { shouldHandleSpaceKey } from '../keyboardHandler'

// ============================================================================
// テストヘルパー
// ============================================================================

/**
 * KeyboardEvent をシミュレートして shouldHandleSpaceKey に渡す
 */
function makeEvent(
  code = 'Space',
  options: {
    repeat?: boolean
    altKey?: boolean
    ctrlKey?: boolean
    metaKey?: boolean
    target?: HTMLElement
  } = {},
): KeyboardEvent {
  const target = options.target ?? document.createElement('div')
  const event = new KeyboardEvent('keydown', {
    code,
    repeat: options.repeat ?? false,
    altKey: options.altKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    metaKey: options.metaKey ?? false,
    bubbles: true,
  })
  // target は readonly なので defineProperty で上書き
  Object.defineProperty(event, 'target', { value: target, writable: false })
  return event
}

// ============================================================================
// スペースキー早押し: 基本動作
// ============================================================================

describe('shouldHandleSpaceKey: 基本動作', () => {
  it('Space コードで通常の div が target のとき true を返す', () => {
    expect(shouldHandleSpaceKey(makeEvent('Space'))).toBe(true)
  })

  it('Space 以外のキー（Enter）では false を返す', () => {
    expect(shouldHandleSpaceKey(makeEvent('Enter'))).toBe(false)
  })

  it('Space 以外のキー（KeyA）では false を返す', () => {
    expect(shouldHandleSpaceKey(makeEvent('KeyA'))).toBe(false)
  })
})

// ============================================================================
// スペースキー早押し: repeat（長押し）の無視
// ============================================================================

describe('shouldHandleSpaceKey: キー長押しの無視', () => {
  it('repeat=true のとき false を返す', () => {
    expect(shouldHandleSpaceKey(makeEvent('Space', { repeat: true }))).toBe(false)
  })

  it('repeat=false のとき true を返す', () => {
    expect(shouldHandleSpaceKey(makeEvent('Space', { repeat: false }))).toBe(true)
  })
})

// ============================================================================
// スペースキー早押し: 修飾キー付きの無視
// ============================================================================

describe('shouldHandleSpaceKey: 修飾キー付きの無視', () => {
  it('altKey=true のとき false を返す', () => {
    expect(shouldHandleSpaceKey(makeEvent('Space', { altKey: true }))).toBe(false)
  })

  it('ctrlKey=true のとき false を返す', () => {
    expect(shouldHandleSpaceKey(makeEvent('Space', { ctrlKey: true }))).toBe(false)
  })

  it('metaKey=true のとき false を返す', () => {
    expect(shouldHandleSpaceKey(makeEvent('Space', { metaKey: true }))).toBe(false)
  })

  it('修飾キーなし（shiftKey のみ）では true を返す', () => {
    // shiftKey は除外対象でないため通す
    const event = new KeyboardEvent('keydown', {
      code: 'Space',
      shiftKey: true,
      bubbles: true,
    })
    const target = document.createElement('div')
    Object.defineProperty(event, 'target', { value: target, writable: false })
    expect(shouldHandleSpaceKey(event)).toBe(true)
  })
})

// ============================================================================
// 入力中の誤操作防止: フォーカス要素のチェック
// ============================================================================

describe('shouldHandleSpaceKey: input/textarea/contentEditable 入力中は無効化', () => {
  it('target が HTMLInputElement のとき false を返す', () => {
    const input = document.createElement('input')
    expect(shouldHandleSpaceKey(makeEvent('Space', { target: input }))).toBe(false)
  })

  it('target が HTMLTextAreaElement のとき false を返す', () => {
    const textarea = document.createElement('textarea')
    expect(shouldHandleSpaceKey(makeEvent('Space', { target: textarea }))).toBe(false)
  })

  it('target が contentEditable な div のとき false を返す', () => {
    const editable = document.createElement('div')
    // jsdom では contenteditable 属性を設定しても isContentEditable が true にならないため
    // Object.defineProperty でモックする
    Object.defineProperty(editable, 'isContentEditable', { value: true })
    expect(shouldHandleSpaceKey(makeEvent('Space', { target: editable }))).toBe(false)
  })

  it('contentEditable が false な div のとき true を返す', () => {
    const div = document.createElement('div')
    // isContentEditable のデフォルトは false なのでモック不要
    expect(shouldHandleSpaceKey(makeEvent('Space', { target: div }))).toBe(true)
  })
})

// ============================================================================
// ボタン・リンク・セレクト: 各要素の Space→click を妨げない
// ============================================================================

describe('shouldHandleSpaceKey: button/a/select フォーカス中は素通り', () => {
  it('target が HTMLButtonElement のとき false を返す（ボタン自身の click を妨げない）', () => {
    const button = document.createElement('button')
    expect(shouldHandleSpaceKey(makeEvent('Space', { target: button }))).toBe(false)
  })

  it('target が HTMLAnchorElement のとき false を返す', () => {
    const anchor = document.createElement('a')
    expect(shouldHandleSpaceKey(makeEvent('Space', { target: anchor }))).toBe(false)
  })

  it('target が HTMLSelectElement のとき false を返す', () => {
    const select = document.createElement('select')
    expect(shouldHandleSpaceKey(makeEvent('Space', { target: select }))).toBe(false)
  })

  it('QuizButton（button 要素）フォーカス中は false を返す（ブラウザの click 経路を優先）', () => {
    const quizButton = document.createElement('button')
    quizButton.className = 'quiz-button standby'
    expect(shouldHandleSpaceKey(makeEvent('Space', { target: quizButton }))).toBe(false)
  })

  it('モーダルの閉じるボタン（button 要素）フォーカス中は false を返す', () => {
    const closeButton = document.createElement('button')
    closeButton.className = 'close-button'
    expect(shouldHandleSpaceKey(makeEvent('Space', { target: closeButton }))).toBe(false)
  })
})

// ============================================================================
// 通常の div/section/main などは処理対象
// ============================================================================

describe('shouldHandleSpaceKey: 通常要素（ゲーム画面の背景等）は処理対象', () => {
  it('target が section のとき true を返す', () => {
    const section = document.createElement('section')
    expect(shouldHandleSpaceKey(makeEvent('Space', { target: section }))).toBe(true)
  })

  it('target が main のとき true を返す', () => {
    const main = document.createElement('main')
    expect(shouldHandleSpaceKey(makeEvent('Space', { target: main }))).toBe(true)
  })

  it('target が body のとき true を返す', () => {
    expect(shouldHandleSpaceKey(makeEvent('Space', { target: document.body }))).toBe(true)
  })
})
