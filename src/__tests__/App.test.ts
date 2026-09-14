import { ANSWER_START_DELAY_MS } from '@/constants/timing'
import { createApp, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../App.vue'
import { useGameStore } from '@/stores/gameStore'
import { GameState, ButtonState } from '@/types'
import { createAnalyticsService } from '@/services/analyticsService'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDebugStore } from '@/stores/debugStore'
import { fakePlayer, quizFixture } from './helpers/gameFixture'
import { createYouTubePlayerManager } from '@/services/youtubePlayer'

vi.mock('@/services/quizDataLoader', async () => {
  const { quizFixture } = await import('./helpers/gameFixture')
  return {
    extractQuizIdFromUrl: () => 'sample',
    loadQuizData: async () => quizFixture({ debug: true }),
  }
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
    init: () =>
      new Promise<void>((_resolve, reject) => {
        rejectAudioInit = reject
      }),
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
  createAnalyticsService: vi.fn(() => ({
    init: async () => {},
    setDebugMode: vi.fn(),
    logQuizSessionStarted: vi.fn(),
    logQuizSessionCompleted: vi.fn(),
    logSettingChanged: vi.fn(),
    logQuestionAnswered: vi.fn(),
    logAnswerSubmitted: vi.fn(),
  })),
}))
let rejectAudioInit: (error: Error) => void
let errorListener: ((error: Error) => void) | undefined
let isMounted = false
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
  isMounted = true
  store = useGameStore(pinia)
  await flush()
  expect(store.currentState).toBe(GameState.READY)
})
afterEach(() => {
  if (isMounted) app.unmount()
  isMounted = false
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
  vi.advanceTimersByTime(ANSWER_START_DELAY_MS)
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

it('遅れて失敗する音声初期化でも稼働中のゲームを停止する', async () => {
  const player = await vi.mocked(createYouTubePlayerManager).mock.results.at(-1)!.value
  host.querySelector<HTMLButtonElement>('.start-gate')!.click()
  await flush()
  space()
  await flush()
  rejectAudioInit(new Error('AUDIO_LOAD_FAILED'))
  await flush()
  expect(player.pauseVideo).toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(20000)
  expect(vi.getTimerCount()).toBe(0)
  expect(document.body.textContent).toContain('再読み込み')
})

function analytics() {
  return vi.mocked(createAnalyticsService).mock.results.at(-1)!.value as ReturnType<
    typeof createAnalyticsService
  >
}
async function startQuiz() {
  host.querySelector<HTMLButtonElement>('.start-gate')!.click()
  await flush()
  space()
  await flush()
}
it('開始時の実効設定を一度送信し、進行中の設定変更だけを通知する', async () => {
  const service = analytics()
  const settings = useSettingsStore()
  const debug = useDebugStore()
  settings.setDisableSeekbarOverride(false)
  debug.setAnswerTimeLimitOverride(20)
  debug.setMaxAttemptsOverride(2)
  debug.setJumpToRevealPeriodOverride(true)
  debug.setHideVideoPlayerDuringAnswerOverride(true)
  await flush()
  expect(service.logSettingChanged).not.toHaveBeenCalled()
  await startQuiz()
  expect(service.logQuizSessionStarted).toHaveBeenCalledExactlyOnceWith({
    quizSessionId: expect.any(String),
    quizId: 'sample',
    videoId: quizFixture().videoId,
    videoTitle: 'Quiz',
    totalQuestions: 3,
    buttonCheckEnabled: false,
    seekAllowed: true,
    jumpToRevealPeriod: true,
    hideVideoPlayerDuringAnswer: true,
    answerTimeLimit: 20,
    maxAttempts: 2,
  })
  settings.setDisableSeekbarOverride(true)
  settings.setButtonCheckEnabled(true)
  debug.setAnswerTimeLimitOverride(15)
  debug.setMaxAttemptsOverride(3)
  debug.setJumpToRevealPeriodOverride(false)
  debug.setHideVideoPlayerDuringAnswerOverride(false)
  await flush()
  const calls = vi
    .mocked(service.logSettingChanged)
    .mock.calls.map(([event]) => [event.settingName, event.settingValue])
  expect(calls).toEqual(
    expect.arrayContaining([
      ['seek_allowed', false],
      ['button_check_enabled', true],
      ['answer_time_limit', 15],
      ['max_attempts', 3],
      ['jump_to_reveal_period', false],
      ['hide_video_player_during_answer', false],
    ]),
  )
  expect(calls).toHaveLength(6)
})
it('複数試行・スキップ・無解答のpayloadと完走集計を一度だけ送信する', async () => {
  const service = analytics()
  await startQuiz()
  const session = vi.mocked(service.logQuizSessionStarted).mock.calls[0][0].quizSessionId
  store.setCurrentQuestionIndex(0)
  store.initializeForQuestion()
  store.transitionToState(GameState.ANSWERING)
  store.recordButtonPress(1.2)
  store.handleAnswerSubmit('不正解')
  await flush()
  expect(service.logAnswerSubmitted).not.toHaveBeenCalled()
  store.recordButtonPress(2.5)
  store.handleAnswerSubmit('東京')
  await flush()
  const common = {
    quizSessionId: session,
    quizId: 'sample',
    videoId: quizFixture().videoId,
    videoTitle: 'Quiz',
    questionIndex: 0,
    questionText: undefined,
  }
  expect(vi.mocked(service.logAnswerSubmitted).mock.calls.map(([event]) => event)).toEqual([
    {
      ...common,
      attemptIndex: 1,
      answer: '不正解',
      isCorrect: false,
      isFinalAttempt: false,
      submissionType: 'manual',
      timeUntilPressSec: 1.2,
    },
    {
      ...common,
      attemptIndex: 2,
      answer: '東京',
      isCorrect: true,
      isFinalAttempt: true,
      submissionType: 'manual',
      timeUntilPressSec: 2.5,
    },
  ])
  expect(service.logQuestionAnswered).toHaveBeenCalledExactlyOnceWith({
    ...common,
    result: 'correct',
    attemptsUsed: 2,
    answers: '不正解|東京',
    timesUntilPressSec: '1.2|2.5',
    firstTimeUntilPressSec: 1.2,
  })
  const noAttempts = { timesUntilPress: [], submissionTypes: [] }
  store.recordResult(2, false, '大阪', [], true, noAttempts)
  store.recordResult(3, false, '京都', [], false, noAttempts)
  store.transitionToState(GameState.FINISHED)
  await flush()
  expect(vi.mocked(service.logQuestionAnswered).mock.calls.map(([event]) => event.result)).toEqual([
    'correct',
    'skipped',
    'unanswered',
  ])
  expect(service.logQuizSessionCompleted).toHaveBeenCalledExactlyOnceWith({
    quizSessionId: session,
    quizId: 'sample',
    videoId: quizFixture().videoId,
    videoTitle: 'Quiz',
    totalQuestions: 3,
    correctCount: 1,
    incorrectCount: 0,
    skippedCount: 1,
    unansweredCount: 1,
    totalAttempts: 2,
  })
  store.transitionToState(GameState.FINISHED)
  store.recordResult(3, false, '京都', [], false, noAttempts)
  await flush()
  expect(service.logQuestionAnswered).toHaveBeenCalledTimes(3)
  expect(service.logAnswerSubmitted).toHaveBeenCalledTimes(2)
  expect(service.logQuizSessionCompleted).toHaveBeenCalledTimes(1)
})
it('リプレイでセッションIDと送信済み件数を更新しtimeoutの空解答も記録する', async () => {
  const service = analytics()
  await startQuiz()
  store.recordResult(1, false, '東京', [], true, { timesUntilPress: [], submissionTypes: [] })
  store.transitionToState(GameState.FINISHED)
  await flush()
  useSettingsStore().setDisableSeekbarOverride(false)
  await flush()
  expect(service.logSettingChanged).not.toHaveBeenCalled()
  host.querySelector<HTMLButtonElement>('.replay-button')!.click()
  await flush()
  expect(store.currentState).toBe(GameState.READY)
  space()
  await flush()
  const starts = vi.mocked(service.logQuizSessionStarted).mock.calls
  expect(starts).toHaveLength(2)
  expect(starts[1][0].quizSessionId).not.toBe(starts[0][0].quizSessionId)
  expect(starts[1][0].seekAllowed).toBe(true)
  store.setCurrentQuestionIndex(0)
  store.initializeForQuestion()
  store.recordButtonPress(0.4)
  store.transitionToState(GameState.ANSWERING)
  store.handleAnswerSubmit('', 'timeout')
  store.recordResult(1, false, '東京', [''], false)
  await flush()
  expect(service.logAnswerSubmitted).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      quizSessionId: starts[1][0].quizSessionId,
      submissionType: 'timeout',
      answer: '',
      isCorrect: false,
      isFinalAttempt: true,
      timeUntilPressSec: 0.4,
    }),
  )
  expect(service.logQuestionAnswered).toHaveBeenCalledTimes(2)
  expect(service.logQuestionAnswered).toHaveBeenLastCalledWith(
    expect.objectContaining({
      result: 'incorrect',
      attemptsUsed: 1,
      quizSessionId: starts[1][0].quizSessionId,
    }),
  )
})

