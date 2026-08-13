/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToString } from '@vue/server-renderer'
import { createSSRApp } from 'vue'

import ResultChip from '../ResultChip.vue'
import ResultTable from '../../result/ResultTable.vue'

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

function noanswerMarkRadius(html: string): string | null {
  return (
    new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector('.chip.noanswer .mark-fill')
      ?.getAttribute('r') ?? null
  )
}

describe('ResultChip noanswer mark', () => {
  it('ゲーム中などの通常表示では従来の中黒点サイズを維持する', async () => {
    const html = await renderToString(createSSRApp(ResultChip, { variant: 'noanswer' }))

    expect(noanswerMarkRadius(html)).toBe('1.7')
  })

  it('Result画面ではスルー問題の中黒点を少し小さくする', async () => {
    const html = await renderToString(
      createSSRApp(ResultTable, {
        results: [
          {
            questionNumber: 1,
            isCorrect: false,
            correctAnswer: '正解',
            userAnswers: [],
            skipped: false,
            timesUntilPress: [],
            submissionTypes: [],
          },
        ],
      }),
    )

    expect(noanswerMarkRadius(html)).toBe('1.2')
  })
})

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

  it('未実施と無解答の現在位置をaccentのリングで囲む', () => {
    expect(selectorBlock('.chip:is(.empty, .noanswer).current')).toContain(
      '--_chip-line: var(--color-accent)',
    )
  })
})
