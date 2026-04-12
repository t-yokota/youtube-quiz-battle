import { describe, it, expect } from 'vitest'
import { validate, normalizeAnswer } from '../answerValidator'

// ============================================================================
// validate(): 完全一致判定
// ============================================================================

describe('validate: 完全一致判定（正規化なし）', () => {
  it('正解パターンと一致する場合は true を返す', () => {
    expect(validate('東京', ['東京'])).toBe(true)
  })

  it('正解パターンと一致しない場合は false を返す', () => {
    expect(validate('大阪', ['東京'])).toBe(false)
  })

  it('空文字列は不正解', () => {
    expect(validate('', ['東京'])).toBe(false)
  })

  it('空白を含む入力は完全一致しない（trim なし）', () => {
    expect(validate(' 東京', ['東京'])).toBe(false)
    expect(validate('東京 ', ['東京'])).toBe(false)
  })

  it('大文字小文字は区別する', () => {
    expect(validate('tokyo', ['Tokyo'])).toBe(false)
    expect(validate('Tokyo', ['Tokyo'])).toBe(true)
  })

  it('全角数字と半角数字は区別する（正規化なし）', () => {
    expect(validate('１２３', ['123'])).toBe(false)
    expect(validate('123', ['123'])).toBe(true)
  })
})

// ============================================================================
// validate(): 複数正解パターン対応
// ============================================================================

describe('validate: 複数正解パターン', () => {
  it('いずれかのパターンと一致すれば true', () => {
    expect(validate('富士山', ['富士山', 'ふじさん', 'Mt.Fuji'])).toBe(true)
    expect(validate('ふじさん', ['富士山', 'ふじさん', 'Mt.Fuji'])).toBe(true)
    expect(validate('Mt.Fuji', ['富士山', 'ふじさん', 'Mt.Fuji'])).toBe(true)
  })

  it('どのパターンとも一致しなければ false', () => {
    expect(validate('フジサン', ['富士山', 'ふじさん', 'Mt.Fuji'])).toBe(false)
  })

  it('空配列は常に false', () => {
    expect(validate('東京', [])).toBe(false)
  })

  it('正解配列の1番目のみが正解の場合', () => {
    expect(validate('東京', ['東京', '京東'])).toBe(true)
    expect(validate('京東', ['東京', '京東'])).toBe(true)
    expect(validate('大阪', ['東京', '京東'])).toBe(false)
  })
})

// ============================================================================
// validate(): 正規化あり（normalize=true）
// ============================================================================

describe('validate: 正規化あり（normalize=true）', () => {
  it('前後の空白をtrimして一致する', () => {
    expect(validate(' 東京 ', ['東京'], true)).toBe(true)
  })

  it('NFKC正規化で全角英数が半角と一致する', () => {
    expect(validate('Ａ', ['A'], true)).toBe(true)
    expect(validate('１２３', ['123'], true)).toBe(true)
  })

  it('正規化しても一致しない場合は false', () => {
    expect(validate('大阪', ['東京'], true)).toBe(false)
  })

  it('正規化なしでは一致しない入力でも、正規化ありなら一致する', () => {
    expect(validate(' 東京 ', ['東京'], false)).toBe(false)
    expect(validate(' 東京 ', ['東京'], true)).toBe(true)
  })
})

// ============================================================================
// normalizeAnswer()
// ============================================================================

describe('normalizeAnswer', () => {
  it('前後の空白を除去する', () => {
    expect(normalizeAnswer('  東京  ')).toBe('東京')
  })

  it('NFKC正規化: 全角英字を半角に変換する', () => {
    expect(normalizeAnswer('Ａ')).toBe('A')
  })

  it('NFKC正規化: 全角数字を半角に変換する', () => {
    expect(normalizeAnswer('１２３')).toBe('123')
  })

  it('NFKC正規化: 半角カタカナを全角カタカナに変換する', () => {
    expect(normalizeAnswer('ｱｲｳ')).toBe('アイウ')
  })

  it('変換対象がなければ入力をそのまま返す', () => {
    expect(normalizeAnswer('東京')).toBe('東京')
  })
})
