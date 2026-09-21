import { createApp, h, nextTick, ref } from 'vue'
import DimensionIcon from '../DimensionIcon.vue'

it.each([44, 56])(
  '表示サイズ%spxで1px縮小・中心維持し、途中反転と破棄に対応する',
  async (displaySize) => {
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
    const app = createApp(() => h(DimensionIcon, { solid: solid.value, displaySize }))
    app.mount(host)
    const face = () => host.querySelector('.dimension-face')!.getAttribute('points')
    try {
      const initial = face()!
      const points = initial.split(' ').map((point) => point.split(',').map(Number))
      expect(((points[1]![0]! - points[0]![0]!) * displaySize) / 64).toBeCloseTo(
        displaySize / 2 - 1,
      )
      expect((points[0]![0]! + points[2]![0]!) / 2).toBeCloseTo(18)
      expect((points[0]![1]! + points[2]![1]!) / 2).toBeCloseTo(46)
      expect(
        Array.from(host.querySelectorAll('text')).map((text) => text.textContent?.trim()),
      ).toEqual(['2D', '3D'])
      solid.value = true
      await nextTick()
      now = 210
      frame!(now)
      await nextTick()
      const midway = face()
      expect(midway).not.toBe(initial)
      solid.value = false
      await nextTick()
      expect(face()).toBe(midway)
      now = 630
      frame!(now)
      await nextTick()
      expect(face()).toBe(initial)
      solid.value = true
      await nextTick()
      now = 1050
      frame!(now)
      await nextTick()
      expect(host.querySelector('.dimension-top')!.getAttribute('opacity')).toBe('1')
      expect(host.querySelectorAll('text')[0]!.getAttribute('opacity')).toBe('0')
      expect(host.querySelectorAll('text')[1]!.getAttribute('opacity')).toBe('1')
      expect(face()).not.toBe(midway)
      const vertices = Array.from(host.querySelectorAll('polygon')).flatMap((polygon) =>
        polygon
          .getAttribute('points')!
          .split(' ')
          .map((point) => point.split(',').map(Number)),
      )
      const xs = vertices.map((point) => point[0]!)
      const ys = vertices.map((point) => point[1]!)
      expect(((Math.max(...xs) - Math.min(...xs)) * displaySize) / 64).toBeCloseTo(
        (24.12 * Math.SQRT2 * displaySize) / 64 - 1,
      )
      expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(18)
      expect((Math.max(...ys) + Math.min(...ys)) / 2).toBeCloseTo(46)
    } finally {
      app.unmount()
      expect(cancel).toHaveBeenCalled()
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    }
  },
)

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
