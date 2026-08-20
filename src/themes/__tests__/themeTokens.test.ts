/// <reference types="node" />

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const themesDirectory = resolve(process.cwd(), 'src/themes')
const sourceDirectory = resolve(process.cwd(), 'src')

const themeFiles = Object.fromEntries(
  readdirSync(themesDirectory)
    .filter((file) => file.endsWith('.theme.css'))
    .map((file) => [file, readFileSync(`${themesDirectory}/${file}`, 'utf8')]),
)

const REQUIRED_TOKENS = [
  '--theme-color',
  '--color-answer-correct',
  '--color-answer-wrong',
  '--color-error',
  '--color-urgent',
  '--btn-replay-bg',
  '--btn-replay-bg-hover',
  '--btn-replay-text',
  '--btn-replay-shadow',
  '--chip-correct-bg',
  '--chip-wrong-bg',
  '--chip-current-glow',
  '--chip-current-correct-glow',
  '--chip-current-wrong-glow',
  '--banner-correct-bg',
  '--banner-wrong-bg',
] as const

const DEPRECATED_TOKENS = [
  '--color-ok',
  '--color-danger',
  '--color-danger-hover',
  '--btn-danger-bg',
  '--btn-danger-bg-hover',
  '--btn-danger-text',
  '--btn-danger-shadow',
  '--chip-ok-bg',
  '--chip-ng-bg',
  '--banner-ok-bg',
  '--banner-ng-bg',
  '--flash-ok-glow',
  '--flash-ng-glow',
  '--flash-correct-glow',
  '--flash-wrong-glow',
] as const

function tokenValue(css: string, token: string): string | null {
  const value = css.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]
  return value?.replace(/\s+/g, ' ').trim() ?? null
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`

    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sourceFiles(path)
    }

    return entry.name.endsWith('.vue') || entry.name.endsWith('.css') ? [path] : []
  })
}

function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '')
}

describe('theme token contract', () => {
  it('公開するテーマファイルを固定する', () => {
    expect(Object.keys(themeFiles).sort()).toEqual([
      'dark.theme.css',
      'flat.theme.css',
      'light.theme.css',
      'neumorphism.theme.css',
    ])
  })

  it.each(Object.entries(themeFiles))('%s が用途別のカラートークンをすべて定義する', (_, css) => {
    for (const token of REQUIRED_TOKENS) {
      expect(tokenValue(css, token), `${token} should be defined`).not.toBeNull()
    }
  })

  it.each(Object.entries(themeFiles))('%s が用途別トークンを一箇所だけで定義する', (_, css) => {
    for (const token of [
      '--btn-primary-shadow',
      '--color-answer-wrong',
      '--color-urgent',
      '--banner-wrong-bg',
      '--chip-wrong-bg',
      '--chip-current-glow',
      '--chip-current-correct-glow',
      '--chip-current-wrong-glow',
    ]) {
      expect([...css.matchAll(new RegExp(`${token}:`, 'g'))], token).toHaveLength(1)
    }
  })

  it.each(Object.entries(themeFiles))('%s に旧トークンを残さない', (_, css) => {
    for (const token of DEPRECATED_TOKENS) {
      expect(tokenValue(css, token), `${token} should be removed`).toBeNull()
    }
  })

  it('表示名と並び順をCSSへ重複定義しない', () => {
    for (const css of Object.values(themeFiles)) {
      expect(tokenValue(css, '--theme-label')).toBeNull()
      expect(tokenValue(css, '--theme-order')).toBeNull()
    }
  })

  it('本番スタイルが旧トークンを参照しない', () => {
    for (const file of sourceFiles(sourceDirectory)) {
      const uncommentedSource = stripCssComments(readFileSync(file, 'utf8'))

      for (const token of DEPRECATED_TOKENS) {
        expect(uncommentedSource, `${file} should not use ${token}`).not.toContain(token)
      }
    }
  })
})
