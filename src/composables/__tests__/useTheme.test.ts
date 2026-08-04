import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const THEME_COLORS: Record<string, string> = {
  default: '#0b1020',
  'default-2': '#14171a',
  'default-3': '#14171a',
  'default-4': '#14171a',
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
      <meta name="theme-color" content="#0b1020" media="(prefers-color-scheme: light)">
      <meta name="theme-color" content="#0b1020" media="(prefers-color-scheme: dark)">
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

    setTheme('default-4')

    expect(themeColorMetaValues()).toEqual(['#14171a', '#14171a'])
  })
})
