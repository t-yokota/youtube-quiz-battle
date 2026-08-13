/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const themesDirectory = resolve(process.cwd(), 'src/themes')
const lightTheme = readFileSync(resolve(themesDirectory, 'light.theme.css'), 'utf8')
const darkTheme = readFileSync(resolve(themesDirectory, 'dark.theme.css'), 'utf8')
const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')

const ROOT_SELECTOR = "html,\n[data-theme='light']"
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
  it('クールアイボリーのブラウザUI色と明色面を定義する', () => {
    const tokens = tokenMap(ruleBody(lightTheme, ROOT_SELECTOR))

    expect(tokens.get('--theme-color')).toBe('#f0efec')
    expect(tokens.get('--surface-app')).toBe('#f6f6f4')
    expect(tokens.get('--surface-panel')).toBe('#ffffff')
    expect(tokens.get('--gate-bg')).toBe('#ffffff')
    expect(tokens.get('--result-bg')).toBe('#f6f6f4')
  })

  it('初期表示のtheme-colorをlightの背景色に揃える', () => {
    const themeColors = [...indexHtml.matchAll(/<meta name="theme-color" content="([^"]+)"/g)].map(
      (match) => match[1],
    )

    expect(themeColors).toEqual(['#f0efec'])
    expect(indexHtml).not.toMatch(/<meta name="theme-color"[^>]*\bmedia=/)
  })

  it('明るくした朱と白の組み合わせで4.5対1を維持する', () => {
    const tokens = tokenMap(ruleBody(lightTheme, ROOT_SELECTOR))
    const accent = tokens.get('--color-accent') ?? ''
    const onAccent = tokens.get('--color-on-accent') ?? ''

    expect(accent).toBe('#cf4933')
    expect(onAccent).toBe('#ffffff')
    expect(contrastRatio(accent, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(onAccent, accent)).toBeGreaterThanOrEqual(4.5)
  })

  it('正解と不正解を明色面で鮮やかにしながら4.5対1を維持する', () => {
    const rootTokens = tokenMap(ruleBody(lightTheme, ROOT_SELECTOR))
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
    const correct = '#178758'
    const wrong = '#cc4c39'

    expect(rootTokens.get('--color-answer-correct')).toBe(correct)
    expect(chipTokens.get('--color-answer-wrong')).toBe(wrong)
    expect(answerTokens.get('--color-answer-wrong')).toBe(wrong)
    expect(answerTokens.get('--color-urgent')).toBe(wrong)
    expect(contrastRatio(correct, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(wrong, '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  it('darkが提供するroot tokenをすべて明示的に定義する', () => {
    const lightTokens = [...tokenMap(ruleBody(lightTheme, ROOT_SELECTOR)).keys()].sort()
    const darkTokens = [...tokenMap(ruleBody(darkTheme, "[data-theme='dark']")).keys()].sort()

    expect(lightTokens).toEqual(darkTokens)
  })

  it('現在位置チップをリングではなくブラーで強調する', () => {
    const rootTokens = tokenMap(ruleBody(lightTheme, ROOT_SELECTOR))
    const chipTokens = tokenMap(
      ruleBody(
        lightTheme,
        `html[data-theme='light'] :is(.score-chips, .result-list),\n${PREVIEW_THEME_SCOPE} .p-chips`,
      ),
    )

    expect(rootTokens.get('--chip-current-glow')).toBe('0 0 0.375rem rgba(207, 73, 51, 0.35)')
    expect(rootTokens.get('--chip-current-correct-glow')).toBe(
      '0 0 0.375rem rgba(23, 135, 88, 0.35)',
    )
    expect(rootTokens.get('--chip-current-wrong-glow')).toBe(
      '0 0 0.375rem rgba(103, 86, 199, 0.35)',
    )
    expect(chipTokens.get('--chip-current-glow')).toBe('0 0 0.375rem rgba(229, 118, 19, 0.35)')
    expect(chipTokens.get('--chip-current-correct-glow')).toBe(
      '0 0 0.375rem rgba(23, 135, 88, 0.35)',
    )
    expect(chipTokens.get('--chip-current-wrong-glow')).toBe('0 0 0.375rem rgba(204, 76, 57, 0.35)')
  })

  it('ON時の早押しボタン外周をlightと同じブラーにする', () => {
    const releasedShadow =
      tokenMap(ruleBody(lightTheme, ROOT_SELECTOR)).get('--quiz-btn-shadow-released') ?? ''
    const outerGlow = '0 0 1.75rem 0.625rem rgba(200, 58, 42, 0.28)'

    expect(releasedShadow.endsWith(outerGlow)).toBe(true)
    expect(releasedShadow).not.toContain('0 0 0 0.375rem')
  })

  it('Result行・再プレイ・モーダルボタンに明色面向けのシャドウを付ける', () => {
    const rootTokens = tokenMap(ruleBody(lightTheme, ROOT_SELECTOR))
    const modalTokens = tokenMap(
      ruleBody(lightTheme, "html[data-theme='light'] :is(.modal-overlay, .dialog-overlay)"),
    )

    expect(rootTokens.get('--btn-replay-shadow')).toBe(
      '0 0.125rem 0.375rem rgba(125, 53, 40, 0.24)',
    )
    expect(rootTokens.get('--row-shadow')).toBe('0 0.0625rem 0.25rem rgba(40, 42, 46, 0.1)')
    expect(modalTokens.get('--btn-primary-shadow')).toBe(
      '0 0.125rem 0.375rem rgba(40, 42, 46, 0.16)',
    )
  })

  it('局所アクセントをlightの実画面とプレビューだけへ適用する', () => {
    const uiAccent = '#e57613'
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
    expect(answerTokens.get('--color-accent')).toBe(uiAccent)
    expect(answerTokens.get('--btn-primary-bg')).toBe(uiAccent)
    expect(answerTokens.get('--btn-primary-text')).toBe('#ffffff')
    expect(answerTokens.get('--btn-primary-shadow')).toBe(
      '0 0.125rem 0.375rem rgba(40, 42, 46, 0.16)',
    )
    expect(answerTokens.get('--panel-shadow')).toBe('0 0.125rem 0.375rem rgba(40, 42, 46, 0.06)')
    expect(toggleTokens.get('--color-accent')).toBe(uiAccent)
    expect(toggleTokens.get('--toggle-on-border')).toBe(uiAccent)
    expect(toggleTokens.get('--toggle-on-knob')).toBe(uiAccent)
    expect(contrastRatio(uiAccent, '#ffffff')).toBeGreaterThanOrEqual(3)

    const previewSelectors = [...lightTheme.matchAll(/([^{}]+)\{[^{}]*\}/g)]
      .map((match) => match[1].trim())
      .filter((selector) => /\.p-(?:chips|panel|toggle-row)/.test(selector))

    expect(previewSelectors).toHaveLength(3)
    expect(previewSelectors.every((selector) => selector.includes(PREVIEW_THEME_SCOPE))).toBe(true)
  })
})
