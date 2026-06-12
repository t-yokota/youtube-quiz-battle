import { describe, it, expect, beforeEach } from 'vitest'
import { TimeManager, createTimeManager } from '../timeManager'
import type { QuizQuestion } from '@/types'

// テスト用のクイズデータ
// Q1: start=10, reveal=20, end=25
// Q2: start=30, reveal=40, end=45 (othersAnsweringPeriods: 32-35)
const makeQuestions = (): QuizQuestion[] => [
  {
    index: 0,
    startTime: 10,
    revealTime: 20,
    endTime: 25,
    answers: ['東京'],
  },
  {
    index: 1,
    startTime: 30,
    revealTime: 40,
    endTime: 45,
    answers: ['大阪'],
    othersAnsweringPeriods: [{ startTime: 32, endTime: 35 }],
  },
]

describe('TimeManager', () => {
  let tm: TimeManager

  beforeEach(() => {
    tm = createTimeManager(makeQuestions())
  })

  // ============================================================================
  // 基本的な時間管理
  // ============================================================================

  describe('時間変数の管理', () => {
    it('初期値は 0', () => {
      expect(tm.getCurrentVideoTime()).toBe(0)
      expect(tm.getPreviousVideoTime()).toBe(0)
    })

    it('updateCurrentVideoTime で currentVideoTime が更新される', () => {
      tm.updateCurrentVideoTime(5.5)
      expect(tm.getCurrentVideoTime()).toBe(5.5)
    })

    it('updatePreviousVideoTime で previousVideoTime が更新される', () => {
      tm.updatePreviousVideoTime(3.0)
      expect(tm.getPreviousVideoTime()).toBe(3.0)
    })

    it('resetTimeValues で両方の時間が 0 にリセットされる', () => {
      tm.updateCurrentVideoTime(100)
      tm.updatePreviousVideoTime(99)
      tm.resetTimeValues()
      expect(tm.getCurrentVideoTime()).toBe(0)
      expect(tm.getPreviousVideoTime()).toBe(0)
    })
  })

  // ============================================================================
  // シーク検出（SEEK_TOLERANCE_SEC = 1.0秒）
  // ============================================================================

  describe('isSeekDetected', () => {
    beforeEach(() => {
      tm.updatePreviousVideoTime(10.0)
    })

    it('差が 1.0秒以下の場合はシーク未検出', () => {
      expect(tm.isSeekDetected(10.5)).toBe(false)
      expect(tm.isSeekDetected(11.0)).toBe(false)
    })

    it('差がちょうど 1.0秒の場合はシーク未検出（境界値：以下）', () => {
      expect(tm.isSeekDetected(11.0)).toBe(false) // |11.0 - 10.0| = 1.0, not > 1.0
      expect(tm.isSeekDetected(9.0)).toBe(false) // |9.0 - 10.0| = 1.0, not > 1.0
    })

    it('差が 1.0秒を超えるとシーク検出（前方）', () => {
      expect(tm.isSeekDetected(11.001)).toBe(true)
      expect(tm.isSeekDetected(20.0)).toBe(true)
    })

    it('差が 1.0秒を超えるとシーク検出（後方）', () => {
      expect(tm.isSeekDetected(8.999)).toBe(true)
      expect(tm.isSeekDetected(0.0)).toBe(true)
    })
  })

  // ============================================================================
  // isInOthersAnsweringPeriod
  // ============================================================================

  describe('isInOthersAnsweringPeriod', () => {
    const qWithPeriods = makeQuestions()[1] // othersAnsweringPeriods: 32-35
    const qWithoutPeriods = makeQuestions()[0]

    it('othersAnsweringPeriods がない場合は false', () => {
      expect(tm.isInOthersAnsweringPeriod(15, qWithoutPeriods)).toBe(false)
    })

    it('期間内は true', () => {
      expect(tm.isInOthersAnsweringPeriod(32, qWithPeriods)).toBe(true)
      expect(tm.isInOthersAnsweringPeriod(33, qWithPeriods)).toBe(true)
    })

    it('期間終了ちょうどは false', () => {
      expect(tm.isInOthersAnsweringPeriod(35, qWithPeriods)).toBe(false)
    })

    it('期間外は false', () => {
      expect(tm.isInOthersAnsweringPeriod(31, qWithPeriods)).toBe(false)
      expect(tm.isInOthersAnsweringPeriod(36, qWithPeriods)).toBe(false)
    })
  })
})
