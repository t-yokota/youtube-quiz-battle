import { calculateCardGeometry } from '@/components/theme/themeSwitcherLayout'

describe('calculateCardGeometry', () => {
  it('PCでは横長画面を見比べられる幅で2列に収める', () => {
    for (const viewportWidth of [1200, 1440, 1920]) {
      const geometry = calculateCardGeometry({ viewportWidth, viewportHeight: 900, desktop: true })
      expect(geometry.width).toBeGreaterThan(400)
      expect(geometry.width * 2 + 64).toBeLessThan(viewportWidth)
      expect(geometry.width / geometry.height).toBeCloseTo(viewportWidth / 900)
    }
  })
  it('viewportを38%へ縮小し、同じ縦横比を維持する', () => {
    const geometry = calculateCardGeometry({ viewportWidth: 390, viewportHeight: 844 })

    expect(geometry.width).toBeCloseTo(148.2)
    expect(geometry.height).toBeCloseTo(320.72)
    expect(geometry.width / geometry.height).toBeCloseTo(390 / 844)
  })

  it('タブレットではカード幅を上限以内にする', () => {
    const geometry = calculateCardGeometry({ viewportWidth: 768, viewportHeight: 1024 })

    expect(geometry.width).toBe(180)
    expect(geometry.height).toBe(240)
  })

  it('内部previewをviewportと同じ座標系のままカードへ均等縮小する', () => {
    const geometry = calculateCardGeometry({ viewportWidth: 390, viewportHeight: 667 })
    const cardScale = geometry.width / 390

    expect(geometry.previewWidth).toBe(390)
    expect(geometry.previewHeight).toBe(667)
    expect(geometry.previewScale).toBeCloseTo(cardScale)
    expect(geometry.previewWidth * geometry.previewScale).toBeCloseTo(geometry.width)
    expect(geometry.previewHeight * geometry.previewScale).toBeCloseTo(geometry.height)
  })
})
