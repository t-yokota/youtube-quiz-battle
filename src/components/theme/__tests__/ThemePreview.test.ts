import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToString } from '@vue/server-renderer'
import { createSSRApp } from 'vue'

import AppHeader from '@/components/common/AppHeader.vue'
import ThemePreview from '@/components/theme/ThemePreview.vue'

const themePreviewSource = readFileSync(
  resolve(process.cwd(), 'src/components/theme/ThemePreview.vue'),
  'utf8',
)

const DRAWING_ATTRIBUTES = [
  'd',
  'cx',
  'cy',
  'r',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
] as const

function settingsIconSignature(markup: string, iconClass: string) {
  const container = document.createElement('div')
  container.innerHTML = markup
  const icon = container.querySelector<SVGElement>(`svg.${iconClass}`)

  if (!icon) throw new Error(`Could not find ${iconClass}`)

  return {
    viewBox: icon.getAttribute('viewBox'),
    attributes: Object.fromEntries(
      DRAWING_ATTRIBUTES.map((attribute) => [attribute, icon.getAttribute(attribute)]),
    ),
    shapes: [...icon.children].map((shape) => ({
      tagName: shape.tagName.toLowerCase(),
      attributes: Object.fromEntries(
        DRAWING_ATTRIBUTES.map((attribute) => [attribute, shape.getAttribute(attribute)]),
      ),
    })),
  }
}

describe('ThemePreview', () => {
  it('実画面と同じ設定アイコンを表示する', async () => {
    const [appHeader, themePreview] = await Promise.all([
      renderToString(createSSRApp(AppHeader)),
      renderToString(createSSRApp(ThemePreview)),
    ])

    const appHeaderIcon = settingsIconSignature(appHeader, 'settings-icon')
    const themePreviewIcon = settingsIconSignature(themePreview, 'p-gear')

    expect(themePreviewIcon.shapes.length).toBeGreaterThan(0)
    expect(themePreviewIcon).toEqual(appHeaderIcon)
  })

  it('残り回数をボタンの中央揃えから切り離して左寄せにする', () => {
    expect(themePreviewSource).toMatch(/\.preview\s*{[^}]*text-align:\s*left;/s)
  })

  it('指定されたviewport寸法でレイアウトする', async () => {
    const markup = await renderToString(
      createSSRApp(ThemePreview, { previewWidth: 390, previewHeight: 667 }),
    )
    const container = document.createElement('div')
    container.innerHTML = markup
    const preview = container.querySelector<HTMLElement>('.preview')

    expect(preview?.style.width).toBe('390px')
    expect(preview?.style.height).toBe('667px')
  })

  it('短い画面では早押しボタンを利用可能領域内へ縮小する', () => {
    expect(themePreviewSource).toMatch(/\.p-button-area\s*{[^}]*container-type:\s*size;/s)
    expect(themePreviewSource).toMatch(/\.p-pedestal\s*{[^}]*100cqmin/s)
    expect(themePreviewSource).toMatch(/\.p-quiz-button\s*{[^}]*cqmin/s)
  })
})
