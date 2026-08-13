import { describe, expect, it } from 'vitest'

import { createThemeList, themeMeta } from '../themeMeta'

describe('themeMeta', () => {
  it('公開テーマの表示名と順序を一元管理する', () => {
    expect(themeMeta).toEqual({
      light: { label: 'デフォルト', order: 0 },
      dark: { label: 'ダーク', order: 1 },
      flat: { label: 'フラット', order: 2 },
      neumorphism: { label: 'ニューモーフィズム', order: 3 },
    })
  })

  it('メタ情報とCSSファイルの両方が存在するテーマだけを公開する', () => {
    const themes = createThemeList(
      [
        '../themes/neumorphism.theme.css',
        '../themes/draft.theme.css',
        '../themes/light.theme.css',
        '../themes/dark.theme.css',
      ],
      {
        light: { label: 'デフォルト', order: 0 },
        dark: { label: 'ダーク', order: 1 },
        missing: { label: 'CSSなし', order: 2 },
        neumorphism: { label: 'ニューモーフィズム', order: 3 },
      },
    )

    expect(themes).toEqual([
      { id: 'light', label: 'デフォルト', order: 0 },
      { id: 'dark', label: 'ダーク', order: 1 },
      { id: 'neumorphism', label: 'ニューモーフィズム', order: 3 },
    ])
  })
})
