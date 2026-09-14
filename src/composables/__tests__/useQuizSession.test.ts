import { ANSWER_START_DELAY_MS } from '@/constants/timing'
import { createApp, nextTick } from 'vue'
import { createPinia } from 'pinia'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { useQuizSession } from '../useQuizSession'
import { loadQuizData } from '@/services/quizDataLoader'
import { createAudioManager } from '@/services/audioManager'
import { useSettingsStore } from '@/stores/settingsStore'
import { useGameStore } from '@/stores/gameStore'
import { fakePlayer, quizFixture } from '@/__tests__/helpers/gameFixture'
import { GameState } from '@/types'
vi.mock('@/services/quizDataLoader', () => ({
  extractQuizIdFromUrl: () => 'sample',
  loadQuizData: vi.fn(),
}))
vi.mock('@/services/audioManager', () => ({ createAudioManager: vi.fn() }))
let session: ReturnType<typeof useQuizSession>
let store: ReturnType<typeof useGameStore>
let app: ReturnType<typeof createApp>
let host: HTMLElement
let mounted: boolean
const audio = {
  init: vi.fn(),
  setVolume: vi.fn(),
  setSoundEnabled: vi.fn(),
  unlock: vi.fn(),
  playSound: vi.fn(),
  stopSound: vi.fn(),
  dispose: vi.fn(),
}
async function flush() {
  for (let i = 0; i < 8; i++) await nextTick()
}
function mount() {
  const pinia = createPinia()
  host = document.createElement('div')
  document.body.append(host)
  app = createApp({
    setup() {
      session = useQuizSession()
      return () => null
    },
  })
  app.use(pinia)
  app.mount(host)
  mounted = true
  store = useGameStore(pinia)
}
function unmount() {
  app.unmount()
  mounted = false
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
  localStorage.clear()
  vi.mocked(loadQuizData).mockResolvedValue(quizFixture())
  vi.mocked(createAudioManager).mockReturnValue(
    audio as unknown as ReturnType<typeof createAudioManager>,
  )
  audio.init.mockResolvedValue(undefined)
})
afterEach(() => {
  if (mounted) unmount()
  host.remove()
  vi.clearAllTimers()
  vi.useRealTimers()
})
it('ready後のprimingはタップ内で同期し、設定変更と終了処理を所有する', async () => {
  mount()
  expect(session.primeMedia()).toBe(false)
  await flush()
  const { player } = fakePlayer()
  session.handlePlayerReady(player)
  expect(store.currentState).toBe(GameState.READY)
  expect(session.primeMedia()).toBe(true)
  expect(player.playVideo).toHaveBeenCalledTimes(1)
  expect(audio.unlock).toHaveBeenCalledTimes(1)
  useSettingsStore().setSoundEnabled(false)
  useSettingsStore().setVolumeLevel(2)
  await flush()
  expect(audio.setSoundEnabled).toHaveBeenLastCalledWith(false)
  expect(audio.setVolume).toHaveBeenLastCalledWith(0.5)
  // jsdomが設定保存で予約するstorageイベントを先に処理する。
  await vi.advanceTimersByTimeAsync(0)
  unmount()
  expect(audio.dispose).toHaveBeenCalledTimes(1)
  expect(player.destroy).not.toHaveBeenCalled() // PlayerはVideoPlayerが所有
  expect(vi.getTimerCount()).toBe(0)
  session.pressButton()
  session.replay()
  expect(session.primeMedia()).toBe(false)
  expect(player.playVideo).toHaveBeenCalledTimes(1)
})
it.each(['resolve', 'reject'])(
  'データ取得中のunmountはabortし、遅れた%sを反映しない',
  async (outcome) => {
    let resolve!: (data: ReturnType<typeof quizFixture>) => void
    let reject!: (error: Error) => void
    vi.mocked(loadQuizData).mockImplementation(
      () =>
        new Promise((yes, no) => {
          resolve = yes
          reject = no
        }),
    )
    mount()
    const signal = vi.mocked(loadQuizData).mock.calls[0][1]!
    unmount()
    expect(signal.aborted).toBe(true)
    if (outcome === 'resolve') resolve(quizFixture())
    else reject(new Error('QUIZ_DATA_LOAD_FAILED'))
    await flush()
    expect(session.quizData.value).toBeNull()
    expect(session.initError.value).toBeNull()
    expect(store.quizData).toBeNull()
    expect(store.currentState).toBe(GameState.LOADING)
  },
)
it('unmount後の音声エラー・Player readyを無視する', async () => {
  let reject!: (error: Error) => void
  audio.init.mockImplementation(
    () =>
      new Promise((_resolve, no) => {
        reject = no
      }),
  )
  mount()
  await flush()
  unmount()
  const { player } = fakePlayer()
  reject(new Error('AUDIO_LOAD_FAILED'))
  session.handlePlayerReady(player)
  await flush()
  expect(session.initError.value).toBeNull()
  expect(session.playerManagerRef.value).toBeNull()
  expect(store.currentState).toBe(GameState.LOADING)
  expect(vi.getTimerCount()).toBe(0)
})

it('早押しと解答を委譲し、画面向きによる停止・再開を維持する', async () => {
  mount()
  await flush()
  const { player } = fakePlayer()
  session.handlePlayerReady(player)
  session.pressButton()
  expect(store.currentState).toBe(GameState.TALKING)
  session.pauseForOrientation()
  expect(player.pauseVideo).toHaveBeenCalledTimes(1)
  session.resumeForOrientation()
  expect(player.playVideo).toHaveBeenCalledTimes(2)
  store.setCurrentQuestionIndex(0)
  store.initializeForQuestion()
  store.transitionToState(GameState.QUESTIONING)
  session.pressButton()
  vi.advanceTimersByTime(ANSWER_START_DELAY_MS)
  expect(store.currentState).toBe(GameState.ANSWERING)
  session.submitAnswer('東京')
  expect(store.currentState).toBe(GameState.WAITING)
  expect(store.results[0]).toMatchObject({ isCorrect: true, userAnswers: ['東京'] })
})

it('Player初期化前の設定・横画面状態を引き継ぎ、最後の解除まで再生しない', async () => {
  mount()
  session.setSettingsOpen(true)
  session.pauseForOrientation()
  await flush()
  const { player } = fakePlayer()
  session.handlePlayerReady(player)
  store.transitionToState(GameState.TALKING)
  session.setSettingsOpen(false)
  expect(player.playVideo).not.toHaveBeenCalled()
  session.resumeForOrientation()
  // 開く前から再生していなかったので、閉じるだけでは再開しない。
  expect(player.playVideo).not.toHaveBeenCalled()
})
