/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const defaultTheme = readFileSync(resolve(process.cwd(), 'src/themes/default.theme.css'), 'utf8')
const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
const ROOT_SELECTOR = "html,\n[data-theme='default']"
const PREVIEW_THEME_SCOPE = ":is(.card-shell, .zoom-layer)[data-theme='default']"

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

function expectOverrides(selector: string, expected: Record<string, string>): void {
  expect(Object.fromEntries(tokenMap(ruleBody(defaultTheme, selector)))).toEqual(expected)
}

describe('default theme', () => {
  const rootTokens = tokenMap(ruleBody(defaultTheme, ROOT_SELECTOR))

  it('デフォルトの基本配色とメタ情報を定義する', () => {
    expect(rootTokens.get('--theme-label')).toBe("'デフォルト'")
    expect(rootTokens.get('--theme-order')).toBe('0')
    expect(rootTokens.get('--theme-color')).toBe('#14171a')
    expect(rootTokens.get('--color-accent')).toBe('#ff6b4f')
    expect(rootTokens.get('--color-answer-wrong')).toBe('#8b7cff')
    expect(rootTokens.get('--color-error')).toBe('#e6402e')
    expect(rootTokens.get('--btn-replay-bg')).toBe('#e6402e')
  })

  it('初期表示のtheme-colorをdefaultの背景色に揃える', () => {
    const themeColors = [...indexHtml.matchAll(/<meta name="theme-color" content="([^"]+)"/g)].map(
      (match) => match[1],
    )

    expect(themeColors).toEqual(['#14171a'])
    expect(indexHtml).not.toMatch(/<meta name="theme-color"[^>]*\bmedia=/)
  })

  it('開始アクションとResult正解率を芥子色にする', () => {
    expectOverrides("html[data-theme='default'] :is(.start-gate-action, .final-rate .pct)", {
      '--color-accent': '#e8b032',
    })
  })

  it('戦績チップを芥子と朱の配色にする', () => {
    expectOverrides(
      `html[data-theme='default'] :is(.score-chips, .result-list), ${PREVIEW_THEME_SCOPE} .p-chips`,
      {
        '--color-accent': '#e8b032',
        '--color-answer-wrong': '#ef5340',
        '--chip-wrong-bg': 'rgba(239, 83, 64, 0.14)',
        '--chip-current-glow': '0 0 0.375rem rgba(232, 176, 50, 0.5)',
        '--chip-current-wrong-glow': '0 0 0.375rem rgba(239, 83, 64, 0.5)',
      },
    )
  })

  it('解答エリアを芥子と朱の配色にする', () => {
    expectOverrides(`html[data-theme='default'] .answer-area, ${PREVIEW_THEME_SCOPE} .p-panel`, {
      '--color-accent': '#e8b032',
      '--color-answer-wrong': '#ef5340',
      '--color-urgent': '#ef5340',
      '--btn-primary-bg': '#e8b032',
      '--btn-primary-bg-hover': '#f2bf4b',
      '--btn-primary-text': '#1a1204',
      '--banner-wrong-bg': 'rgba(239, 83, 64, 0.15)',
      '--flash-wrong-glow': '0 0 1.125rem rgba(239, 83, 64, 0.25)',
    })
  })

  it('ボタンチェックトグルを芥子色にする', () => {
    expectOverrides(
      `html[data-theme='default'] .check-toggle, ${PREVIEW_THEME_SCOPE} .p-toggle-row`,
      {
        '--color-accent': '#e8b032',
        '--toggle-on-track': 'rgba(232, 176, 50, 0.22)',
        '--toggle-on-border': '#e8b032',
        '--toggle-on-knob': '#e8b032',
      },
    )
  })

  it('モーダル系の操作色を朱色にする', () => {
    expect(
      Object.fromEntries(
        [
          '--color-accent',
          '--color-accent-hover',
          '--color-on-accent',
          '--color-error',
          '--btn-primary-bg',
          '--btn-primary-bg-hover',
          '--btn-primary-text',
          '--toggle-on-track',
          '--toggle-on-border',
          '--toggle-on-knob',
          '--slider-thumb',
        ].map((token) => [token, rootTokens.get(token)]),
      ),
    ).toEqual({
      '--color-accent': '#ff6b4f',
      '--color-accent-hover': '#ff8268',
      '--color-on-accent': '#210a04',
      '--color-error': '#e6402e',
      '--btn-primary-bg': 'var(--color-accent)',
      '--btn-primary-bg-hover': 'var(--color-accent-hover)',
      '--btn-primary-text': 'var(--color-on-accent)',
      '--toggle-on-track': 'rgba(255, 107, 79, 0.22)',
      '--toggle-on-border': 'var(--color-accent)',
      '--toggle-on-knob': 'var(--color-accent)',
      '--slider-thumb': 'var(--color-accent)',
    })
  })

  it('Qとモーダルには局所上書きを追加しない', () => {
    const selectors = [...defaultTheme.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((match) =>
      match[1].trim(),
    )

    expect(
      selectors.filter(
        (selector) =>
          selector.includes('.q-label') ||
          selector.includes('.p-q') ||
          selector.includes('.modal-overlay') ||
          selector.includes('.dialog-overlay'),
      ),
    ).toEqual([])
  })

  it('プレビュー上書きをdefaultカード自身のテーマ境界に限定する', () => {
    const previewSelectors = [...defaultTheme.matchAll(/([^{}]+)\{[^{}]*\}/g)]
      .map((match) => match[1].trim())
      .filter((selector) => /\.p-(?:chips|panel|toggle-row)/.test(selector))

    expect(previewSelectors).toHaveLength(3)
    expect(previewSelectors.every((selector) => selector.includes(PREVIEW_THEME_SCOPE))).toBe(true)
  })
})
