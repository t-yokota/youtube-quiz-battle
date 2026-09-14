import { createApp, h, nextTick, ref } from 'vue'
import DimensionIcon from '../DimensionIcon.vue'

it('指定キットの平面から立方体へ変形し、途中反転と破棄に対応する', async () => {
  let now = 0
  let frame: FrameRequestCallback | undefined
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback) => {
      frame = callback
      return 1
    }),
  )
  const cancel = vi.fn()
  vi.stubGlobal('cancelAnimationFrame', cancel)
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  const solid = ref(false)
  const host = document.createElement('div')
  const app = createApp(() => h(DimensionIcon, { solid: solid.value }))
  app.mount(host)
  const face = () => host.querySelector('.dimension-face')!.getAttribute('points')
  try {
    expect(face()).toBe('2,30 34,30 34,62 2,62')
    expect(
      Array.from(host.querySelectorAll('text')).map((text) => text.textContent?.trim()),
    ).toEqual(['2D', '3D'])
    solid.value = true
    await nextTick()
    now = 210
    frame!(now)
    await nextTick()
    const midway = face()
    expect(midway).not.toBe('2,30 34,30 34,62 2,62')
    solid.value = false
    await nextTick()
    expect(face()).toBe(midway)
    now = 630
    frame!(now)
    await nextTick()
    expect(face()).toBe('2,30 34,30 34,62 2,62')
    solid.value = true
    await nextTick()
    now = 1050
    frame!(now)
    await nextTick()
    expect(host.querySelector('.dimension-top')!.getAttribute('opacity')).toBe('1')
    expect(host.querySelectorAll('text')[0]!.getAttribute('opacity')).toBe('0')
    expect(host.querySelectorAll('text')[1]!.getAttribute('opacity')).toBe('1')
    expect(face()).not.toBe(midway)
  } finally {
    app.unmount()
    expect(cancel).toHaveBeenCalled()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  }
})

it('動きを減らす設定では即時に切り替える', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const request = vi.fn()
  vi.stubGlobal('requestAnimationFrame', request)
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const solid = ref(false)
  const host = document.createElement('div')
  const app = createApp(() => h(DimensionIcon, { solid: solid.value }))
  app.mount(host)
  try {
    solid.value = true
    await nextTick()
    expect(host.querySelector('.dimension-side')!.getAttribute('opacity')).toBe('1')
    expect(request).not.toHaveBeenCalled()
  } finally {
    app.unmount()
    vi.unstubAllGlobals()
  }
})
