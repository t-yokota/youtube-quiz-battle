import { expect, it } from 'vitest'
import { desktopSizing, needsPortraitLayout } from '../desktopSizing'

it('880px未満でも通常の縦積みが収まらなければ中央を制限する', () => {
  expect(needsPortraitLayout(879, 720, 17.6)).toBe(true)
  expect(needsPortraitLayout(880, 720, 17.6)).toBe(false)
  expect(desktopSizing(880, 720, 17.6).initial).toBe(640)
  expect(needsPortraitLayout(800, 600, 16)).toBe(true)
  expect(needsPortraitLayout(500, 720, 17.6)).toBe(false)
  expect(needsPortraitLayout(932, 1000, 22)).toBe(false)
})

it('モデル上限の基準は横幅や再読み込みに依存しない', () => {
  const wide = desktopSizing(1920, 990, 16)
  const narrow = desktopSizing(968, 990, 16)
  expect(narrow.modelReference).toBe(wide.modelReference)
  expect(wide.modelReference).toBeCloseTo((((990 * 13) / 25) * 16) / 9)
  expect(desktopSizing(968, 990, 24).modelReference).toBe(wide.modelReference)
  expect(desktopSizing(968, 800, 16).modelReference).toBeLessThan(wide.modelReference)
})

it('短い画面では操作領域を残して640px未満へ動画を縮める', () => {
  const size = desktopSizing(1366, 550, 16)
  expect(size.maximum).toBeCloseTo(((550 - 256 - 1) * 16) / 9)
  expect(size.initial).toBe(size.maximum)
  expect(size.minimum).toBeLessThan(640)
  expect((size.initial * 9) / 16 + 256 + 1).toBeLessThanOrEqual(550)
  expect(size.needsPortrait).toBe(false)
})
it('通常は高さ比率と60%上限、左右の必要幅を維持する', () => {
  expect(desktopSizing(1440, 1000, 16).initial).toBe(864)
  expect(desktopSizing(1100, 1000, 16).initial).toBe(660)
  expect(desktopSizing(1440, 1000, 16).maximum).toBe(960)
})
it('極端に短い画面はPC配置の下限を保ち縦長表示への切替を要求する', () => {
  expect(desktopSizing(960, 280, 16)).toEqual({
    minimum: 480,
    maximum: 480,
    initial: 480,
    modelReference: 480,
    needsPortrait: true,
  })
})

it('最小動画と操作領域が収まる境界で縦長表示から復帰する', () => {
  expect(desktopSizing(1366, 478, 13).needsPortrait).toBe(true)
  expect(desktopSizing(1366, 479, 13).needsPortrait).toBe(false)
})
