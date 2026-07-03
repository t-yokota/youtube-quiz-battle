import { describe, it, expect } from 'vitest'
import { validate, normalizeAnswer, containsJapanese } from '../answerValidator'

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
    expect(validate(' 東京', ['東京'], false)).toBe(false)
    expect(validate('東京 ', ['東京'], false)).toBe(false)
  })

  it('大文字小文字は区別する', () => {
    expect(validate('tokyo', ['Tokyo'], false)).toBe(false)
    expect(validate('Tokyo', ['Tokyo'])).toBe(true)
  })

  it('全角数字と半角数字は区別する（正規化なし）', () => {
    expect(validate('１２３', ['123'], false)).toBe(false)
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
    expect(validate('フジサン', ['富士山', 'ふじさん', 'Mt.Fuji'], false)).toBe(false)
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

  it('NFKC正規化 + casefold: 全角英字を半角小文字に変換する', () => {
    expect(normalizeAnswer('Ａ')).toBe('a')
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

// ============================================================================
// Task 21-2: 表記揺れ正規化マトリクス
// ============================================================================

describe('normalizeAnswer: 表記揺れマトリクス', () => {
  it.each([
    ['ひらがな→カタカナ', 'とうきょう', 'トウキョウ'],
    ['カタカナ→ひらがな相当（双方向一致）', 'トウキョウ', 'トウキョウ'],
    ['半角カナ→全角カタカナ', 'ﾄｳｷｮｳ', 'トウキョウ'],
    ['全角英字→半角小文字', 'ｔｏｋｙｏ', 'tokyo'],
    ['全角数字→半角数字', '１２３', '123'],
    ['大文字→小文字', 'TOKYO', 'tokyo'],
  ])('%s: normalizeAnswer(%s) === %s', (_label, input, expected) => {
    expect(normalizeAnswer(input)).toBe(expected)
  })

  it('ひらがな⇔カタカナは双方向で一致する', () => {
    expect(normalizeAnswer('とうきょう')).toBe(normalizeAnswer('トウキョウ'))
  })

  it('半角カナは全角カタカナと一致する', () => {
    expect(normalizeAnswer('ﾄｳｷｮｳ')).toBe(normalizeAnswer('トウキョウ'))
  })

  it('全角英数は半角英数と一致する', () => {
    expect(normalizeAnswer('ｔｏｋｙｏ')).toBe(normalizeAnswer('tokyo'))
    expect(normalizeAnswer('１２３')).toBe(normalizeAnswer('123'))
  })

  it('大文字小文字は区別せず一致する', () => {
    expect(normalizeAnswer('TOKYO')).toBe(normalizeAnswer('tokyo'))
  })

  it('前後の全角空白/半角空白はtrimされ一致するが、内部空白は保持され別語として扱われる', () => {
    expect(normalizeAnswer('　東京　')).toBe(normalizeAnswer(' 東京 '))
    expect(normalizeAnswer('　東京　')).toBe('東京')
    expect(normalizeAnswer('東 京')).not.toBe(normalizeAnswer('東京'))
  })

  // 「－」(全角ハイフンマイナス U+FF0D) は NFKC で半角化される前に長音統一される
  // （日本語含有入力のみの前処理。Task 21-2 で発見したギャップの修正）
  it.each([['ー'], ['―'], ['－'], ['ｰ']])(
    '長音異体「%s」はすべて「ー」に統一され一致する',
    (choon) => {
      expect(normalizeAnswer(`ラ${choon}メン`)).toBe('ラーメン')
    },
  )

  it('日本語を含まない入力では全角ハイフン「－」はハイフンとして扱われる（長音化しない）', () => {
    expect(normalizeAnswer('１－２')).toBe('1-2')
  })

  it('長音異体（ー/―/ｰ）は相互に一致する', () => {
    expect(normalizeAnswer('ラーメン')).toBe(normalizeAnswer('ラ―メン'))
    expect(normalizeAnswer('ラ―メン')).toBe(normalizeAnswer('ラｰメン'))
  })

  it('繰り返し記号（ゝ/ヽ）はカタカナに統一され一致する', () => {
    expect(normalizeAnswer('こゝろ')).toBe(normalizeAnswer('コヽロ'))
  })

  it('日本語を含まない入力はかな変換が走らない（NFKC+casefold+trimのみ）', () => {
    expect(normalizeAnswer('abc')).toBe('abc')
    expect(normalizeAnswer('ABC')).toBe('abc')
    expect(normalizeAnswer('  ABC  ')).toBe('abc')
    expect(normalizeAnswer('123')).toBe('123')
  })

  it('「っ」と「つ」は区別され一致しない（V3裁定の固定）', () => {
    expect(normalizeAnswer('きって')).not.toBe(normalizeAnswer('きつて'))
    expect(validate('きって', ['きつて'])).toBe(false)
  })

  it('漢字は正規化で変化しない', () => {
    expect(normalizeAnswer('東京都')).toBe('東京都')
    expect(normalizeAnswer('富士山')).toBe('富士山')
  })
})

describe('containsJapanese', () => {
  it('ひらがな・カタカナ・漢字を含む場合は true', () => {
    expect(containsJapanese('とうきょう')).toBe(true)
    expect(containsJapanese('トウキョウ')).toBe(true)
    expect(containsJapanese('東京')).toBe(true)
  })

  it('半角カナのみの場合も true（NFKC正規化後に判定するため）', () => {
    expect(containsJapanese('ﾄｳｷｮｳ')).toBe(true)
  })

  it('英数字のみの場合は false', () => {
    expect(containsJapanese('tokyo')).toBe(false)
    expect(containsJapanese('123')).toBe(false)
    expect(containsJapanese('Tokyo123')).toBe(false)
  })

  it('日本語と英数字が混在する場合は true', () => {
    expect(containsJapanese('東京tokyo')).toBe(true)
    expect(containsJapanese('Mt.富士')).toBe(true)
  })

  it('空文字列は false', () => {
    expect(containsJapanese('')).toBe(false)
  })
})
