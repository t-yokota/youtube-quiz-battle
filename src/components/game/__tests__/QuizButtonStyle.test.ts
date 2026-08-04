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
  it('実画面ではFlex中央揃えから0.5px下へ視覚補正する', () => {
    const rule = cssRule(readSource('src/components/game/QuizButton.vue'), '.check-toggle-state')

    expect(rule).toMatch(/top:\s*0;/)
    expect(rule).toMatch(/bottom:\s*0;/)
    expect(rule).toMatch(/display:\s*flex;/)
    expect(rule).toMatch(/align-items:\s*center;/)
    expect(rule).toMatch(/transform:\s*translateY\(0\.5px\);/)
  })

  it('テーマプレビューでも中央基準から0.5px下へ視覚補正する', () => {
    const rule = cssRule(readSource('src/components/theme/ThemePreview.vue'), '.p-toggle-state')

    expect(rule).toMatch(/top:\s*50%;/)
    expect(rule).toMatch(/transform:\s*translateY\(calc\(-50% \+ 0\.5px\)\);/)
  })
})
