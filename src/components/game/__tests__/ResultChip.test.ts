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

describe('ResultChip current ring', () => {
  it('未実施と無解答の現在位置をaccentのリングで囲む', () => {
    expect(selectorBlock('.chip:is(.empty, .noanswer).current')).toContain(
      '--_chip-line: var(--color-accent)',
    )
  })

  it('現在位置にグローやシャドウを追加しない', () => {
    expect(resultChipSource).not.toContain('--chip-current')
    expect(resultChipSource).not.toContain('--_chip-current-glow')
    expect(resultChipSource).not.toMatch(/\.chip\.current\s*{[^}]*box-shadow:/s)
  })
})
