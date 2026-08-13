/// <reference types="node" />

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const themesDirectory = resolve(process.cwd(), 'src/themes')
const lightThemePath = resolve(themesDirectory, 'light.theme.css')
const lightTheme = existsSync(lightThemePath) ? readFileSync(lightThemePath, 'utf8') : ''
const flatTheme = readFileSync(resolve(themesDirectory, 'flat.theme.css'), 'utf8')
const defaultTheme = readFileSync(resolve(themesDirectory, 'default.theme.css'), 'utf8')

const ROOT_SELECTOR = "[data-theme='light']"
const PREVIEW_THEME_SCOPE = ":is(.card-shell, .zoom-layer)[data-theme='light']"

function ruleBody(css: string, selector: string): string {
  const ruleStart = css.indexOf(`${selector} {`)
  if (ruleStart < 0) throw new Error(`${selector} is not defined`)

  const bodyStart = css.indexOf('{', ruleStart) + 1
  const bodyEnd = css.indexOf('\n}', bodyStart)
  if (bodyEnd < 0) throw new Error(`${selector} is not closed`)

  return css.slice(bodyStart, bodyEnd)
}

function tokenMap(rule: string): Map<string, string> {
  return new Map(
    [...rule.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [
      match[1],
      match[2].replace(/\s+/g, ' ').trim(),
    ]),
  )
}

function tokenValue(css: string, token: string): string {
  const value = css.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]
  if (!value) throw new Error(`${token} is not defined`)
  return value.replace(/\s+/g, ' ').trim()
}

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))

  if (!channels || channels.length !== 3) throw new Error(`${hex} is not a hex color`)
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function contrastRatio(foreground: string, background: string): number {
  const values = [relativeLuminance(foreground), relativeLuminance(background)]
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05)
}

