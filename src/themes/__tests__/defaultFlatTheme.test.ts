/// <reference types="node" />

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const flatThemePath = resolve(process.cwd(), 'src/themes/default-flat.theme.css')
const flatTheme = existsSync(flatThemePath) ? readFileSync(flatThemePath, 'utf8') : ''
const defaultTheme = readFileSync(resolve(process.cwd(), 'src/themes/default.theme.css'), 'utf8')
const neumorphismTheme = readFileSync(
  resolve(process.cwd(), 'src/themes/neumorphism.theme.css'),
  'utf8',
)
const ROOT_SELECTOR = "[data-theme='default-flat']"
const PREVIEW_THEME_SCOPE = ":is(.card-shell, .zoom-layer)[data-theme='default-flat']"

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

function chromiumThemeColorLightness(hex: string): number {
  const [red, green, blue] =
    hex
      .slice(1)
      .match(/.{2}/g)
      ?.map((channel) => Number.parseInt(channel, 16)) ?? []

  if (red === undefined || green === undefined || blue === undefined) {
    throw new Error(`${hex} is not a hex color`)
  }

  return Math.floor((Math.max(red, green, blue) + Math.min(red, green, blue)) / 2) / 255
}

describe('default-flat theme', () => {
  it('テーマファイルを追加する', () => {
    expect(existsSync(flatThemePath)).toBe(true)
  })

  it('フラットテーマのメタ情報を定義する', () => {
    const tokens = tokenMap(ruleBody(flatTheme, ROOT_SELECTOR))

    expect(tokens.get('--theme-label')).toBe("'フラット'")
    expect(tokens.get('--theme-order')).toBe('1')
    expect(tokens.get('--theme-color')).toBe('#f3eee7')
  })

  it('Android Chromeが許容する明るさのブラウザUI色を使う', () => {
    const themeColor = tokenValue(flatTheme, '--theme-color')

    expect(chromiumThemeColorLightness(themeColor)).toBeLessThanOrEqual(0.94)
    expect(themeColor).not.toBe(tokenValue(flatTheme, '--surface-app'))
  })

  it('主要な面を単色にしてニューモーフィズムと区別する', () => {
    expect(tokenValue(flatTheme, '--surface-app')).toBe('#fffdf9')
    expect(tokenValue(flatTheme, '--header-bg')).toBe('#fffdf9')
    expect(tokenValue(flatTheme, '--gate-bg')).toBe('#fffdf9')
    expect(tokenValue(flatTheme, '--result-bg')).toBe('#fffdf9')
    expect(tokenValue(flatTheme, '--pedestal-bg')).toBe('transparent')
    expect(tokenValue(flatTheme, '--spotlight-glow')).toBe('none')
    expect(tokenValue(flatTheme, '--surface-app')).not.toBe(
      tokenValue(neumorphismTheme, '--surface-app'),
    )
    expect(tokenValue(flatTheme, '--surface-panel')).not.toBe(
      tokenValue(neumorphismTheme, '--surface-panel'),
    )
    expect(tokenValue(flatTheme, '--panel-border')).toBe('1px solid var(--color-line)')
    expect(tokenValue(flatTheme, '--panel-shadow')).toBe('0 0 rgba(0, 0, 0, 0)')
    expect(tokenValue(flatTheme, '--row-shadow')).toBe('none')
    expect(flatTheme).not.toContain('gradient(')
  })

  it('主要な文字色を明るいパネル上で4.5対1以上にする', () => {
    const tokens = tokenMap(ruleBody(flatTheme, ROOT_SELECTOR))
    const background = tokens.get('--surface-panel') ?? ''

    for (const token of [
      '--color-text-main',
      '--color-text-dim',
      '--color-accent',
      '--color-info',
      '--color-answer-correct',
      '--color-answer-wrong',
      '--color-error',
    ]) {
      expect(contrastRatio(tokens.get(token) ?? '', background), token).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('入力・トグル・スライダーを明るい面から3対1以上識別できる', () => {
    const tokens = tokenMap(ruleBody(flatTheme, ROOT_SELECTOR))
    const panel = tokens.get('--surface-panel') ?? ''

    for (const [token, background] of [
      ['--input-border-color', tokens.get('--input-bg') ?? ''],
      ['--toggle-track-border', panel],
      ['--toggle-knob', tokens.get('--toggle-track') ?? ''],
      ['--slider-track', panel],
    ]) {
      expect(contrastRatio(tokens.get(token) ?? '', background), token).toBeGreaterThanOrEqual(3)
    }
  })

  it('デフォルトが提供するroot tokenをすべて明示的に定義する', () => {
    const flatTokens = [...tokenMap(ruleBody(flatTheme, ROOT_SELECTOR)).keys()].sort()
    const defaultTokens = [
      ...tokenMap(ruleBody(defaultTheme, "[data-theme='default']")).keys(),
    ].sort()

    expect(flatTokens).toEqual(defaultTokens)
  })

  it('各種ボタンと設定UIを影のないフラットな面にする', () => {
    for (const token of [
      '--input-shadow',
      '--btn-primary-shadow',
      '--btn-replay-shadow',
      '--quiz-btn-text-shadow',
      '--quiz-btn-shadow',
      '--quiz-btn-shadow-pressed',
      '--quiz-btn-shadow-released',
      '--quiz-btn-shadow-disabled',
      '--pedestal-shadow',
      '--toggle-track-shadow',
      '--slider-thumb-shadow',
    ]) {
      expect(tokenValue(flatTheme, token), token).toBe('none')
    }

    expect(tokenValue(flatTheme, '--quiz-btn-face')).toBe('#e6402e')
    expect(tokenValue(flatTheme, '--pedestal-bg')).toBe('transparent')
    expect(tokenValue(flatTheme, '--pedestal-border')).toBe('1px solid var(--color-line)')
    expect(tokenValue(flatTheme, '--quiz-btn-disabled-filter')).toBe(
      'grayscale(0.65) brightness(0.9)',
    )
  })

  it('早押しボタンの太い外周をなくし1pxの枠線だけを付ける', () => {
    expect(ruleBody(flatTheme, "html[data-theme='default-flat'] .quiz-button")).toContain(
      'border: 1px solid #ad2f22',
    )
    expect(
      ruleBody(
        flatTheme,
        ":is(.card-shell, .zoom-layer)[data-theme='default-flat'] .p-quiz-button",
      ),
    ).toContain('border: 1px solid #ad2f22')
  })

  it('開始・戦績・解答・トグルに芥子色の役割を維持する', () => {
    expect(
      tokenMap(
        ruleBody(
          flatTheme,
          "html[data-theme='default-flat'] :is(.start-gate-action, .final-rate .pct)",
        ),
      ).get('--color-accent'),
    ).toBe('#9a6810')

    const previewSelectors = [...flatTheme.matchAll(/([^{}]+)\{[^{}]*\}/g)]
      .map((match) => match[1].trim())
      .filter((selector) => /\.p-(?:chips|panel|toggle-row)/.test(selector))

    expect(previewSelectors).toHaveLength(3)
    expect(previewSelectors.every((selector) => selector.includes(PREVIEW_THEME_SCOPE))).toBe(true)
  })
})
