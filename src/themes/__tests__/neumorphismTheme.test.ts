/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const neumorphism = readFileSync(resolve(process.cwd(), 'src/themes/neumorphism.theme.css'), 'utf8')

function tokenValue(token: string): string {
  const value = neumorphism.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]

  if (!value) throw new Error(`${token} is not defined`)

  return value.replace(/\s+/g, ' ').trim()
}

describe('neumorphism theme', () => {
  it('lightの後に表示する', () => {
    expect(tokenValue('--theme-order')).toBe('3')
  })

  it('WAITボタンを赤い面と赤系insetシャドウで沈み込ませる', () => {
    expect(tokenValue('--quiz-btn-face-disabled')).toBe('#e8604c')
    expect(tokenValue('--quiz-btn-shadow-disabled')).toBe(
      'inset 0.5rem 0.5rem 1rem #c34d3d, inset -0.5rem -0.5rem 1rem #ff7b66',
    )
    expect(tokenValue('--quiz-btn-disabled-filter')).toBe('none')
  })

  it('赤いWAITボタン上の文字を白で表示する', () => {
    expect(tokenValue('--quiz-btn-text-disabled')).toBe('#ffffff')
    expect(tokenValue('--quiz-btn-text-shadow-disabled')).toBe('none')
  })
})
