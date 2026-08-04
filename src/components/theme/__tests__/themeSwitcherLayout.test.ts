import { calculateHeadingPlacement } from '@/components/theme/themeSwitcherLayout'

describe('calculateHeadingPlacement', () => {
  const base = {
    viewportTop: 0,
    cardTop: 160,
    headingHeight: 32,
    safeAreaTop: 0,
    viewportPadding: 8,
    cardGap: 12,
  }

  it('見出しの中心をviewport上端とカード上端の中点に置く', () => {
    expect(calculateHeadingPlacement(base)).toEqual({ top: 64, visible: true })
  })

  it('visual viewportの上端位置を中点計算へ反映する', () => {
    expect(
      calculateHeadingPlacement({ ...base, viewportTop: 20, cardTop: 180 }),
    ).toEqual({ top: 84, visible: true })
  })

  it('中点がsafe area内へ入る場合は下限位置へ補正する', () => {
    expect(calculateHeadingPlacement({ ...base, safeAreaTop: 70 })).toEqual({
      top: 78,
      visible: true,
    })
  })

  it('小さい画面ではカードとの間隔を優先する', () => {
    expect(calculateHeadingPlacement({ ...base, cardTop: 52 })).toEqual({
      top: 8,
      visible: true,
    })
  })

  it('カードと重ならずに配置できない場合は非表示にする', () => {
    expect(calculateHeadingPlacement({ ...base, cardTop: 30 })).toEqual({
      top: 8,
      visible: false,
    })
  })

  it('safe areaとカード間隔を同時に満たせない場合は非表示にする', () => {
    expect(
      calculateHeadingPlacement({ ...base, cardTop: 80, safeAreaTop: 70 }),
    ).toEqual({ top: 78, visible: false })
  })
})
