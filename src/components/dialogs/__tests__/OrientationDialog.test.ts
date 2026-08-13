import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const orientationDialogSource = readFileSync(
  resolve(process.cwd(), 'src/components/dialogs/OrientationDialog.vue'),
  'utf8',
)
const themeSwitcherSource = readFileSync(
  resolve(process.cwd(), 'src/components/theme/ThemeSwitcher.vue'),
  'utf8',
)

function cssRule(source: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rule = source.match(new RegExp(`^\\s*${escapedSelector}\\s*\\{([^}]*)\\}`, 'ms'))?.[1]

  if (!rule) throw new Error(`${selector} is not defined`)
  return rule
}

function zIndex(source: string, selector: string): number {
  const value = cssRule(source, selector).match(/z-index:\s*(\d+)/)?.[1]

  if (!value) throw new Error(`${selector} does not define a numeric z-index`)
  return Number(value)
}

describe('OrientationDialog', () => {
  it('テーマ一覧と選択時のズームより前面に横向き警告を表示する', () => {
    const orientationLayer = zIndex(orientationDialogSource, '.dialog-overlay')
    const switcherLayer = zIndex(themeSwitcherSource, '.switcher-overlay')
    const switcherZoomLayer = zIndex(themeSwitcherSource, '.zoom-layer')

    expect(orientationLayer).toBeGreaterThan(switcherLayer)
    expect(orientationLayer).toBeGreaterThan(switcherZoomLayer)
  })
})
