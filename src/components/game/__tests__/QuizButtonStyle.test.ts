/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readSource(file: string): string {
  return readFileSync(resolve(process.cwd(), file), 'utf8')
}

function cssRule(source: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rule = source.match(new RegExp(`^\\s*${escapedSelector}\\s*\\{([^}]*)\\}`, 'ms'))?.[1]

  if (!rule) throw new Error(`${selector} is not defined`)
  return rule
}

describe('BUTTON CHECK toggle text', () => {
  const quizButtonSource = readSource('src/components/game/QuizButton.vue')

  it('実画面のON/OFFをFlexでトラック中央へ揃える', () => {
    const rule = cssRule(quizButtonSource, '.check-toggle-state')

    expect(rule).toMatch(/top:\s*0;/)
    expect(rule).toMatch(/bottom:\s*0;/)
    expect(rule).toMatch(/display:\s*flex;/)
    expect(rule).toMatch(/align-items:\s*center;/)
    expect(rule).not.toMatch(/transform:/)
  })

  it('短い画面でもトラック内部を文字と同じunitで縮尺しON/OFF領域を保つ', () => {
    const toggle = cssRule(quizButtonSource, '.check-toggle')
    const track = cssRule(quizButtonSource, '.check-toggle-track')
    const state = cssRule(quizButtonSource, '.check-toggle-state')
    const onState = cssRule(quizButtonSource, '.check-toggle-track.on .check-toggle-state')
    const knob = cssRule(quizButtonSource, '.check-toggle-knob')
    const onKnob = cssRule(quizButtonSource, '.check-toggle-track.on .check-toggle-knob')

    expect(toggle).toContain('--_check-toggle-unit: var(--ui-font-unit)')
    expect(toggle).toContain(
      '--_check-toggle-knob-size: calc(0.9375 * var(--_check-toggle-unit))',
    )
    expect(toggle).toContain(
      '--_check-toggle-knob-inset: calc(0.125 * var(--_check-toggle-unit))',
    )
    expect(toggle).toContain('gap: calc(0.4 * var(--_check-toggle-unit))')
    expect(track).toContain('width: calc(2.75 * var(--_check-toggle-unit))')
    expect(track).toContain('height: calc(1.25 * var(--_check-toggle-unit))')
    expect(state).toContain('right: calc(0.3125 * var(--_check-toggle-unit))')
    expect(onState).toContain('left: calc(0.3125 * var(--_check-toggle-unit))')
    expect(knob).toContain('left: var(--_check-toggle-knob-inset)')
    expect(knob).toContain('width: var(--_check-toggle-knob-size)')
    expect(knob).toContain('height: var(--_check-toggle-knob-size)')
    expect(onKnob).toContain(
      'left: calc(100% - var(--_check-toggle-knob-size) - var(--_check-toggle-knob-inset))',
    )
  })

  it('テーマプレビューでもON/OFFをトラック中央へ揃える', () => {
    const rule = cssRule(readSource('src/components/theme/ThemePreview.vue'), '.p-toggle-state')

    expect(rule).toMatch(/top:\s*50%;/)
    expect(rule).toMatch(/transform:\s*translateY\(-50%\);/)
  })
})
