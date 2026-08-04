/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const THEMES_DIRECTORY = resolve(process.cwd(), 'src/themes')

function readTheme(file: string): string {
  return readFileSync(resolve(THEMES_DIRECTORY, file), 'utf8')
}

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

function expectTokensFrom(
  actualTheme: string,
  selector: string,
  actualRootTokens: Map<string, string>,
  sourceTokens: Map<string, string>,
  tokens: readonly string[],
): void {
  const overrides = tokenMap(ruleBody(actualTheme, selector))
  const actualTokens = new Map([...actualRootTokens, ...overrides])

  expect([...overrides.keys()].sort()).toEqual([...tokens].sort())

  for (const token of tokens) {
    expect(resolveToken(actualTokens, token), token).toBe(resolveToken(sourceTokens, token))
  }
}

function resolveToken(tokens: Map<string, string>, token: string, seen = new Set<string>()): string {
  if (seen.has(token)) throw new Error(`Circular token reference: ${token}`)
  seen.add(token)

  const value = tokens.get(token)
  if (!value) throw new Error(`${token} is not defined`)

  const reference = /^var\((--[\w-]+)\)$/.exec(value)?.[1]
  return reference ? resolveToken(tokens, reference, seen) : value
}

const SCORE_CHIP_TOKENS = [
  '--color-accent',
  '--color-answer-wrong',
  '--chip-wrong-bg',
  '--chip-current-glow',
  '--chip-current-wrong-glow',
] as const

const ACCENT_LABEL_TOKENS = ['--color-accent'] as const

const ANSWER_AREA_TOKENS = [
  '--color-accent',
  '--color-answer-wrong',
  '--color-urgent',
  '--btn-primary-bg',
  '--btn-primary-bg-hover',
  '--btn-primary-text',
  '--banner-wrong-bg',
  '--flash-wrong-glow',
] as const

const CHECK_TOGGLE_TOKENS = [
  '--color-accent',
  '--toggle-on-track',
  '--toggle-on-border',
  '--toggle-on-knob',
] as const

const MODAL_TOKENS = [
  '--color-accent',
  '--color-error',
  '--btn-primary-bg',
  '--btn-primary-bg-hover',
  '--btn-primary-text',
  '--toggle-on-track',
  '--toggle-on-border',
  '--toggle-on-knob',
  '--slider-thumb',
] as const

describe('default-5 theme', () => {
  const default3 = readTheme('default-3.theme.css')
  const default4 = readTheme('default-4.theme.css')
  const default5 = readTheme('default-5.theme.css')
  const default3Tokens = tokenMap(ruleBody(default3, "[data-theme='default-3']"))
  const default4Tokens = tokenMap(ruleBody(default4, "[data-theme='default-4']"))
  const default5Tokens = tokenMap(ruleBody(default5, "[data-theme='default-5']"))

  it('default-4をベースにし、指定されたメタ情報だけを変更する', () => {
    expect(default5Tokens.get('--theme-label')).toBe("'鉛と朱と芥子'")
    expect(default5Tokens.get('--theme-order')).toBe('5')
    expect([...default5Tokens.keys()].sort()).toEqual([...default4Tokens.keys()].sort())

    for (const [token, value] of default4Tokens) {
      if (token === '--theme-label' || token === '--theme-order') continue
      expect(default5Tokens.get(token), token).toBe(value)
    }
  })

  it('score-chips・Result画面・プレビューのチップをdefault-3に揃える', () => {
    expectTokensFrom(
      default5,
      "[data-theme='default-5'] :is(.score-chips, .result-list, .p-chips)",
      default5Tokens,
      default3Tokens,
      SCORE_CHIP_TOKENS,
    )
  })

  it('開始アクション・問題数のQ・Result正解率をdefault-3のアクセントに揃える', () => {
    expectTokensFrom(
      default5,
      "[data-theme='default-5'] :is(.start-gate-action, .q-label, .p-q, .final-rate .pct)",
      default5Tokens,
      default3Tokens,
      ACCENT_LABEL_TOKENS,
    )
  })

  it('answer-areaとプレビューの解答欄をdefault-3に揃える', () => {
    expectTokensFrom(
      default5,
      "[data-theme='default-5'] :is(.answer-area, .p-panel)",
      default5Tokens,
      default3Tokens,
      ANSWER_AREA_TOKENS,
    )
  })

  it('check-toggleとプレビューのトグルをdefault-3に揃える', () => {
    expectTokensFrom(
      default5,
      "[data-theme='default-5'] :is(.check-toggle, .p-toggle-row)",
      default5Tokens,
      default3Tokens,
      CHECK_TOGGLE_TOKENS,
    )
  })

  it('モーダル系画面をdefault-3に揃える', () => {
    expectTokensFrom(
      default5,
      "[data-theme='default-5'] :is(.modal-overlay, .dialog-overlay)",
      default5Tokens,
      default3Tokens,
      MODAL_TOKENS,
    )
  })
})
