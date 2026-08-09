import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  calculateTimerProgress,
  calculateTimerLabelWidthCh,
  resolveTimerLabelWidthState,
} from '@/components/game/answerTimerLayout'

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
  const mainStyles = readSource('src/assets/main.css')

  it('残り回数の文字を独立文字unitの0.8倍で表示する', () => {
    expect(selectorBlock(answerContent, '.attempts-counter')).toContain(
      'font-size: calc(0.8 * var(--ui-font-unit))',
    )
  })

  it('残り秒数の文字を独立文字unitの0.8倍で表示する', () => {
    const rule = selectorBlock(answerContent, '.answer-timer')

    expect(rule).toContain('font-size: calc(0.8 * var(--ui-font-unit))')
    expect(rule).toContain('gap: 0.375rem')
    expect(rule).toContain('transition: --timer-progress 1s linear')
  })

  it('整数表示でもリングの進捗を1秒間で滑らかに補間する', () => {
    expect(answerContent).toContain("'--timer-progress': timerProgress")
    expect(selectorBlock(answerContent, '.timer-ring')).toContain('var(--timer-progress)')
    expect(selectorBlock(mainStyles, '@property --timer-progress')).toContain(
      "syntax: '<number>'",
    )
  })

  it.each([
    [5, 10, 0.5],
    [12, 10, 1],
    [-1, 10, 0],
    [5, 0, 0],
  ])('残り%s秒・制限%s秒のリング進捗を%sにする', (remaining, limit, progress) => {
    expect(calculateTimerProgress(remaining, limit)).toBe(progress)
  })

  it.each([
    [1, 2],
    [9, 2],
    [10, 3],
    [99, 3],
    [100, 4],
    [300, 4],
  ])('制限時間%s秒では秒数表示領域を%schに固定する', (seconds, width) => {
    expect(calculateTimerLabelWidthCh(seconds)).toBe(width)
  })

  it('同じ問題では表示領域を縮めず、次の問題で初期幅へ戻す', () => {
    const initial = resolveTimerLabelWidthState(undefined, 1, 10, 10)
    const expanded = resolveTimerLabelWidthState(initial, 1, 9, 300)
    const held = resolveTimerLabelWidthState(expanded, 1, 9, 99)
    const reset = resolveTimerLabelWidthState(held, 2, 9, 9)

    expect(initial.widthCh).toBe(3)
    expect(expanded.widthCh).toBe(4)
    expect(held.widthCh).toBe(4)
    expect(reset.widthCh).toBe(2)
  })

  it('秒数領域を中央揃えにし、リングとの組み合わせ全体を右へ揃える', () => {
    const timerRule = selectorBlock(answerContent, '.answer-timer')
    const secondRule = selectorBlock(answerContent, '.answer-timer .sec')
    const ringRule = selectorBlock(answerContent, '.timer-ring')

    expect(answerContent).toMatch(
      /<span class="sec">\s*{{\s*gameStore\.answerTimeRemaining\s*}}s\s*<\/span>/,
    )
    expect(answerContent).toContain("'--timer-label-width': timerLabelWidth")
    expect(timerRule).toContain('margin-left: auto')
    expect(timerRule).toContain('justify-content: flex-end')
    expect(timerRule).toContain(
      'width: calc(1.375rem + 0.375rem + var(--timer-label-width, 3ch))',
    )
    expect(timerRule).toContain('flex-shrink: 0')
    expect(timerRule).not.toContain('min-width:')
    expect(secondRule).toContain('width: var(--timer-label-width, 3ch)')
    expect(secondRule).toContain('flex-shrink: 0')
    expect(secondRule).toContain('text-align: center')
    expect(secondRule).toContain('white-space: nowrap')
    expect(ringRule).toContain('flex-shrink: 0')
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
