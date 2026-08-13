import { describe, expect, it } from 'vitest'

import { createThemeList, themeMeta } from '../themeMeta'

describe('themeMeta', () => {
  it('公開テーマの表示名と順序を一元管理する', () => {
    expect(themeMeta).toEqual({
      default: { label: 'デフォルト', order: 0 },
      flat: { label: 'フラット', order: 1 },
      light: { label: 'ライト', order: 2 },
      neumorphism: { label: 'ニューモーフィズム', order: 3 },
    })
  })

  it('メタ情報とCSSファイルの両方が存在するテーマだけを公開する', () => {
    const themes = createThemeList(
      [
        '../themes/neumorphism.theme.css',
        '../themes/draft.theme.css',
        '../themes/default.theme.css',
      ],
      {
        default: { label: 'デフォルト', order: 0 },
        missing: { label: 'CSSなし', order: 1 },
        neumorphism: { label: 'ニューモーフィズム', order: 2 },
      },
    )

    expect(themes).toEqual([
      { id: 'default', label: 'デフォルト', order: 0 },
      { id: 'neumorphism', label: 'ニューモーフィズム', order: 2 },
    ])
  })
})