it('App終了後のストア変更ではAnalyticsを送信しない', async () => {
  const service = analytics()
  await startQuiz()
  app.unmount()
  isMounted = false
  useSettingsStore().setDisableSeekbarOverride(false)
  store.recordResult(1, false, '東京', [], true, { timesUntilPress: [], submissionTypes: [] })
  store.transitionToState(GameState.FINISHED)
  await flush()
  expect(service.logQuizSessionStarted).toHaveBeenCalledTimes(1)
  expect(service.logSettingChanged).not.toHaveBeenCalled()
  expect(service.logQuestionAnswered).not.toHaveBeenCalled()
  expect(service.logQuizSessionCompleted).not.toHaveBeenCalled()
})

it('設定からテーマ選択へ移っても停止を維持し、閉じたら再生する', async () => {
  const player = await vi.mocked(createYouTubePlayerManager).mock.results.at(-1)!.value
  host.querySelector<HTMLButtonElement>('.start-gate')!.click()
  await flush()
  space()
  await flush()
  host.querySelector<HTMLButtonElement>('[aria-label="設定を開く"]')!.click()
  await flush()
  vi.mocked(player.playVideo).mockClear()
  const settings = Array.from(document.querySelectorAll('[role="dialog"][aria-label="設定"]')).at(
    -1,
  )!
  settings.querySelector<HTMLButtonElement>('.theme-button')!.click()
  await flush()
  expect(player.playVideo).not.toHaveBeenCalled()
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await flush()
  expect(player.playVideo).toHaveBeenCalledTimes(1)
})

