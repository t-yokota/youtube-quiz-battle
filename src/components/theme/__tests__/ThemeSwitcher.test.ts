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
  let cardTop: number
  let safeAreaTop: number
  let viewportOffsetTop: number
  let visualViewport: EventTarget

  function rect(top: number, width: number, height: number): DOMRect {
    return {
      x: 0,
      y: top,
      top,
      right: width,
      bottom: top + height,
      left: 0,
      width,
      height,
      toJSON: () => ({}),
    }
  }

  beforeEach(async () => {
    cardTop = 160
    safeAreaTop = 0
    viewportOffsetTop = 0
    visualViewport = new EventTarget()
    Object.defineProperty(visualViewport, 'offsetTop', { get: () => viewportOffsetTop })
    vi.stubGlobal('visualViewport', visualViewport)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.classList.contains('card-shell')) return rect(cardTop, 148, 329)
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
    document.querySelectorAll('.switcher-overlay, .zoom-layer').forEach((element) => element.remove())
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('カルーセルの空白をタップすると閉じる', () => {
    const rail = document.querySelector<HTMLElement>('.rail')
    if (!rail) throw new Error('Could not find theme rail')

    rail.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(close).toHaveBeenCalledOnce()
  })

  it('カードのタップは背景タップと分離し、演出後にテーマを適用して閉じる', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      }),
    )
    const card = document.querySelector<HTMLElement>('.card')
    if (!card) throw new Error('Could not find theme card')

    card.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(close).not.toHaveBeenCalled()
    const zoomLayer = document.querySelector<HTMLElement>('.zoom-layer')
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

    const heading = document.querySelector<HTMLElement>('.switcher-heading')
    expect(heading?.style.top).toBe('8px')
    expect(8 + 32 + 12).toBeLessThanOrEqual(cardTop)
  })

  it('見出しを置く空間がない場合はカードへ重ねず非表示にする', async () => {
    cardTop = 30

    window.dispatchEvent(new Event('resize'))
    await nextTick()

    const heading = document.querySelector<HTMLElement>('.switcher-heading')
    expect(heading?.style.visibility).toBe('hidden')
  })

  it('safe area内へ入らない範囲で中点位置を補正する', async () => {
    safeAreaTop = 70

    window.dispatchEvent(new Event('resize'))
    await nextTick()

    const heading = document.querySelector<HTMLElement>('.switcher-heading')
    expect(heading?.style.top).toBe('78px')
  })

  it('visual viewportの移動とリサイズでも位置を再計算する', async () => {
    viewportOffsetTop = 20
    cardTop = 180

    visualViewport.dispatchEvent(new Event('resize'))
    await nextTick()

    const heading = document.querySelector<HTMLElement>('.switcher-heading')
    expect(heading?.style.top).toBe('84px')
  })
})
