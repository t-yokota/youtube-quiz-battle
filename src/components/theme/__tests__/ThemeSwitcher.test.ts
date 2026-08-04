import { createApp, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ThemeSwitcher from '@/components/theme/ThemeSwitcher.vue'

const themeMock = vi.hoisted(() => ({
  setTheme: vi.fn(),
}))

vi.mock('@/composables/useTheme', async () => {
  const { ref } = await import('vue')

  return {
    useTheme: () => ({
      themes: ref([{ id: 'default', label: 'ステージ', order: 0 }]),
      currentThemeId: ref('default'),
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
  let safeAreaTop: number
  let viewportOffsetTop: number
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
    safeAreaTop = 0
    viewportOffsetTop = 0
    viewportWidth = 390
    viewportHeight = 844
    visualViewport = new EventTarget()
    Object.defineProperty(visualViewport, 'offsetTop', { get: () => viewportOffsetTop })
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
      if (this.classList.contains('switcher-heading')) return rect(0, 240, 32)
      if (this.classList.contains('safe-area-probe')) return rect(0, 0, safeAreaTop)
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

  it('カードをviewportと同じ縦横比で縮小表示する', async () => {
    const cardShell = document.querySelector<HTMLElement>('.card-shell')
    if (!cardShell) throw new Error('Could not find theme card shell')
    const initialWidth = Number.parseFloat(cardShell.style.width)
    const initialHeight = Number.parseFloat(cardShell.style.height)
    const cardScale = cardShell.querySelector<HTMLElement>('.card-scale')
    const preview = cardShell.querySelector<HTMLElement>('.preview')

    expect(initialWidth / initialHeight).toBeCloseTo(overlayWidth / overlayHeight)
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
    expect(Number.parseFloat(zoomLayer?.style.borderRadius ?? '') * initialScale).toBeCloseTo(16)
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

    expect(themeMock.setTheme).toHaveBeenCalledWith('default')
    expect(close).toHaveBeenCalledOnce()
  })

  it('見出しの中心を画面上端とカード上端の中点に配置する', () => {
    const heading = document.querySelector<HTMLElement>('.switcher-heading')

    expect(heading?.style.top).toBe('64px')
    expect(heading?.style.visibility).toBe('visible')
  })

  it('viewport変更時に再計算し、小さい画面ではカードとの間隔を優先する', async () => {
    cardTop = 52

    window.dispatchEvent(new Event('resize'))
    await nextTick()
    await nextTick()

    const heading = document.querySelector<HTMLElement>('.switcher-heading')
    expect(heading?.style.top).toBe('8px')
    expect(8 + 32 + 12).toBeLessThanOrEqual(cardTop)
  })

  it('見出しを置く空間がない場合はカードへ重ねず非表示にする', async () => {
    cardTop = 30

    window.dispatchEvent(new Event('resize'))
    await nextTick()
    await nextTick()

    const heading = document.querySelector<HTMLElement>('.switcher-heading')
    expect(heading?.style.visibility).toBe('hidden')
  })

  it('safe area内へ入らない範囲で中点位置を補正する', async () => {
    safeAreaTop = 70

    window.dispatchEvent(new Event('resize'))
    await nextTick()
    await nextTick()

    const heading = document.querySelector<HTMLElement>('.switcher-heading')
    expect(heading?.style.top).toBe('78px')
  })

  it('visual viewportの移動とリサイズでも位置を再計算する', async () => {
    viewportOffsetTop = 20
    cardTop = 180

    visualViewport.dispatchEvent(new Event('resize'))
    await nextTick()
    await nextTick()

    const heading = document.querySelector<HTMLElement>('.switcher-heading')
    expect(heading?.style.top).toBe('84px')
  })
})
