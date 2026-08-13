import { createApp, nextTick } from 'vue'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ThemeSwitcher from '@/components/theme/ThemeSwitcher.vue'

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

const themeMock = vi.hoisted(() => ({
  setTheme: vi.fn(),
}))

vi.mock('@/composables/useTheme', async () => {
  const { ref } = await import('vue')

  return {
    useTheme: () => ({
      themes: ref([{ id: 'light', label: 'デフォルト', order: 0 }]),
      currentThemeId: ref('light'),
      setTheme: themeMock.setTheme,
    }),
  }
})

describe('ThemeSwitcher', () => {
  let host: HTMLDivElement
  let app: ReturnType<typeof createApp>
  let close: ReturnType<typeof vi.fn>
  let cardLeft: number
  let cardTop: number
  let overlayLeft: number
  let overlayTop: number
  let overlayWidth: number
  let overlayHeight: number
  let viewportWidth: number
  let viewportHeight: number
  let visualViewport: EventTarget

  function rect(top: number, width: number, height: number, left = 0): DOMRect {
    return {
      x: left,
      y: top,
      top,
      right: left + width,
      bottom: top + height,
      left,
      width,
      height,
      toJSON: () => ({}),
    }
  }

  beforeEach(async () => {
    cardLeft = 0
    cardTop = 160
    overlayLeft = 0
    overlayTop = 0
    overlayWidth = 390
    overlayHeight = 844
    viewportWidth = 390
    viewportHeight = 844
    visualViewport = new EventTarget()
    Object.defineProperty(visualViewport, 'width', { get: () => viewportWidth })
    Object.defineProperty(visualViewport, 'height', { get: () => viewportHeight })
    vi.stubGlobal('visualViewport', visualViewport)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.classList.contains('card-shell')) {
        return rect(
          cardTop,
          Number.parseFloat(this.style.width) || 148,
          Number.parseFloat(this.style.height) || 329,
          cardLeft,
        )
      }
      if (this.classList.contains('switcher-overlay')) {
        return rect(overlayTop, overlayWidth, overlayHeight, overlayLeft)
      }
      return rect(0, 0, 0)
    })
    close = vi.fn()
    host = document.createElement('div')
    document.body.appendChild(host)
    app = createApp(ThemeSwitcher, { isOpen: true, onClose: close })
    app.mount(host)
    await nextTick()
    await nextTick()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    app.unmount()
    host.remove()
    document
      .querySelectorAll('.switcher-overlay, .zoom-layer')
      .forEach((element) => element.remove())
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('カルーセルの空白をタップすると閉じる', () => {
    const rail = document.querySelector<HTMLElement>('.rail')
    if (!rail) throw new Error('Could not find theme rail')

    rail.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(close).toHaveBeenCalledOnce()
  })

  it('プレビューを2列グリッドで並べ、一覧だけを縦スクロールする', () => {
    const rail = cssRule(themeSwitcherSource, '.rail')
    const cardShell = cssRule(themeSwitcherSource, '.card-shell')
    const dismiss = cssRule(themeSwitcherSource, '.switcher-dismiss')

    expect(rail).toContain('display: grid')
    expect(rail).toContain('grid-template-columns: repeat(2, var(--card-width))')
    expect(rail).toContain('grid-auto-rows: max-content')
    expect(rail).toContain('overflow-x: hidden')
    expect(rail).toContain('overflow-y: auto')
    expect(themeSwitcherSource).toContain('上下にスクロール · タップで適用')
    expect(themeSwitcherSource).toContain(
      'rail.scrollTop = Math.max(0, currentCard.offsetTop - firstCard.offsetTop)',
    )
    expect(themeSwitcherSource).not.toContain('rail.scrollLeft =')
    expect(cardShell).not.toContain('box-shadow')
    expect(dismiss).toContain('margin: 1.25rem 0')
  })

  it('可変高の見出し領域で文字を中央配置し、その下から一覧を表示する', () => {
    const overlay = cssRule(themeSwitcherSource, '.switcher-overlay')
    const heading = cssRule(themeSwitcherSource, '.switcher-heading')
    const title = cssRule(themeSwitcherSource, '.switcher-title')
    const rail = cssRule(themeSwitcherSource, '.rail')
    const headingElement = document.querySelector<HTMLElement>('.switcher-heading')
    const railElement = document.querySelector<HTMLElement>('.rail')

    expect(overlay).toContain('--switcher-heading-height: clamp(88px, 6rem, 110px)')
    expect(overlay).toContain('--switcher-grid-offset: clamp(4px, 0.25rem, 6px)')
    expect(overlay).toContain('padding-top: env(safe-area-inset-top, 0px)')
    expect(heading).toContain('flex: 0 0 var(--switcher-heading-height)')
    expect(heading).toContain('height: var(--switcher-heading-height)')
    expect(heading).toContain('width: 100%')
    expect(heading).toContain('display: flex')
    expect(heading).toContain('flex-direction: column')
    expect(heading).toContain('justify-content: center')
    expect(heading).not.toContain('position: absolute')
    expect(title).toContain('margin: var(--switcher-grid-offset) 0 0')
    expect(rail).toContain('padding: var(--switcher-grid-offset) 1rem 1rem')
    expect(headingElement?.nextElementSibling).toBe(railElement)
    expect(themeSwitcherSource).not.toContain('.switcher-heading::before')
    expect(themeSwitcherSource).not.toContain('calculateHeadingPlacement')
  })

  it('カードをviewportと同じ縦横比で縮小表示する', async () => {
    const cardShell = document.querySelector<HTMLElement>('.card-shell')
    if (!cardShell) throw new Error('Could not find theme card shell')
    const initialWidth = Number.parseFloat(cardShell.style.width)
    const initialHeight = Number.parseFloat(cardShell.style.height)
    const cardScale = cardShell.querySelector<HTMLElement>('.card-scale')
    const preview = cardShell.querySelector<HTMLElement>('.preview')

    expect(initialWidth / initialHeight).toBeCloseTo(overlayWidth / overlayHeight)
    expect(cardShell.style.borderRadius).toBe('10px')
    expect(cardScale?.style.width).toBe(`${overlayWidth}px`)
    expect(cardScale?.style.height).toBe(`${overlayHeight}px`)
    expect(preview?.style.width).toBe(`${overlayWidth}px`)
    expect(preview?.style.height).toBe(`${overlayHeight}px`)
    expect(
      Number.parseFloat(cardScale?.style.getPropertyValue('--card-preview-scale') ?? ''),
    ).toBeCloseTo(initialWidth / overlayWidth)

    overlayWidth = 320
    overlayHeight = 568
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    await nextTick()

    const resizedWidth = Number.parseFloat(cardShell.style.width)
    const resizedHeight = Number.parseFloat(cardShell.style.height)

    expect(resizedWidth).toBeLessThan(initialWidth)
    expect(resizedWidth / resizedHeight).toBeCloseTo(overlayWidth / overlayHeight)
    expect(cardScale?.style.width).toBe(`${overlayWidth}px`)
    expect(cardScale?.style.height).toBe(`${overlayHeight}px`)
    expect(preview?.style.width).toBe(`${overlayWidth}px`)
    expect(preview?.style.height).toBe(`${overlayHeight}px`)
  })

  it('カードのタップは背景タップと分離し、演出後にテーマを適用して閉じる', async () => {
    vi.useFakeTimers()
    const animationFrames: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        animationFrames.push(callback)
        return animationFrames.length
      }),
    )
    overlayLeft = 10
    overlayTop = 20
    cardLeft = 50
    cardTop = 180
    const card = document.querySelector<HTMLElement>('.card')
    if (!card) throw new Error('Could not find theme card')

    card.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(close).not.toHaveBeenCalled()
    const zoomLayer = document.querySelector<HTMLElement>('.zoom-layer')
    const zoomPreview = zoomLayer?.querySelector<HTMLElement>('.preview')
    const cardShell = document.querySelector<HTMLElement>('.card-shell')
    const cardScale = document.querySelector<HTMLElement>('.card-scale')
    const initialScale = Number.parseFloat(cardShell?.style.width ?? '') / overlayWidth
    expect(zoomLayer?.style.transform).toBe(
      `translate(${cardLeft - overlayLeft}px, ${cardTop - overlayTop}px) scale(${initialScale})`,
    )
    expect(Number.parseFloat(zoomLayer?.style.borderRadius ?? '') * initialScale).toBeCloseTo(10)
    expect(zoomLayer?.style.getPropertyValue('--cover-scale')).toBe('')
    expect(zoomPreview?.style.width).toBe(`${overlayWidth}px`)
    expect(zoomPreview?.style.height).toBe(`${overlayHeight}px`)
    expect(
      Number.parseFloat(cardScale?.style.getPropertyValue('--card-preview-scale') ?? ''),
    ).toBeCloseTo(initialScale)

    animationFrames.shift()?.(0)
    animationFrames.shift()?.(0)
    await nextTick()

    expect(zoomLayer?.style.transform).toBe('translate(0px, 0px) scale(1)')

    vi.advanceTimersByTime(470)
    await nextTick()

    expect(themeMock.setTheme).toHaveBeenCalledWith('light')
    expect(close).toHaveBeenCalledOnce()
  })
})
