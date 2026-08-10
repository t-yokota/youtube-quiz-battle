import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/dialogs/SettingsModal.vue'),
  'utf8',
)
const template = source.slice(
  source.indexOf('<template>') + '<template>'.length,
  source.indexOf('</template>'),
)

function selectorBlock(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const block = source.match(new RegExp(`^\\s*${escapedSelector}\\s*\\{([^}]*)\\}`, 'ms'))?.[1]

  if (!block) throw new Error(`${selector} is not defined`)

  return block
}

describe('SettingsModal', () => {
  it('UIテーマ・デバッグ・データ収集の順で設定項目の下部に置く', () => {
    const parsedTemplate = document.createElement('template')
    parsedTemplate.innerHTML = template
    const sections = [...parsedTemplate.content.querySelectorAll<HTMLElement>('.settings-section')]
    const themeSections = sections.filter((section) => section.textContent?.includes('UIテーマ'))
    const themeSection = themeSections[0]
    const privacySection = sections.find((section) =>
      section.textContent?.includes('データ収集について'),
    )
    const debugSection = sections.find((section) => section.hasAttribute('v-if'))

    expect(themeSections).toHaveLength(1)
    expect(themeSection).toBeDefined()
    expect(privacySection).toBeDefined()
    expect(debugSection).toBeDefined()
    expect(themeSection?.nextElementSibling).toBe(debugSection)
    expect(debugSection?.nextElementSibling).toBe(privacySection)
  })

  it('設定画面専用のレイアウト・文字・操作部unitを定義する', () => {
    const overlay = selectorBlock('.modal-overlay')
    const compactOverlay = overlay.replace(/\s+/g, '')

    expect(overlay).toContain('--settings-layout-min: 13px')
    expect(overlay).toContain('--settings-font-min: 14px')
    expect(overlay).toContain('--settings-layout-max: 15px')
    expect(overlay).toContain('--settings-font-max: 15px')
    expect(compactOverlay).toContain(
      '--settings-layout-unit:clamp(var(--settings-layout-min),calc(min(var(--ui-viewport-height)/700,100vw/315)*16),var(--settings-layout-max))',
    )
    expect(compactOverlay).toContain(
      '--settings-font-unit:clamp(var(--settings-font-min),calc(min(var(--ui-viewport-height)/700,100vw/315)*16),var(--settings-font-max))',
    )
    expect(overlay).toContain(
      '--settings-control-height: max(40px, calc(2.75 * var(--settings-layout-unit)))',
    )
  })

  it('設定画面の文字を専用文字unitで縮尺する', () => {
    expect(selectorBlock('.modal-title')).toContain(
      'font-size: calc(1.25 * var(--settings-font-unit))',
    )
    expect(selectorBlock('.setting-label')).toContain('font-size: var(--settings-font-unit)')
    expect(selectorBlock('.seek-description')).toContain(
      'font-size: calc(0.875 * var(--settings-font-unit))',
    )
    expect(selectorBlock('.privacy-text')).toContain(
      'font-size: calc(0.875 * var(--settings-font-unit))',
    )

    const fontSizes = [...source.matchAll(/font-size:\s*([^;]+);/g)].map((match) => match[1])
    expect(fontSizes).toHaveLength(10)
    expect(fontSizes.every((fontSize) => fontSize.includes('var(--settings-font-unit)'))).toBe(true)
  })

  it('設定変更UIと項目間隔を専用レイアウトunitで縮尺する', () => {
    expect(selectorBlock('.modal-content')).toContain(
      'padding: var(--settings-layout-unit)',
    )
    expect(selectorBlock('.modal-content')).toContain(
      'gap: calc(1.125 * var(--settings-layout-unit))',
    )
    expect(selectorBlock('.setting-row')).toContain(
      'min-height: var(--settings-control-height)',
    )
    expect(selectorBlock('.ui-switch')).toContain(
      'min-height: var(--settings-control-height)',
    )
    expect(selectorBlock('.ui-switch-track')).toContain(
      'width: calc(2.75 * var(--settings-layout-unit))',
    )
    expect(selectorBlock('.ui-switch-track')).toContain(
      'height: calc(1.625 * var(--settings-layout-unit))',
    )
    expect(selectorBlock('.slider')).toContain(
      'width: calc(6.875 * var(--settings-layout-unit))',
    )
    expect(selectorBlock('.slider::-webkit-slider-thumb')).toContain(
      'width: calc(1.25 * var(--settings-layout-unit))',
    )
    expect(selectorBlock('.theme-button')).toContain(
      'min-height: var(--settings-control-height)',
    )
    expect(selectorBlock('.primary-button')).toContain(
      'min-height: var(--settings-control-height)',
    )
    expect(selectorBlock('.close-button')).toContain(
      'width: var(--settings-control-height)',
    )
    expect(selectorBlock('.close-button')).toContain(
      'height: var(--settings-control-height)',
    )
    expect(selectorBlock('.ui-switch-knob')).toContain(
      'width: calc(1.25 * var(--settings-layout-unit))',
    )
    expect(selectorBlock('.ui-switch-knob')).toContain(
      'left: calc(0.1875 * var(--settings-layout-unit))',
    )
    expect(selectorBlock('.volume-icon')).toContain(
      'width: calc(1.375 * var(--settings-layout-unit))',
    )
    expect(selectorBlock('.debug-row')).toContain(
      'min-height: max(32px, calc(2.25 * var(--settings-layout-unit)))',
    )
    expect(selectorBlock('.debug-input')).toContain(
      'width: calc(3.5 * var(--settings-layout-unit))',
    )
    expect(selectorBlock('.debug-input')).toContain(
      'height: calc(1.875 * var(--settings-layout-unit))',
    )
  })
})
