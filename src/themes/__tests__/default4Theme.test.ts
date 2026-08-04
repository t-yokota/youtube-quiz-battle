/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const default4 = readFileSync(resolve(process.cwd(), 'src/themes/default-4.theme.css'), 'utf8')

function tokenValue(token: string): string {
  const value = default4.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]

  if (!value) throw new Error(`${token} is not defined`)

  return value.replace(/\s+/g, ' ').trim()
}

describe('default-4 theme', () => {
  it('不正解色をエラー色・リプレイボタンから独立させる', () => {
    const wrong = tokenValue('--color-answer-wrong')

    expect(wrong).not.toBe(tokenValue('--color-error'))
    expect(wrong).not.toBe(tokenValue('--btn-replay-bg'))
  })
})
