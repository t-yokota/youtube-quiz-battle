/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const themesDirectory = resolve(process.cwd(), 'src/themes')
const light2Theme = readFileSync(resolve(themesDirectory, 'light-2.theme.css'), 'utf8')
const defaultTheme = readFileSync(resolve(themesDirectory, 'default.theme.css'), 'utf8')

const ROOT_SELECTOR = "[data-theme='light-2']"
const PREVIEW_THEME_SCOPE = ":is(.card-shell, .zoom-layer)[data-theme='light-2']"

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

describe('light-2テーマ', () => {
  it('クールアイボリーのブラウザUI色と明色面を定義する', () => {
    const tokens = tokenMap(ruleBody(light2Theme, ROOT_SELECTOR))

    expect(tokens.get('--theme-color')).toBe('#f0efec')
    expect(tokens.get('--surface-app')).toBe('#f6f6f4')
    expect(tokens.get('--surface-panel')).toBe('#ffffff')
    expect(tokens.get('--gate-bg')).toBe('#ffffff')
    expect(tokens.get('--result-bg')).toBe('#f6f6f4')
  })

  it('defaultが提供するroot tokenをすべて明示的に定義する', () => {
    const light2Tokens = [...tokenMap(ruleBody(light2Theme, ROOT_SELECTOR)).keys()].sort()
    const defaultTokens = [
      ...tokenMap(ruleBody(defaultTheme, "[data-theme='default']")).keys(),
    ].sort()

    expect(light2Tokens).toEqual(defaultTokens)
  })

  it('局所アクセントをlight-2の実画面とプレビューだけへ適用する', () => {
    const uiAccent = '#ef8118'
    const startTokens = tokenMap(
      ruleBody(light2Theme, "html[data-theme='light-2'] :is(.start-gate-action, .final-rate .pct)"),
    )
    const chipTokens = tokenMap(
      ruleBody(
        light2Theme,
        `html[data-theme='light-2'] :is(.score-chips, .result-list),\n${PREVIEW_THEME_SCOPE} .p-chips`,
      ),
    )
    const answerTokens = tokenMap(
      ruleBody(
        light2Theme,
        `html[data-theme='light-2'] .answer-area,\n${PREVIEW_THEME_SCOPE} .p-panel`,
      ),
    )
    const toggleTokens = tokenMap(
      ruleBody(
        light2Theme,
        `html[data-theme='light-2'] .check-toggle,\n${PREVIEW_THEME_SCOPE} .p-toggle-row`,
      ),
    )

    expect(startTokens.get('--color-accent')).toBe(uiAccent)
    expect(chipTokens.get('--color-accent')).toBe(uiAccent)
    expect(answerTokens.get('--color-accent')).toBe(uiAccent)
    expect(answerTokens.get('--btn-primary-bg')).toBe(uiAccent)
    expect(answerTokens.get('--btn-primary-text')).toBe('#2b1704')
    expect(toggleTokens.get('--color-accent')).toBe(uiAccent)
    expect(toggleTokens.get('--toggle-on-border')).toBe(uiAccent)
    expect(toggleTokens.get('--toggle-on-knob')).toBe(uiAccent)

    const previewSelectors = [...light2Theme.matchAll(/([^{}]+)\{[^{}]*\}/g)]
      .map((match) => match[1].trim())
      .filter((selector) => /\.p-(?:chips|panel|toggle-row)/.test(selector))

    expect(previewSelectors).toHaveLength(3)
    expect(previewSelectors.every((selector) => selector.includes(PREVIEW_THEME_SCOPE))).toBe(true)
  })
})
