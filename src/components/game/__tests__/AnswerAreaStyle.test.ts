import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(file: string): string {
  return readFileSync(resolve(process.cwd(), file), 'utf8')
}

function selectorBlock(source: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const block = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`))?.[1]

  if (!block) throw new Error(`${selector} is not defined`)

  return block
}

describe('AnswerArea styles', () => {
  const answerContent = readSource('src/components/game/AnswerContent.vue')
  const gamePanel = readSource('src/components/game/GamePanel.vue')

  it('残り回数の文字を0.8remで表示する', () => {
    expect(selectorBlock(answerContent, '.attempts-counter')).toContain('font-size: 0.8rem')
  })

  it.each(['.answer-area.flash-correct', '.answer-area.flash-incorrect'])(
    '%s は枠色だけを変更しグローを上書きしない',
    (selector) => {
      const rule = selectorBlock(gamePanel, selector)

      expect(rule).toContain('border-color:')
      expect(rule).not.toContain('box-shadow:')
    },
  )

  it('AnswerAreaの状態遷移を枠色だけに限定する', () => {
    const rule = selectorBlock(gamePanel, '.answer-area')
    const transition = rule.match(/transition:\s*([^;]+);/)?.[1].trim()

    expect(rule).toContain('box-shadow: var(--panel-shadow)')
    expect(transition).toBe('border-color var(--duration-base)')
  })
})
