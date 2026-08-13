/// <reference types="node" />

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const flatThemePath = resolve(process.cwd(), 'src/themes/flat.theme.css')
const flatTheme = existsSync(flatThemePath) ? readFileSync(flatThemePath, 'utf8') : ''
const lightTheme = readFileSync(resolve(process.cwd(), 'src/themes/light.theme.css'), 'utf8')
const darkTheme = readFileSync(resolve(process.cwd(), 'src/themes/dark.theme.css'), 'utf8')
const neumorphismTheme = readFileSync(
  resolve(process.cwd(), 'src/themes/neumorphism.theme.css'),
  'utf8',
)
const ROOT_SELECTOR = "[data-theme='flat']"
const PREVIEW_THEME_SCOPE = ":is(.card-shell, .zoom-layer)[data-theme='flat']"

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

describe('flatテーマ', () => {
  it('テーマファイルを追加する', () => {
    expect(existsSync(flatThemePath)).toBe(true)
  })

  it('フラットテーマのブラウザUI色を定義する', () => {
    const tokens = tokenMap(ruleBody(flatTheme, ROOT_SELECTOR))

    expect(tokens.get('--theme-color')).toBe('#f0efec')
  })

  it('Android Chromeが許容する明るさのブラウザUI色を使う', () => {
    const themeColor = tokenValue(flatTheme, '--theme-color')

    expect(chromiumThemeColorLightness(themeColor)).toBeLessThanOrEqual(0.94)
    expect(themeColor).not.toBe(tokenValue(flatTheme, '--surface-app'))
  })

  it('主要な面を単色にしてニューモーフィズムと区別する', () => {
    expect(tokenValue(flatTheme, '--surface-app')).toBe('#ffffff')
    expect(tokenValue(flatTheme, '--surface-panel')).toBe('#ffffff')
    expect(tokenValue(flatTheme, '--header-bg')).toBe('#ffffff')
    expect(tokenValue(flatTheme, '--gate-bg')).toBe('#ffffff')
    expect(tokenValue(flatTheme, '--result-bg')).toBe('#ffffff')
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

  it('darkが提供するroot tokenをすべて明示的に定義する', () => {
    const flatTokens = [...tokenMap(ruleBody(flatTheme, ROOT_SELECTOR)).keys()].sort()
    const darkTokens = [...tokenMap(ruleBody(darkTheme, "[data-theme='dark']")).keys()].sort()

    expect(flatTokens).toEqual(darkTokens)
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
    expect(ruleBody(flatTheme, "html[data-theme='flat'] .quiz-button")).toContain(
      'border: 1px solid #ad2f22',
    )
    expect(
      ruleBody(flatTheme, ":is(.card-shell, .zoom-layer)[data-theme='flat'] .p-quiz-button"),
    ).toContain('border: 1px solid #ad2f22')
  })

  it('ベースの朱を明るい面向けの色に揃える', () => {
    const tokens = tokenMap(ruleBody(flatTheme, ROOT_SELECTOR))

    expect(tokens.get('--color-accent')).toBe('#cf4933')
    expect(tokens.get('--color-accent-hover')).toBe('#b83e2c')
    expect(tokens.get('--color-on-accent')).toBe('#ffffff')
    expect(tokens.get('--toggle-on-track')).toBe('rgba(207, 73, 51, 0.15)')
  })

  it('戦績チップの現在位置をグローのない細い外周線で囲む', () => {
    const rootTokens = tokenMap(ruleBody(flatTheme, ROOT_SELECTOR))
    const chipTokens = tokenMap(
      ruleBody(
        flatTheme,
        `html[data-theme='flat'] :is(.score-chips, .result-list),\n${PREVIEW_THEME_SCOPE} .p-chips`,
      ),
    )

    expect(rootTokens.get('--chip-current-glow')).toBe(
      'inset 0 0 0 0.0625rem rgba(207, 73, 51, 0.25), 0 0 0 0.09375rem rgba(207, 73, 51, 0.25)',
    )
    expect(rootTokens.get('--chip-current-correct-glow')).toBe(
      'inset 0 0 0 0.0625rem rgba(23, 135, 88, 0.25), 0 0 0 0.09375rem rgba(23, 135, 88, 0.25)',
    )
    expect(rootTokens.get('--chip-current-wrong-glow')).toBe(
      'inset 0 0 0 0.0625rem rgba(103, 86, 199, 0.25), 0 0 0 0.09375rem rgba(103, 86, 199, 0.25)',
    )
    expect(chipTokens.get('--chip-current-glow')).toBe(
      'inset 0 0 0 0.0625rem rgba(229, 118, 19, 0.25), 0 0 0 0.09375rem rgba(229, 118, 19, 0.25)',
    )
    expect(chipTokens.get('--chip-current-correct-glow')).toBe(
      'inset 0 0 0 0.0625rem rgba(23, 135, 88, 0.25), 0 0 0 0.09375rem rgba(23, 135, 88, 0.25)',
    )
    expect(chipTokens.get('--chip-current-wrong-glow')).toBe(
      'inset 0 0 0 0.0625rem rgba(204, 76, 57, 0.25), 0 0 0 0.09375rem rgba(204, 76, 57, 0.25)',
    )
  })

  it('新しいlightの中立パレットと正解色を取り込む', () => {
    for (const token of [
      '--theme-color',
      '--color-text-main',
      '--color-text-dim',
      '--color-placeholder',
      '--color-line',
      '--color-accent',
      '--color-accent-hover',
      '--color-on-accent',
      '--color-info',
      '--color-answer-correct',
      '--color-answer-wrong',
      '--color-error',
      '--color-urgent',
      '--surface-raised',
      '--overlay-bg',
      '--input-bg',
      '--input-border-color',
      '--input-focus-border-color',
      '--input-focus-shadow',
      '--btn-primary-bg',
      '--btn-primary-bg-hover',
      '--btn-primary-text',
      '--btn-replay-bg',
      '--btn-replay-bg-hover',
      '--btn-replay-text',
      '--chip-correct-bg',
      '--toggle-track',
      '--toggle-knob',
      '--timer-track',
      '--banner-correct-bg',
      '--flash-correct-glow',
    ]) {
      expect(tokenValue(flatTheme, token), token).toBe(tokenValue(lightTheme, token))
    }

    expect(tokenValue(flatTheme, '--toggle-track-border')).toBe('#8f9095')
    expect(tokenValue(flatTheme, '--slider-track')).toBe('#8f9095')
  })

  it('芥子色の局所役割をオレンジ寄りにしてflatの実画面とプレビューだけへ適用する', () => {
    const uiAccent = '#e57613'
    const startTokens = tokenMap(
      ruleBody(flatTheme, "html[data-theme='flat'] :is(.start-gate-action, .final-rate .pct)"),
    )
    const chipTokens = tokenMap(
      ruleBody(
        flatTheme,
        `html[data-theme='flat'] :is(.score-chips, .result-list),\n${PREVIEW_THEME_SCOPE} .p-chips`,
      ),
    )
    const answerTokens = tokenMap(
      ruleBody(flatTheme, `html[data-theme='flat'] .answer-area,\n${PREVIEW_THEME_SCOPE} .p-panel`),
    )
    const toggleTokens = tokenMap(
      ruleBody(
        flatTheme,
        `html[data-theme='flat'] .check-toggle,\n${PREVIEW_THEME_SCOPE} .p-toggle-row`,
      ),
    )

    expect(startTokens.get('--color-accent')).toBe(uiAccent)
    expect(chipTokens.get('--color-accent')).toBe(uiAccent)
    expect(chipTokens.get('--color-answer-wrong')).toBe('#cc4c39')
    expect(answerTokens.get('--color-accent')).toBe(uiAccent)
    expect(answerTokens.get('--color-answer-wrong')).toBe('#cc4c39')
    expect(answerTokens.get('--color-urgent')).toBe('#cc4c39')
    expect(answerTokens.get('--btn-primary-bg')).toBe(uiAccent)
    expect(answerTokens.get('--btn-primary-bg-hover')).toBe('#f28f2f')
    expect(answerTokens.get('--btn-primary-text')).toBe('#ffffff')
    expect(toggleTokens.get('--color-accent')).toBe(uiAccent)
    expect(toggleTokens.get('--toggle-on-track')).toBe('rgba(229, 118, 19, 0.16)')
    expect(toggleTokens.get('--toggle-on-border')).toBe(uiAccent)
    expect(toggleTokens.get('--toggle-on-knob')).toBe(uiAccent)

    const previewSelectors = [...flatTheme.matchAll(/([^{}]+)\{[^{}]*\}/g)]
      .map((match) => match[1].trim())
      .filter((selector) => /\.p-(?:chips|panel|toggle-row)/.test(selector))

    expect(previewSelectors).toHaveLength(3)
    expect(previewSelectors.every((selector) => selector.includes(PREVIEW_THEME_SCOPE))).toBe(true)
  })
})