describe('lightテーマ', () => {
  it('テーマファイルとブラウザUI色を追加する', () => {
    expect(existsSync(lightThemePath)).toBe(true)
    const tokens = tokenMap(ruleBody(lightTheme, ROOT_SELECTOR))

    expect(tokens.get('--theme-color')).toBe('#eee8df')
  })

  it('flatの明色パレットとアクセント以外のセマンティックカラーを引き継ぐ', () => {
    for (const token of [
      '--color-text-main',
      '--color-text-dim',
      '--color-placeholder',
      '--color-line',
      '--color-on-accent',
      '--color-info',
      '--color-answer-correct',
      '--color-answer-wrong',
      '--color-error',
      '--color-urgent',
      '--surface-panel',
      '--surface-raised',
    ]) {
      expect(tokenValue(lightTheme, token), token).toBe(tokenValue(flatTheme, token))
    }
  })

  it('ベースの朱をdefault寄りに明るくしつつ可読性を維持する', () => {
    const tokens = tokenMap(ruleBody(lightTheme, ROOT_SELECTOR))
    const accent = tokens.get('--color-accent') ?? ''

    expect(accent).toBe('#cc4933')
    expect(tokens.get('--color-accent-hover')).toBe('#b83e2c')
    expect(tokens.get('--chip-current-glow')).toBe('0 0 0.375rem rgba(204, 73, 51, 0.35)')
    expect(tokens.get('--toggle-on-track')).toBe('rgba(204, 73, 51, 0.15)')
    expect(contrastRatio(accent, '#fffdf9')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#fffdf9', accent)).toBeGreaterThanOrEqual(4.5)
  })

  it('開始ゲートをパネル色に揃え、ゲーム・Result背景だけを少し暗くする', () => {
    const panel = tokenValue(lightTheme, '--surface-panel')

    expect(panel).toBe('#fffdf9')
    expect(tokenValue(lightTheme, '--surface-app')).toBe('#faf7f2')
    expect(tokenValue(lightTheme, '--gate-bg')).toBe(panel)
    expect(tokenValue(lightTheme, '--result-bg')).toBe('#faf7f2')
    expect(tokenValue(lightTheme, '--pedestal-bg')).toContain('#faf7f2')
    expect(contrastRatio(panel, '#faf7f2')).toBeGreaterThan(1)
    expect(contrastRatio(panel, '#faf7f2')).toBeLessThan(1.1)
  })

  it('画面背景にはグラデーションとスポットライトを付けない', () => {
    for (const token of ['--surface-app', '--gate-bg', '--result-bg']) {
      expect(tokenValue(lightTheme, token), token).not.toContain('gradient(')
    }
    expect(tokenValue(lightTheme, '--spotlight-glow')).toBe('none')
  })

  it('早押しボタンと台座の立体感を明色向けに備える', () => {
    for (const token of ['--quiz-btn-face', '--pedestal-bg']) {
      expect(tokenValue(lightTheme, token), token).toContain('gradient(')
    }

    for (const token of [
      '--row-shadow',
      '--btn-replay-shadow',
      '--quiz-btn-shadow',
      '--quiz-btn-shadow-pressed',
      '--quiz-btn-shadow-released',
      '--quiz-btn-shadow-disabled',
    ]) {
      expect(tokenValue(lightTheme, token), token).not.toBe('none')
      expect(tokenValue(lightTheme, token), token).not.toBe('0 0 rgba(0, 0, 0, 0)')
    }
  })

  it('ヘッダーには背景グラデーションを付けない', () => {
    expect(tokenValue(lightTheme, '--header-bg')).toBe('none')
  })

  it('通常パネルと早押しボタンの台座にはシャドウを付けない', () => {
    expect(tokenValue(lightTheme, '--panel-shadow')).toBe('none')
    expect(tokenValue(lightTheme, '--pedestal-shadow')).toBe('none')
  })

  it('モーダルなどのprimaryボタンにはシャドウを付けない', () => {
    expect(tokenValue(lightTheme, '--btn-primary-shadow')).toBe('none')
  })

  it('設定UIの非選択部分を明るい面になじむ淡い色へ揃える', () => {
    expect(tokenValue(lightTheme, '--toggle-track-border')).toBe('#d3c8be')
    expect(tokenValue(lightTheme, '--toggle-track-shadow')).toBe(
      'inset 0 1px 2px rgba(63, 49, 38, 0.08)',
    )
    expect(tokenValue(lightTheme, '--slider-track')).toBe('#c5b9ae')
    expect(tokenValue(lightTheme, '--slider-thumb-shadow')).toBe(
      '0 0.125rem 0.375rem rgba(63, 49, 38, 0.16)',
    )
    expect(tokenValue(lightTheme, '--input-border-color')).toBe('#978a7e')
    expect(tokenValue(lightTheme, '--toggle-knob')).toBe('#6b6259')
  })

  it('早押しボタンの太い外周を1pxの枠線へ置き換える', () => {
    expect(ruleBody(lightTheme, "html[data-theme='light'] .quiz-button")).toContain(
      'border: 1px solid #ad2f22',
    )
    expect(
      ruleBody(lightTheme, ":is(.card-shell, .zoom-layer)[data-theme='light'] .p-quiz-button"),
    ).toContain('border: 1px solid #ad2f22')

    for (const token of [
      '--quiz-btn-shadow',
      '--quiz-btn-shadow-pressed',
      '--quiz-btn-shadow-released',
      '--quiz-btn-shadow-disabled',
    ]) {
      expect(tokenValue(lightTheme, token), token).not.toContain('0 0 0 0.3125rem')
    }
  })

  it('早押しボタン各状態のinsetシャドウを細くする', () => {
    expect(tokenValue(lightTheme, '--quiz-btn-shadow-pressed')).toContain(
      'inset 0 0 0.875rem rgba(105, 34, 24, 0.3)',
    )
    expect(tokenValue(lightTheme, '--quiz-btn-shadow-released')).toContain(
      'inset 0 0 0.5rem rgba(105, 34, 24, 0.2)',
    )
    expect(tokenValue(lightTheme, '--quiz-btn-shadow-disabled')).toBe(
      'inset 0 0 0.875rem rgba(105, 34, 24, 0.3)',
    )
  })

  it('明るいパネル上で主要文字色のコントラストを維持する', () => {
    const tokens = tokenMap(ruleBody(lightTheme, ROOT_SELECTOR))
    const panel = tokens.get('--surface-panel') ?? ''

    for (const token of [
      '--color-text-main',
      '--color-text-dim',
      '--color-accent',
      '--color-info',
      '--color-answer-correct',
      '--color-answer-wrong',
      '--color-error',
    ]) {
      expect(contrastRatio(tokens.get(token) ?? '', panel), token).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('defaultが提供するroot tokenをすべて明示的に定義する', () => {
    const lightTokens = [...tokenMap(ruleBody(lightTheme, ROOT_SELECTOR)).keys()].sort()
    const defaultTokens = [
      ...tokenMap(ruleBody(defaultTheme, "[data-theme='default']")).keys(),
    ].sort()

    expect(lightTokens).toEqual(defaultTokens)
  })

  it('芥子色の局所役割をオレンジ寄りにしてlightの実画面とプレビューだけへ適用する', () => {
    const uiAccent = '#b87312'
    const startTokens = tokenMap(
      ruleBody(lightTheme, "html[data-theme='light'] :is(.start-gate-action, .final-rate .pct)"),
    )
    const chipTokens = tokenMap(
      ruleBody(
        lightTheme,
        `html[data-theme='light'] :is(.score-chips, .result-list),\n${PREVIEW_THEME_SCOPE} .p-chips`,
      ),
    )
    const answerTokens = tokenMap(
      ruleBody(
        lightTheme,
        `html[data-theme='light'] .answer-area,\n${PREVIEW_THEME_SCOPE} .p-panel`,
      ),
    )
    const toggleTokens = tokenMap(
      ruleBody(
        lightTheme,
        `html[data-theme='light'] .check-toggle,\n${PREVIEW_THEME_SCOPE} .p-toggle-row`,
      ),
    )

    expect(startTokens.get('--color-accent')).toBe(uiAccent)
    expect(chipTokens.get('--color-accent')).toBe(uiAccent)
    expect(chipTokens.get('--chip-current-glow')).toBe('0 0 0.375rem rgba(233, 112, 18, 0.35)')
    expect(chipTokens.get('--chip-current-wrong-glow')).toBe(
      '0 0 0.375rem rgba(179, 63, 48, 0.35)',
    )
    expect(answerTokens.get('--color-accent')).toBe(uiAccent)
    expect(answerTokens.get('--btn-primary-bg')).toBe(uiAccent)
    expect(answerTokens.get('--btn-primary-bg-hover')).toBe('#bd7713')
    expect(answerTokens.get('--btn-primary-text')).toBe('#fffdf9')
    expect(toggleTokens.get('--color-accent')).toBe(uiAccent)
    expect(toggleTokens.get('--toggle-on-track')).toBe('rgba(184, 115, 18, 0.14)')
    expect(toggleTokens.get('--toggle-on-border')).toBe(uiAccent)
    expect(toggleTokens.get('--toggle-on-knob')).toBe(uiAccent)
    expect(contrastRatio(uiAccent, '#fffdf9')).toBeGreaterThanOrEqual(3)

    const previewSelectors = [...lightTheme.matchAll(/([^{}]+)\{[^{}]*\}/g)]
      .map((match) => match[1].trim())
      .filter((selector) => /\.p-(?:chips|panel|toggle-row)/.test(selector))

    expect(previewSelectors).toHaveLength(3)
    expect(previewSelectors.every((selector) => selector.includes(PREVIEW_THEME_SCOPE))).toBe(true)
  })
})
