import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDebugStore } from '../debugStore'

describe('useDebugStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('初期状態', () => {
    it('正常系: 全ての override は null、isMenuVisible は false', () => {
      const store = useDebugStore()

      expect(store.answerTimeLimitOverride).toBeNull()
      expect(store.maxAttemptsOverride).toBeNull()
      expect(store.jumpToRevealPeriodOverride).toBeNull()
      expect(store.hideVideoPlayerDuringAnswerOverride).toBeNull()
      expect(store.isMenuVisible).toBe(false)
    })
  })

  describe('setAnswerTimeLimitOverride', () => {
    it('正常系: 範囲内の値をそのまま設定する', () => {
      const store = useDebugStore()
      store.setAnswerTimeLimitOverride(30)
      expect(store.answerTimeLimitOverride).toBe(30)
    })

    it('異常系: 下限未満は 1 に clamp する', () => {
      const store = useDebugStore()
      store.setAnswerTimeLimitOverride(0)
      expect(store.answerTimeLimitOverride).toBe(1)
    })

    it('異常系: 上限超過は 300 に clamp する', () => {
      const store = useDebugStore()
      store.setAnswerTimeLimitOverride(310)
      expect(store.answerTimeLimitOverride).toBe(300)
    })

    it('正常系: 小数は Math.round で丸める', () => {
      const store = useDebugStore()
      store.setAnswerTimeLimitOverride(10.6)
      expect(store.answerTimeLimitOverride).toBe(11)
    })

    it('異常系: NaN は null 扱いになる', () => {
      const store = useDebugStore()
      store.setAnswerTimeLimitOverride(30)
      store.setAnswerTimeLimitOverride(NaN)
      expect(store.answerTimeLimitOverride).toBeNull()
    })

    it('正常系: null を渡すと上書き解除される', () => {
      const store = useDebugStore()
      store.setAnswerTimeLimitOverride(30)
      store.setAnswerTimeLimitOverride(null)
      expect(store.answerTimeLimitOverride).toBeNull()
    })
  })

  describe('setMaxAttemptsOverride', () => {
    it('異常系: 下限未満は 1 に clamp する', () => {
      const store = useDebugStore()
      store.setMaxAttemptsOverride(0)
      expect(store.maxAttemptsOverride).toBe(1)
    })

    it('異常系: 上限超過は 9 に clamp する', () => {
      const store = useDebugStore()
      store.setMaxAttemptsOverride(20)
      expect(store.maxAttemptsOverride).toBe(9)
    })

    it('正常系: 範囲内の値をそのまま設定する', () => {
      const store = useDebugStore()
      store.setMaxAttemptsOverride(5)
      expect(store.maxAttemptsOverride).toBe(5)
    })
  })

  describe('boolean 系 setter', () => {
    it('正常系: setJumpToRevealPeriodOverride が値をそのまま設定する', () => {
      const store = useDebugStore()
      store.setJumpToRevealPeriodOverride(true)
      expect(store.jumpToRevealPeriodOverride).toBe(true)
    })

    it('正常系: setHideVideoPlayerDuringAnswerOverride が値をそのまま設定する', () => {
      const store = useDebugStore()
      store.setHideVideoPlayerDuringAnswerOverride(true)
      expect(store.hideVideoPlayerDuringAnswerOverride).toBe(true)
    })
  })

  describe('setMenuVisible', () => {
    it('正常系: isMenuVisible を切り替える', () => {
      const store = useDebugStore()
      store.setMenuVisible(true)
      expect(store.isMenuVisible).toBe(true)
      store.setMenuVisible(false)
      expect(store.isMenuVisible).toBe(false)
    })
  })

  describe('resetOverrides', () => {
    it('正常系: 全ての override が null に戻る（isMenuVisible は不変）', () => {
      const store = useDebugStore()
      store.setAnswerTimeLimitOverride(30)
      store.setMaxAttemptsOverride(5)
      store.setJumpToRevealPeriodOverride(true)
      store.setHideVideoPlayerDuringAnswerOverride(true)
      store.setMenuVisible(true)

      store.resetOverrides()

      expect(store.answerTimeLimitOverride).toBeNull()
      expect(store.maxAttemptsOverride).toBeNull()
      expect(store.jumpToRevealPeriodOverride).toBeNull()
      expect(store.hideVideoPlayerDuringAnswerOverride).toBeNull()
      expect(store.isMenuVisible).toBe(true)
    })
  })

  describe('永続化', () => {
    it('正常系: LocalStorage に書き込まれない（セッション限り）', () => {
      const store = useDebugStore()
      store.setAnswerTimeLimitOverride(30)
      store.setMaxAttemptsOverride(5)
      store.setJumpToRevealPeriodOverride(true)
      store.setHideVideoPlayerDuringAnswerOverride(true)
      store.setMenuVisible(true)

      expect(localStorage.length).toBe(0)
    })
  })
})
