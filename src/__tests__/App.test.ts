import { createApp, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../App.vue'
import { useGameStore } from '@/stores/gameStore'
import { GameState, ButtonState } from '@/types'
import { fakePlayer } from './helpers/gameFixture'
import { createYouTubePlayerManager } from '@/services/youtubePlayer'

vi.mock('@/services/quizDataLoader', async () => {
  const { quizFixture } = await import('./helpers/gameFixture')
  return { extractQuizIdFromUrl: () => 'sample', loadQuizData: async () => quizFixture() }
})
vi.mock('@/services/youtubePlayer', async () => {
  const { fakePlayer } = await import('./helpers/gameFixture')
  return {
    loadYouTubeIframeAPI: async () => {},
    createYouTubePlayerManager: vi.fn(async () => fakePlayer().player),
  }
})
vi.mock('@/services/audioManager', () => ({
  createAudioManager: () => ({
    init: async () => {},
    setVolume: vi.fn(),
    setSoundEnabled: vi.fn(),
    unlock: vi.fn(),
    playSound: vi.fn(),
    stopSound: vi.fn(),
    dispose: vi.fn(),
  }),
}))
vi.mock('virtual:pwa-register/vue', () => ({
  useRegisterSW: () => ({ needRefresh: ref(false), updateServiceWorker: vi.fn() }),
}))
vi.mock('@/services/analyticsService', () => ({
  createAnalyticsService: () => ({
    init: async () => {},
    setDebugMode: vi.fn(),
    logQuizSessionStarted: vi.fn(),
    logQuizSessionCompleted: vi.fn(),
    logSettingChanged: vi.fn(),
    logQuestionAnswered: vi.fn(),
    logAnswerSubmitted: vi.fn(),
  }),
}))
let errorListener: ((error: Error) => void) | undefined
let app: ReturnType<typeof createApp>
let host: HTMLElement
let store: ReturnType<typeof useGameStore>
async function flush() {
  for (let i = 0; i < 8; i++) await nextTick()
}
beforeEach(async () => {
  vi.useFakeTimers()
  localStorage.clear()
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
  errorListener = undefined
  vi.mocked(createYouTubePlayerManager).mockImplementation(async () => {
    const player = fakePlayer().player
    player.onError = (callback) => {
      errorListener = callback
    }
    return player
  })
  const pinia = createPinia()
  host = document.createElement('div')
  document.body.append(host)
  app = createApp(App)
  app.use(pinia)
  app.mount(host)
  store = useGameStore(pinia)
  await flush()
  expect(store.currentState).toBe(GameState.READY)
})
afterEach(() => {
  app.unmount()
  host.remove()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
function space() {
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true }),
  )
}
it('ゲート表示中のSpaceでゲームを開始せず、ゲート後は開始できる', async () => {
  space()
  await flush()
  expect(store.currentState).toBe(GameState.READY)
  host.querySelector<HTMLButtonElement>('.start-gate')!.click()
  await flush()
  space()
  await flush()
  expect(store.currentState).toBe(GameState.TALKING)
})
it('設定表示中の背面へのSpaceで解答権を取得しない', async () => {
  host.querySelector<HTMLButtonElement>('.start-gate')!.click()
  await flush()
  host.querySelector<HTMLButtonElement>('[aria-label="設定を開く"]')!.click()
  await flush()
  store.setCurrentQuestionIndex(0)
  store.transitionToState(GameState.QUESTIONING)
  space()
  await flush()
  expect(store.buttonState).toBe(ButtonState.STANDBY)
  expect(store.currentState).toBe(GameState.QUESTIONING)
})

it('ready後のPlayerエラーを表示し、ゲームループと解答タイマーを停止する', async () => {
  const player = await vi.mocked(createYouTubePlayerManager).mock.results.at(-1)!.value
  host.querySelector<HTMLButtonElement>('.start-gate')!.click()
  await flush()
  store.setCurrentQuestionIndex(0)
  store.transitionToState(GameState.QUESTIONING)
  space()
  vi.advanceTimersByTime(100)
  expect(store.currentState).toBe(GameState.ANSWERING)
  // フェイクが保持する実行時エラー通知を発火する
  errorListener?.(new Error('YouTube Player Error: 150'))
  await flush()
  expect(document.body.textContent).toContain('動画')
  expect(document.body.textContent).toContain('再読み込み')
  const remaining = store.answerTimeRemaining
  await vi.advanceTimersByTimeAsync(20000)
  expect(store.answerTimeRemaining).toBe(remaining)
  expect(vi.getTimerCount()).toBe(0)
  expect(player.pauseVideo).toHaveBeenCalled()
})
