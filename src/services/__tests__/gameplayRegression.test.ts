import { ANSWER_START_DELAY_MS } from '@/constants/timing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameState, ButtonState, YouTubePlayerState } from '@/types'
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
    return { store, fake, tick, advanceTo, data }
  }
  it('押下音と動画停止を先に行い、点灯後も500msまでは解答期限を開始しない', () => {
    const { store, fake, advanceTo } = setup({ answerTimeLimit: 3 })
    advanceTo(11)
    manager.handleButtonPress()
    expect(fake.player.pauseVideo).toHaveBeenCalled()
    expect(store.buttonState).toBe(ButtonState.PUSHED)
    expect(store.isInputDisabled).toBe(true)
    vi.advanceTimersByTime(100)
    expect(store.buttonState).toBe(ButtonState.RELEASED)
    expect(store.currentState).toBe(GameState.QUESTIONING)
    manager.handleButtonPress()
    vi.advanceTimersByTime(399)
    expect(store.isInputDisabled).toBe(true)
    expect(store.answerTimeRemaining).toBe(3)
    vi.advanceTimersByTime(1)
    expect(store.currentState).toBe(GameState.ANSWERING)
    expect(store.answerTimeRemaining).toBe(3)
    vi.advanceTimersByTime(1000)
    expect(store.answerTimeRemaining).toBe(2)
  })
  it.each(['reset', 'destroy'] as const)(
    '点灯後の演出待ち中に%sすると解答開始を取り消す',
    (action) => {
      const { store, advanceTo } = setup()
      advanceTo(11)
      manager.handleButtonPress()
      vi.advanceTimersByTime(150)
      if (action === 'reset') manager.resetGame()
      else manager.destroy()
      vi.advanceTimersByTime(1000)
      expect(store.currentState).not.toBe(GameState.ANSWERING)
    },
  )
  it('演出待ち中は動画の再生要求を止める', () => {
    const { fake, advanceTo } = setup()
    advanceTo(11)
    manager.handleButtonPress()
    vi.advanceTimersByTime(150)
    vi.mocked(fake.player.pauseVideo).mockClear()
    fake.notify(YouTubePlayerState.PLAYING)
    expect(fake.player.pauseVideo).toHaveBeenCalled()
  })
  it.each(['settings', 'orientation', 'visibility'] as const)(
    '%s中も解答期限は進み、時間切れでは動画を再開しない',
    (reason) => {
      const { store, fake, advanceTo } = setup({ answerTimeLimit: 3, maxAttempts: 1 })
      advanceTo(11)
      manager.handleButtonPress()
      vi.advanceTimersByTime(ANSWER_START_DELAY_MS)
      manager.pauseExternal(reason)
      vi.mocked(fake.player.playVideo).mockClear()
      vi.advanceTimersByTime(2000)
      expect(store.answerTimeRemaining).toBe(1)
      vi.advanceTimersByTime(1000)
      expect(store.currentState).toBe(GameState.WAITING)
      expect(store.results[0]?.submissionTypes).toEqual(['timeout'])
      expect(fake.player.playVideo).not.toHaveBeenCalled()
      manager.resumeExternalIfReason(reason)
      expect(fake.player.playVideo).toHaveBeenCalledTimes(1)
    },
  )
  it.each([
    ['settings', 'orientation'],
    ['orientation', 'settings'],
    ['settings', 'visibility'],
  ] as const)('%sと%sが重なったら最後の解除まで停止する', (first, second) => {
    const { fake, advanceTo } = setup()
    advanceTo(11)
    manager.pauseExternal(first)
    manager.pauseExternal(second)
    vi.mocked(fake.player.playVideo).mockClear()
    manager.resumeExternalIfReason(first)
    expect(manager.isExternalPaused()).toBe(true)
    expect(fake.player.playVideo).not.toHaveBeenCalled()
    manager.resumeExternalIfReason(second)
    expect(fake.player.playVideo).toHaveBeenCalledTimes(1)
  })
  it('手動停止中に設定と横画面警告を開閉しても再生しない', () => {
    const { fake, advanceTo } = setup()
    advanceTo(11)
    fake.notify(YouTubePlayerState.PAUSED)
    manager.pauseExternal('settings')
    manager.pauseExternalForOrientation()
    vi.mocked(fake.player.playVideo).mockClear()
    manager.resumeExternalIfReason('settings')
    manager.resumeExternalIfReason('orientation')
    expect(fake.player.playVideo).not.toHaveBeenCalled()
    expect(manager.isExternalPaused()).toBe(true)
    fake.notify(YouTubePlayerState.PLAYING)
    expect(manager.isExternalPaused()).toBe(false)
  })
  it('横画面警告中にタブへ戻っても警告を閉じるまでは再生しない', () => {
    const { fake, advanceTo } = setup()
    advanceTo(11)
    manager.pauseExternalForOrientation()
    window.dispatchEvent(new Event('pagehide'))
    vi.mocked(fake.player.playVideo).mockClear()
    manager.resumeExternalIfReason('orientation')
    expect(fake.player.playVideo).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('pageshow'))
    expect(fake.player.playVideo).toHaveBeenCalledTimes(1)
  })
  it.each(['tick', 'submit'])('タイマー通知が遅れても期限後の%sで時間切れになる', (action) => {
    const { store, advanceTo } = setup({ answerTimeLimit: 3, maxAttempts: 1 })
    advanceTo(11)
    manager.handleButtonPress()
    vi.advanceTimersByTime(ANSWER_START_DELAY_MS)
    const now = performance.now()
    const clock = vi.spyOn(performance, 'now').mockReturnValue(now + 4000)
    try {
      if (action === 'tick') vi.advanceTimersByTime(1000)
      else manager.handleAnswerSubmit('東京')
      expect(store.results[0]?.submissionTypes).toEqual(['timeout'])
      expect(store.results[0]?.isCorrect).toBe(false)
    } finally {
      clock.mockRestore()
    }
  })
  it('開始演出中に設定を開いても、閉じた後に保留した動画を開始する', () => {
    const { store, fake } = setup({ buttonCheckEnabled: true })
    manager.pauseExternal('settings')
    vi.advanceTimersByTime(4000)
    expect(store.currentState).toBe(GameState.TALKING)
    expect(fake.player.playVideo).not.toHaveBeenCalled()
    manager.resumeExternalIfReason('settings')
    expect(fake.player.playVideo).toHaveBeenCalledTimes(1)
  })
  it('0秒開始は一度だけ開始し、リプレイでも開始する', () => {
    const { store, tick, advanceTo } = setup({}, true)
    tick(0)
    expect(store.currentState).toBe(GameState.QUESTIONING)
    store.recordButtonPress(0)
    tick(0)
    tick(0.15)
    expect(store.pendingTimesUntilPress).toEqual([0])
    advanceTo(65)
    manager.handleReplay()
    manager.handleButtonPress()
    tick(0)
    expect(store.currentState).toBe(GameState.QUESTIONING)
    expect(store.pendingTimesUntilPress).toEqual([])
  })
  it.each([false, true])('シーク禁止の終端移動は結果を確定せず戻す（停止中=%s）', (paused) => {
    const { store, fake, advanceTo, tick } = setup()
    advanceTo(11)
    if (paused) fake.notify(YouTubePlayerState.PAUSED)
    vi.mocked(fake.player.playVideo).mockClear()
    fake.setTime(70)
    fake.notify(YouTubePlayerState.ENDED)
    expect(fake.player.getCurrentTime()).toBe(11)
    expect(store.currentState).toBe(GameState.QUESTIONING)
    expect(store.results).toEqual([])
    expect(manager.isExternalPaused()).toBe(paused)
    expect(fake.player.playVideo).toHaveBeenCalledTimes(paused ? 0 : 1)
    // 巻き戻し後の古い終了通知と時刻通知でも結果へ進まない。
    fake.notify(YouTubePlayerState.ENDED)
    tick(70)
    expect(store.results).toEqual([])
    tick(11)
    tick(11.15)
    expect(store.currentState).toBe(GameState.QUESTIONING)
  })
  it('ENDED通知時に取得時刻が古くても戻し指示を出す', () => {
    const { store, fake, advanceTo } = setup()
    advanceTo(11)
    vi.mocked(fake.player.seekTo).mockClear()
    // 時刻キャッシュは11秒のまま、終了通知が先に届く。
    fake.notify(YouTubePlayerState.ENDED)
    expect(fake.player.seekTo).toHaveBeenCalledWith(11)
    expect(store.currentState).toBe(GameState.QUESTIONING)
  })
  it.each([false, true])(
    '最初の戻しが反映されなくても再試行して到達する（停止中=%s）',
    (paused) => {
      const { store, fake, advanceTo } = setup()
      advanceTo(11)
      if (paused) fake.notify(YouTubePlayerState.PAUSED)
      vi.mocked(fake.player.seekTo)
        .mockClear()
        .mockImplementationOnce(() => {})
      fake.setTime(70)
      fake.notify(YouTubePlayerState.ENDED)
      expect(fake.player.getCurrentTime()).toBe(70)
      vi.advanceTimersByTime(500)
      manager.updateVideoTime(fake.player.getCurrentTime())
      expect(fake.player.getCurrentTime()).toBe(11)
      expect(fake.player.seekTo).toHaveBeenCalledTimes(2)
      manager.updateVideoTime(11)
      vi.advanceTimersByTime(500)
      manager.updateVideoTime(11)
      expect(fake.player.seekTo).toHaveBeenCalledTimes(2)
      expect(fake.player.getPlayerState()).toBe(
        paused ? YouTubePlayerState.PAUSED : YouTubePlayerState.PLAYING,
      )
      expect(store.results).toEqual([])
    },
  )
  it('再生指示が終端から先頭へ戻すPlayerでも復帰位置を維持する', () => {
    const { fake, advanceTo } = setup()
    advanceTo(11)
    const play = fake.player.playVideo
    vi.mocked(play).mockImplementationOnce(() => fake.setTime(0))
    fake.setTime(70)
    fake.notify(YouTubePlayerState.ENDED)
    expect(fake.player.getCurrentTime()).toBe(11)
  })
  it.each(['reset', 'destroy'])('終端復帰待機中の%sで再試行を解除する', (action) => {
    const { store, fake, advanceTo } = setup()
    advanceTo(11)
    vi.mocked(fake.player.seekTo).mockImplementationOnce(() => {})
    fake.setTime(70)
    fake.notify(YouTubePlayerState.ENDED)
    if (action === 'reset') {
      manager.resetGame()
      store.transitionToState(GameState.READY)
    } else manager.destroy()
    vi.mocked(fake.player.seekTo).mockClear()
    vi.advanceTimersByTime(500)
    manager.updateVideoTime(70)
    expect(fake.player.seekTo).not.toHaveBeenCalled()
  })
  it.each(['stall', 'orientation'] as const)(
    '復帰中の%sでも到達確認し停止理由を尊重する',
    (reason) => {
      const { fake, advanceTo } = setup()
      advanceTo(11)
      vi.mocked(fake.player.seekTo).mockImplementationOnce(() => {})
      fake.setTime(70)
      fake.notify(YouTubePlayerState.ENDED)
      manager.pauseExternal(reason)
      vi.advanceTimersByTime(500)
      manager.updateVideoTime(70)
      expect(fake.player.getCurrentTime()).toBe(11)
      manager.updateVideoTime(11)
      expect(manager.isExternalPaused()).toBe(reason === 'orientation')
      expect(fake.player.getPlayerState()).toBe(
        reason === 'orientation' ? YouTubePlayerState.PAUSED : YouTubePlayerState.PLAYING,
      )
    },
  )
  it('到達しない復帰も期限後には通常監視へ戻る', () => {
    const { fake, advanceTo } = setup()
    advanceTo(11)
    vi.mocked(fake.player.seekTo).mockImplementationOnce(() => {})
    fake.setTime(70)
    fake.notify(YouTubePlayerState.ENDED)
    vi.advanceTimersByTime(10001)
    manager.updateVideoTime(70)
    expect(fake.player.getCurrentTime()).toBe(11)
  })
  it('シーク許可中でも解答中の終端移動は解答状態を維持する', () => {
    const { store, fake, advanceTo } = setup({ disableSeekbar: false })
    advanceTo(11)
    manager.handleButtonPress()
    vi.advanceTimersByTime(ANSWER_START_DELAY_MS)
    fake.setTime(70)
    fake.notify(YouTubePlayerState.ENDED)
    expect(fake.player.getCurrentTime()).toBe(11)
    expect(store.currentState).toBe(GameState.ANSWERING)
    expect(store.results).toEqual([])
    expect(fake.player.getPlayerState()).toBe(YouTubePlayerState.PAUSED)
  })
  it('シーク許可中の終端移動は結果を確定する', () => {
    const { store, fake, advanceTo } = setup({ disableSeekbar: false })
    advanceTo(11)
    fake.setTime(70)
    fake.notify(YouTubePlayerState.ENDED)
    expect(store.currentState).toBe(GameState.FINISHED)
    expect(store.results).toHaveLength(3)
  })
  it('シーク禁止でも連続再生による自然な動画終了は確定する', () => {
    const { store, fake, advanceTo, data } = setup()
    // 最終問題のendTimeを動画より後にして、ENDED自体の確定を検証する。
    data.questions = data.questions.map((q, i) => (i === 2 ? { ...q, endTime: 80 } : q))
    advanceTo(69.5)
    expect(store.currentState).not.toBe(GameState.FINISHED)
    fake.setTime(70)
    fake.notify(YouTubePlayerState.ENDED)
    expect(store.currentState).toBe(GameState.FINISHED)
    expect(store.results).toHaveLength(3)
  })
  it('内部シーク中の古い終端通知で結果を確定しない', () => {
    const { store, fake, advanceTo, tick } = setup({ jumpToRevealPeriod: true })
    advanceTo(11)
    manager.handleButtonPress()
    vi.advanceTimersByTime(ANSWER_START_DELAY_MS)
    manager.handleAnswerSubmit('東京')
    fake.setTime(70)
    fake.notify(YouTubePlayerState.ENDED)
    expect(store.currentState).toBe(GameState.REVEALING)
    expect(store.results).toHaveLength(1)
    expect(fake.player.getCurrentTime()).toBe(20)
    tick(20)
    tick(20.15)
    expect(store.currentState).toBe(GameState.REVEALING)
  })
  it('開始前の終了通知で結果へ進まない', () => {
    const { store, fake } = setup()
    manager.resetGame()
    store.transitionToState(GameState.READY)
    fake.setTime(70)
    fake.notify(YouTubePlayerState.ENDED)
    expect(store.currentState).toBe(GameState.READY)
    expect(store.results).toEqual([])
  })
  it('前方シークの後続問題へ現在問の試行情報をコピーしない', () => {
    const { store, advanceTo, tick } = setup({ disableSeekbar: false })
    advanceTo(11)
    manager.handleButtonPress()
    vi.advanceTimersByTime(ANSWER_START_DELAY_MS)
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
      vi.advanceTimersByTime(ANSWER_START_DELAY_MS)
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
    vi.advanceTimersByTime(ANSWER_START_DELAY_MS)
    manager.handleAnswerSubmit('東京')
    tick(11)
    vi.advanceTimersByTime(10001)
    tick(11)
    for (let t = 11.5; t <= 25; t += 0.5) tick(t)
    expect(store.currentState).toBe(GameState.TALKING)
  })
  it.each(['progress', 'playing'])('150msポーリングで停滞を検出し%sで復帰する', (recovery) => {
    const { fake, advanceTo } = setup()
    advanceTo(11)
    fake.notify(YouTubePlayerState.BUFFERING)
    manager.checkStall(0, 11)
    for (let wall = 150; wall <= 1350; wall += 150) manager.checkStall(wall, 11)
    expect(manager.isExternalPaused()).toBe(true)
    expect(fake.player.pauseVideo).not.toHaveBeenCalled()
    if (recovery === 'progress') {
      fake.setTime(11.15)
      manager.checkStall(1500, 11.15)
    } else fake.notify(YouTubePlayerState.PLAYING)
    expect(manager.isExternalPaused()).toBe(false)
  })
  it('停滞中の非表示は、動画の進行では解除されない', () => {
    const { fake, advanceTo } = setup()
    advanceTo(11)
    fake.notify(YouTubePlayerState.BUFFERING)
    manager.checkStall(0, 11)
    manager.checkStall(1300, 11)
    window.dispatchEvent(new Event('pagehide'))
    expect(fake.player.pauseVideo).toHaveBeenCalled()
    manager.checkStall(1500, 11.15)
    expect(manager.isExternalPaused()).toBe(true)
    window.dispatchEvent(new Event('pageshow'))
    expect(manager.isExternalPaused()).toBe(false)
  })
  it.each([0, 100, 1900])('ボタンチェックの%s ms後に破棄すると遅延処理が残らない', (delay) => {
    const { store, fake } = setup({ buttonCheckEnabled: true })
    vi.advanceTimersByTime(delay)
    manager.destroy()
    const state = store.currentState
    const button = store.buttonState
    vi.mocked(fake.player.playVideo).mockClear()
    vi.advanceTimersByTime(20000)
    fake.notify(YouTubePlayerState.ENDED)
    expect(store.currentState).toBe(state)
    expect(store.buttonState).toBe(button)
    expect(fake.player.playVideo).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('早押し直後のリセットで古い解答カウントダウンを開始しない', () => {
    const { store, advanceTo } = setup()
    advanceTo(11)
    manager.handleButtonPress()
    manager.resetGame()
    vi.advanceTimersByTime(20000)
    expect(store.currentState).toBe(GameState.LOADING)
    expect(store.results).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })
  it('ウォームアップの重複とリセットで停止タイマーを残さない', () => {
    const { fake } = setup()
    manager.warmupVideoPlayback()
    manager.warmupVideoPlayback()
    manager.resetGame()
    vi.mocked(fake.player.seekTo).mockClear()
    vi.advanceTimersByTime(1000)
    expect(fake.player.seekTo).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('0秒開始でも開始操作前のポーリングでは出題しない', () => {
    const { store, tick } = setup({}, true)
    manager.resetGame()
    store.transitionToState(GameState.READY)
    tick(0)
    tick(0.15)
    expect(store.currentState).toBe(GameState.READY)
    manager.handleButtonPress()
    tick(0)
    expect(store.currentState).toBe(GameState.QUESTIONING)
  })
  it.each(['reset', 'destroy'])('%sで保留中の音声再生もキャンセルする', (action) => {
    const { store, fake } = setup()
    manager.destroy()
    const audio = { playSound: vi.fn(), stopSound: vi.fn() }
    manager = createGameManager(
      fake.player,
      quizFixture(),
      store,
      audio as unknown as import('../audioManager').AudioManager,
    )
    if (action === 'reset') manager.resetGame()
    else manager.destroy()
    expect(audio.stopSound).toHaveBeenCalledTimes(1)
  })
})
