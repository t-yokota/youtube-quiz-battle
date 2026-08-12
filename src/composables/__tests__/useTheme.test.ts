import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const THEME_COLORS: Record<string, string> = {
  default: '#14171a',
  flat: '#f3eee7',
  light: '#eee8df',
  neumorphism: '#e3e7f0',
}

const THEME_ORDERS: Record<string, string> = {
  default: '0',
  flat: '1',
  light: '2',
  neumorphism: '3',
}

function installComputedStyleMock(): void {
  vi.stubGlobal(
    'getComputedStyle',
    vi.fn((element: HTMLElement) => {
      const themeId = element.dataset.theme ?? 'default'

      return {
        getPropertyValue(property: string) {
          if (property === '--theme-label') return `'${themeId}'`
          if (property === '--theme-order') return THEME_ORDERS[themeId] ?? ''
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

    expect(themeColorMetaValues()).toEqual(['#e3e7f0'])
    expect(document.querySelector('meta[name="theme-color"]')?.hasAttribute('media')).toBe(false)
  })

  it('テーマ切替時にすべてのtheme-color metaを更新する', async () => {
    const { useTheme } = await import('../useTheme')
    const { setTheme } = useTheme()
    const previousMeta = document.querySelector('meta[name="theme-color"]')

    setTheme('flat')

    expect(themeColorMetaValues()).toEqual(['#f3eee7'])
    expect(document.querySelector('meta[name="theme-color"]')?.hasAttribute('media')).toBe(false)
    expect(document.querySelector('meta[name="theme-color"]')).not.toBe(previousMeta)
    expect(previousMeta?.isConnected).toBe(false)
  })

  it('theme-color metaがない場合も現在テーマのmetaを追加する', async () => {
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove())
    const { useTheme } = await import('../useTheme')

    useTheme()

    expect(themeColorMetaValues()).toEqual(['#14171a'])
    expect(document.querySelector('meta[name="theme-color"]')?.hasAttribute('media')).toBe(false)
  })

  it('利用可能なテーマを指定順で公開する', async () => {
    const { useTheme } = await import('../useTheme')
    const { themes } = useTheme()

    expect(themes.value.map(({ id }) => id)).toEqual(['default', 'flat', 'light', 'neumorphism'])
  })

  it('保存済みのdefault-flatをflatへ移行する', async () => {
    localStorage.setItem('yqb-theme', 'default-flat')
    const { useTheme } = await import('../useTheme')
    const { currentThemeId } = useTheme()

    expect(currentThemeId.value).toBe('flat')
    expect(localStorage.getItem('yqb-theme')).toBe('flat')
    expect(themeColorMetaValues()).toEqual(['#f3eee7'])
  })

  it.each(['default-2', 'default-3', 'default-4', 'default-5'])(
    '保存済みの旧テーマ%sをdefaultへ移行する',
    async (legacyTheme) => {
      localStorage.setItem('yqb-theme', legacyTheme)
      const { useTheme } = await import('../useTheme')
      const { currentThemeId } = useTheme()

      expect(currentThemeId.value).toBe('default')
      expect(localStorage.getItem('yqb-theme')).toBe('default')
      expect(themeColorMetaValues()).toEqual(['#14171a'])
    },
  )
})
