import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { installViewportHeightSync, resolveVisibleViewportHeight } from '@/utils/viewportHeight'

describe('viewportHeight', () => {
  const originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight')
  const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport')
  const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState')
  let visualViewport: EventTarget & { height: number }
  let visibilityState: DocumentVisibilityState

  beforeEach(() => {
    vi.useFakeTimers()
    visualViewport = Object.assign(new EventTarget(), { height: 700 })
    visibilityState = 'visible'
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 })
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: visualViewport,
    })
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    })
    document.documentElement.style.removeProperty('--ui-viewport-height')
    document.documentElement.style.removeProperty('--ui-layout-viewport-height')
  })

  afterEach(() => {
    vi.useRealTimers()
    if (originalInnerHeight) Object.defineProperty(window, 'innerHeight', originalInnerHeight)
    if (originalVisualViewport)
      Object.defineProperty(window, 'visualViewport', originalVisualViewport)
    else Reflect.deleteProperty(window, 'visualViewport')
    if (originalVisibilityState)
      Object.defineProperty(document, 'visibilityState', originalVisibilityState)
    document.documentElement.style.removeProperty('--ui-viewport-height')
    document.documentElement.style.removeProperty('--ui-layout-viewport-height')
    document.body.replaceChildren()
  })

  it('layout viewportより小さいvisual viewportを可視高さとして採用する', () => {
    expect(resolveVisibleViewportHeight(720, 664)).toBe(664)
    expect(resolveVisibleViewportHeight(720, undefined)).toBe(720)
  })

  it('初回表示と遅延確定したviewportをCSS変数へ同期する', () => {
    const stop = installViewportHeightSync()
    expect(document.documentElement.style.getPropertyValue('--ui-viewport-height')).toBe('700px')
    expect(document.documentElement.style.getPropertyValue('--ui-layout-viewport-height')).toBe(
      '700px',
    )

    visualViewport.height = 652
    vi.advanceTimersByTime(500)

    expect(document.documentElement.style.getPropertyValue('--ui-viewport-height')).toBe('652px')
    expect(document.documentElement.style.getPropertyValue('--ui-layout-viewport-height')).toBe(
      '652px',
    )
    stop()
  })

  it('ソフトキーボード表示中は可視高だけを更新しUI縮尺の基準高を維持する', () => {
    const stop = installViewportHeightSync()
    const input = document.createElement('input')
    input.type = 'text'
    document.body.append(input)
    input.focus()

    visualViewport.height = 420
    visualViewport.dispatchEvent(new Event('resize'))

    expect(document.documentElement.style.getPropertyValue('--ui-viewport-height')).toBe('420px')
    expect(document.documentElement.style.getPropertyValue('--ui-layout-viewport-height')).toBe(
      '700px',
    )

    input.blur()
    visualViewport.dispatchEvent(new Event('resize'))
    expect(document.documentElement.style.getPropertyValue('--ui-layout-viewport-height')).toBe(
      '700px',
    )

    visualViewport.height = 700
    visualViewport.dispatchEvent(new Event('resize'))

    expect(document.documentElement.style.getPropertyValue('--ui-layout-viewport-height')).toBe(
      '700px',
    )
    stop()
  })

  it('resize・pageshow・フォア復帰で再同期し、停止後は更新しない', () => {
    const stop = installViewportHeightSync()

    visualViewport.height = 660
    visualViewport.dispatchEvent(new Event('resize'))
    expect(document.documentElement.style.getPropertyValue('--ui-viewport-height')).toBe('660px')

    visualViewport.height = 640
    window.dispatchEvent(new Event('pageshow'))
    expect(document.documentElement.style.getPropertyValue('--ui-viewport-height')).toBe('640px')

    visibilityState = 'hidden'
    visualViewport.height = 620
    document.dispatchEvent(new Event('visibilitychange'))
    expect(document.documentElement.style.getPropertyValue('--ui-viewport-height')).toBe('640px')

    visibilityState = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(document.documentElement.style.getPropertyValue('--ui-viewport-height')).toBe('620px')

    stop()
    visualViewport.height = 600
    visualViewport.dispatchEvent(new Event('resize'))
    expect(document.documentElement.style.getPropertyValue('--ui-viewport-height')).toBe('620px')
  })

  it('Vueのmount前にviewport同期を開始する', () => {
    const mainSource = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf8')
    const installPosition = mainSource.indexOf('installViewportHeightSync()')
    const mountPosition = mainSource.indexOf("app.mount('#app')")

    expect(installPosition).toBeGreaterThan(-1)
    expect(installPosition).toBeLessThan(mountPosition)
  })
})
