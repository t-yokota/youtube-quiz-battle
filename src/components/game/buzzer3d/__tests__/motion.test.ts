import { defaultMotion, samplePress, sampleGlow } from '../motion'

describe('描画時間とゲーム時間の分離', () => {
  it('40msで押し込み、20ms保持、80msで戻る', () => {
    expect(samplePress(0).depth).toBe(0)
    expect(samplePress(40).depth).toBe(1)
    expect(samplePress(59).depth).toBe(1)
    expect(samplePress(100).depth).toBeCloseTo(0.5)
    expect(samplePress(140)).toEqual({ depth: 0, done: true })
  })
  it('負の時刻、0ms、reduced motionを扱う', () => {
    expect(samplePress(-10).depth).toBe(0)
    expect(samplePress(0, { ...defaultMotion, downMs: 0, holdMs: 0, upMs: 0 }).done).toBe(true)
    expect(samplePress(10, defaultMotion, true)).toEqual({ depth: 0, done: true })
  })
  it('500msで発光0→1→0、同じ周期を維持', () => {
    expect(sampleGlow(0)).toBe(0)
    expect(sampleGlow(250)).toBe(1)
    expect(sampleGlow(500)).toBe(0)
    expect(sampleGlow(750)).toBe(1)
  })
})
