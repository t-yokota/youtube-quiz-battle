/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const THEMES_DIRECTORY = resolve(process.cwd(), 'src/themes')
const BASE_TOKENS = [
  '--color-info',
  '--input-focus-border-color',
  '--input-focus-shadow',
] as const

function readTheme(file: string): string {
  return readFileSync(resolve(THEMES_DIRECTORY, file), 'utf8')
}

function tokenValue(css: string, token: string): string {
  const value = css.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]

  if (!value) throw new Error(`${token} is not defined`)

  return value.replace(/\s+/g, ' ').trim()
}

describe.each(['default-2.theme.css', 'default-3.theme.css', 'default-4.theme.css'])(
  '%s',
  (file) => {
    it('残り回数と入力フォーカスの定義をdefaultテーマと揃える', () => {
      const defaultTheme = readTheme('default.theme.css')
      const variantTheme = readTheme(file)

      for (const token of BASE_TOKENS) {
        expect(tokenValue(variantTheme, token), token).toBe(tokenValue(defaultTheme, token))
      }
    })
  },
)
