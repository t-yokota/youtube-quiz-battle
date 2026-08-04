import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createApp, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ThemeSwitcher from '@/components/theme/ThemeSwitcher.vue'

const themeSwitcherSource = readFileSync(
  resolve(process.cwd(), 'src/components/theme/ThemeSwitcher.vue'),
  'utf8',
)

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

  beforeEach(async () => {
    close = vi.fn()
    host = document.createElement('div')
    document.body.appendChild(host)
    app = createApp(ThemeSwitcher, { isOpen: true, onClose: close })
    app.mount(host)
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

  it('タイトル領域を画面上端から相対的に下げる', () => {
    expect(themeSwitcherSource).toMatch(
      /\.switcher-heading\s*{(?=[^}]*position:\s*absolute;)(?=[^}]*top:\s*clamp\([^;]*dvh[^;]*\);)(?=[^}]*pointer-events:\s*none;)[^}]*}/s,
    )
    expect(themeSwitcherSource).toMatch(
      /\.switcher-overlay\s*{[^}]*padding-top:\s*3\.5625rem;/s,
    )
  })
})
