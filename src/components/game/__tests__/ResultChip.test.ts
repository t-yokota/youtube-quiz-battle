/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const resultChipSource = readFileSync(
  resolve(process.cwd(), 'src/components/game/ResultChip.vue'),
  'utf8',
)

function selectorBlock(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const block = resultChipSource.match(new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`))?.[1]

  if (!block) throw new Error(`${selector} is not defined`)

  return block
}

describe('ResultChip current glow', () => {
  it('正誤以外の現在位置にはaccentのグローを使う', () => {
    expect(selectorBlock('.chip')).toContain('--_chip-current-glow: var(--chip-current-glow)')
  })

  it('正解中の現在位置にはcorrectのグローを使う', () => {
    expect(selectorBlock('.chip.correct')).toContain(
      '--_chip-current-glow: var(--chip-current-correct-glow)',
    )
  })

  it('不正解中の現在位置にはwrongのグローを使う', () => {
    expect(selectorBlock('.chip.incorrect')).toContain(
      '--_chip-current-glow: var(--chip-current-wrong-glow)',
    )
  })

  it('現在位置のグローにはvariant別のローカルトークンを使う', () => {
    expect(selectorBlock('.chip.current')).toContain('box-shadow: var(--_chip-current-glow)')
  })
})
