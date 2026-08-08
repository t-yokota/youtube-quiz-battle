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

describe('SettingsModal', () => {
  it('UIテーマを設定項目の最下段かつデータ収集セクションの直前に置く', () => {
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
    expect(sections.indexOf(themeSection!)).toBeGreaterThan(sections.indexOf(debugSection!))
    expect(themeSection?.nextElementSibling).toBe(privacySection)
  })
})
