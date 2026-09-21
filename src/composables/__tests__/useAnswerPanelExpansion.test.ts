import { effectScope } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GameState } from '@/types'
import { useGameStore } from '@/stores/gameStore'
import { ANSWER_PANEL_RESULT_HOLD_MS } from '@/constants/timing'
import { useAnswerPanelExpansion } from '../useAnswerPanelExpansion'

let scope: ReturnType<typeof effectScope>
beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  scope = effectScope()
})
afterEach(() => {
  scope.stop()
  vi.useRealTimers()
})
it.each([GameState.QUESTIONING, GameState.WAITING, GameState.REVEALING])(
  '判定後の%sでも1秒だけ維持し、判定表示を変更しない',
  (state) => {
    const store = useGameStore()
    const expanded = scope.run(useAnswerPanelExpansion)!
    store.transitionToState(GameState.ANSWERING)
    expect(expanded.value).toBe(true)
    store.answerResult = state === GameState.QUESTIONING ? 'incorrect' : 'correct'
    store.transitionToState(state)
    vi.advanceTimersByTime(ANSWER_PANEL_RESULT_HOLD_MS - 1)
    expect(expanded.value).toBe(true)
    vi.advanceTimersByTime(1)
    expect(expanded.value).toBe(false)
    expect(store.answerResult).not.toBeNull()
    store.transitionToState(GameState.REVEALING)
    expect(expanded.value).toBe(false)
  },
)
it('維持中のWAITING→REVEALINGでは期限を延長しない', () => {
  const store = useGameStore()
  const expanded = scope.run(useAnswerPanelExpansion)!
  store.transitionToState(GameState.ANSWERING)
  store.answerResult = 'correct'
  store.transitionToState(GameState.WAITING)
  vi.advanceTimersByTime(500)
  store.transitionToState(GameState.REVEALING)
  vi.advanceTimersByTime(500)
  expect(expanded.value).toBe(false)
})
it('再解答時は以前の縮小予約を解除し、連続不正解でも改めて維持する', () => {
  const store = useGameStore()
  const expanded = scope.run(useAnswerPanelExpansion)!
  store.transitionToState(GameState.ANSWERING)
  store.answerResult = 'incorrect'
  store.transitionToState(GameState.QUESTIONING)
  vi.advanceTimersByTime(500)
  store.transitionToState(GameState.ANSWERING)
  vi.advanceTimersByTime(1000)
  expect(expanded.value).toBe(true)
  store.transitionToState(GameState.QUESTIONING)
  vi.advanceTimersByTime(1000)
  expect(expanded.value).toBe(false)
})
it('未解答のWAITING・REVEALINGでは拡大しない', () => {
  const store = useGameStore()
  const expanded = scope.run(useAnswerPanelExpansion)!
  for (const state of [GameState.WAITING, GameState.REVEALING, GameState.TALKING]) {
    store.transitionToState(state)
    expect(expanded.value).toBe(false)
  }
})
it('次問と終了で縮小予約を解除し、破棄時もタイマーを残さない', () => {
  const store = useGameStore()
  const expanded = scope.run(useAnswerPanelExpansion)!
  store.transitionToState(GameState.ANSWERING)
  store.answerResult = 'correct'
  store.transitionToState(GameState.WAITING)
  store.currentQuestionIndex++
  expect(expanded.value).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
  store.transitionToState(GameState.ANSWERING)
  store.transitionToState(GameState.FINISHED)
  expect(expanded.value).toBe(false)
  store.transitionToState(GameState.ANSWERING)
  store.transitionToState(GameState.WAITING)
  scope.stop()
  expect(vi.getTimerCount()).toBe(0)
})
