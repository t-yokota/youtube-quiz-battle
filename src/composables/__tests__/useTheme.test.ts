import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const THEME_COLORS: Record<string, string> = {
  default: '#14171a',
  neumorphism: '#e3e7f0',
}

function installComputedStyleMock(): void {
  vi.stubGlobal(
    'getComputedStyle',
    vi.fn((element: HTMLElement) => {
      const themeId = element.dataset.theme ?? 'default'

      return {
        getPropertyValue(property: string) {
          if (property === '--theme-label') return `'${themeId}'`
          if (property === '--theme-order') return '0'
          if (property === '--theme-color') return THEME_COLORS[themeId] ?? ''
          return ''
        },
      } as CSSStyleDeclaration
    }),
  )
}

function themeColorMetaValues(): string[] {
  return [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(
    (meta) => meta.content,
  )
}

describe('useTheme', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    delete document.documentElement.dataset.theme
    document.head.innerHTML = `
      <meta name="theme-color" content="#14171a" media="(prefers-color-scheme: light)">
      <meta name="theme-color" content="#14171a" media="(prefers-color-scheme: dark)">
    `
    installComputedStyleMock()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('保存済みテーマのtheme-colorを初期化時にmetaへ反映する', async () => {
    localStorage.setItem('yqb-theme', 'neumorphism')
    const { useTheme } = await import('../useTheme')

    useTheme()

    expect(themeColorMetaValues()).toEqual(['#e3e7f0', '#e3e7f0'])
  })

  it('テーマ切替時にすべてのtheme-color metaを更新する', async () => {
    const { useTheme } = await import('../useTheme')
    const { setTheme } = useTheme()

    setTheme('default')

    expect(themeColorMetaValues()).toEqual(['#14171a', '#14171a'])
  })

  it('利用可能なテーマをdefaultとneumorphismだけに限定する', async () => {
    const { useTheme } = await import('../useTheme')
    const { themes } = useTheme()

    expect(themes.value.map(({ id }) => id)).toEqual(['default', 'neumorphism'])
  })

  it.each(['default-2', 'default-3', 'default-4', 'default-5'])(
    '保存済みの旧テーマ%sをdefaultへ移行する',
    async (legacyTheme) => {
      localStorage.setItem('yqb-theme', legacyTheme)
      const { useTheme } = await import('../useTheme')
      const { currentThemeId } = useTheme()

      expect(currentThemeId.value).toBe('default')
      expect(localStorage.getItem('yqb-theme')).toBe('default')
      expect(themeColorMetaValues()).toEqual(['#14171a', '#14171a'])
    },
  )
})
