import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameState, YouTubePlayerState } from '@/types'
import { useGameStore } from '@/stores/gameStore'
import { fakePlayer, quizFixture } from '@/__tests__/helpers/gameFixture'
import { createGameManager, type GameManager } from '../gameManager'

describe('ゲーム進行の境界', () => {
  let manager: GameManager
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    manager?.destroy()
    vi.clearAllTimers()
    vi.useRealTimers()
  })
  function setup(settings = {}, zero = false) {
    const data = quizFixture(settings)
    if (zero) data.questions = data.questions.map((q, i) => (i === 0 ? { ...q, startTime: 0 } : q))
    const store = useGameStore()
    store.setQuizData(data)
    const fake = fakePlayer()
    manager = createGameManager(fake.player, data, store)
    manager.initializeExternalPauseHandling()
    store.transitionToState(GameState.READY)
    manager.handleButtonPress()
    function tick(time: number) {
      fake.setTime(time)
      manager.updateVideoTime(time)
    }
    function advanceTo(time: number) {
      for (let t = 0; t <= time; t += 0.5) tick(t)
    }
    return { store, fake, tick, advanceTo }
  }
  it('0秒開始は一度だけ開始し、リプレイでも開始する', () => {
    const { store, tick, fake } = setup({}, true)
    tick(0)
    expect(store.currentState).toBe(GameState.QUESTIONING)
    store.recordButtonPress(0)
    tick(0)
    tick(0.15)
    expect(store.pendingTimesUntilPress).toEqual([0])
    fake.notify(YouTubePlayerState.ENDED)
    manager.handleReplay()
    manager.handleButtonPress()
    tick(0)
    expect(store.currentState).toBe(GameState.QUESTIONING)
    expect(store.pendingTimesUntilPress).toEqual([])
  })
  it('前方シークの後続問題へ現在問の試行情報をコピーしない', () => {
    const { store, advanceTo, tick } = setup({ disableSeekbar: false })
    advanceTo(11)
    manager.handleButtonPress()
    vi.advanceTimersByTime(100)
    manager.handleAnswerSubmit('違う答え')
    tick(65)
    expect(store.results[0]).toMatchObject({ timesUntilPress: [1], submissionTypes: ['manual'] })
    expect(
      store.results.slice(1).map((r) => [r.userAnswers, r.timesUntilPress, r.submissionTypes]),
    ).toEqual([
      [[], [], []],
      [[], [], []],
    ])
  })
  it.each([true, false])(
    '内部シークは遅れた時刻通知を待ち、発表状態を維持する（禁止=%s）',
    (disableSeekbar) => {
      const { store, fake, advanceTo, tick } = setup({ disableSeekbar, jumpToRevealPeriod: true })
      advanceTo(11)
      manager.handleButtonPress()
      vi.advanceTimersByTime(100)
      manager.handleAnswerSubmit('東京')
      expect(fake.player.getCurrentTime()).toBe(20)
      tick(11)
      vi.advanceTimersByTime(150)
      tick(11)
      tick(20)
      tick(20.15)
      expect(store.currentState).toBe(GameState.REVEALING)
      expect(fake.player.getCurrentTime()).toBe(20.15)
      expect(store.results).toHaveLength(1)
      expect(fake.player.seekTo).not.toHaveBeenCalledWith(11)
      tick(35)
      expect(disableSeekbar ? fake.player.getCurrentTime() : store.currentState).toBe(
        disableSeekbar ? 20.15 : GameState.TALKING,
      )
    },
  )
  it('内部シーク未到達でも待機期限後は時刻監視を再開する', () => {
    const { store, advanceTo, tick } = setup({ jumpToRevealPeriod: true })
    advanceTo(11)
    manager.handleButtonPress()
    vi.advanceTimersByTime(100)
    manager.handleAnswerSubmit('東京')
    tick(11)
    vi.advanceTimersByTime(10001)
    tick(11)
    for (let t = 11.5; t <= 25; t += 0.5) tick(t)
    expect(store.currentState).toBe(GameState.TALKING)
  })
})