it('タッチ端末でも押下直後はフォーカスせず500ms後の解答開始に合わせて移す', async () => {
  app.unmount()
  vi.mocked(window.matchMedia).mockImplementation(
    (query) =>
      ({
        matches: query === '(pointer: coarse)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  )
  const pinia = createPinia()
  app = createApp(App).use(pinia)
  app.mount(host)
  store = useGameStore(pinia)
  await flush()
  host.querySelector<HTMLButtonElement>('.start-gate')!.click()
  await flush()
  store.setCurrentQuestionIndex(0)
  store.transitionToState(GameState.QUESTIONING)
  await flush()
  const input = host.querySelector<HTMLInputElement>('.answer-input')!
  const focus = vi.spyOn(input, 'focus')
  space()
  await flush()
  expect(focus).not.toHaveBeenCalled()
  vi.advanceTimersByTime(499)
  await flush()
  expect(focus).not.toHaveBeenCalled()
  expect(input.disabled).toBe(true)
  vi.advanceTimersByTime(1)
  await flush()
  expect(input.disabled).toBe(false)
  expect(focus).toHaveBeenCalledOnce()
})

it('iOSではタップ内でフォーカスし、追加の演出待ちなしで解答を開始する', async () => {
  const agent = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone')
  try {
    host.querySelector<HTMLButtonElement>('.start-gate')!.click()
    await flush()
    store.setCurrentQuestionIndex(0)
    store.transitionToState(GameState.QUESTIONING)
    await flush()
    const input = host.querySelector<HTMLInputElement>('.answer-input')!
    const focus = vi.spyOn(input, 'focus')
    space()
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(input.disabled).toBe(false)
    vi.advanceTimersByTime(101)
    await flush()
    expect(store.currentState).toBe(GameState.ANSWERING)
  } finally {
    agent.mockRestore()
  }
})
