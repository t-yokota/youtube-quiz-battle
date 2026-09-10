import { createApp, nextTick } from 'vue'
import { createPinia } from 'pinia'
import { afterEach, expect, it, vi } from 'vitest'
import VideoPlayer from '../VideoPlayer.vue'
import { createYouTubePlayerManager, loadYouTubeIframeAPI } from '@/services/youtubePlayer'
import { fakePlayer, quizFixture } from '@/__tests__/helpers/gameFixture'
vi.mock('@/services/youtubePlayer', () => ({
  loadYouTubeIframeAPI: vi.fn(),
  createYouTubePlayerManager: vi.fn(),
}))
let app: ReturnType<typeof createApp>
let host: HTMLElement
afterEach(() => {
  app.unmount()
  host.remove()
  vi.resetAllMocks()
})
async function flush() {
  for (let i = 0; i < 5; i++) await nextTick()
}
function mount() {
  const onReady = vi.fn()
  const onError = vi.fn()
  host = document.createElement('div')
  document.body.append(host)
  app = createApp(VideoPlayer, {
    videoId: 'video',
    settings: quizFixture().settings,
    onReady,
    onError,
  })
  app.use(createPinia())
  app.mount(host)
  return { onReady, onError }
}
it('API読込中のunmount後はPlayerを作成しない', async () => {
  let finish!: () => void
  vi.mocked(loadYouTubeIframeAPI).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const { onReady, onError } = mount()
  app.unmount()
  finish()
  await flush()
  expect(createYouTubePlayerManager).not.toHaveBeenCalled()
  expect(onReady).not.toHaveBeenCalled()
  expect(onError).not.toHaveBeenCalled()
})
it('Player生成中にunmountすると、遅れて返るPlayerを破棄する', async () => {
  vi.mocked(loadYouTubeIframeAPI).mockResolvedValue()
  const player = fakePlayer().player
  let finish!: (value: typeof player) => void
  vi.mocked(createYouTubePlayerManager).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const { onReady, onError } = mount()
  await flush()
  app.unmount()
  finish(player)
  await flush()
  expect(player.destroy).toHaveBeenCalledTimes(1)
  expect(onReady).not.toHaveBeenCalled()
  expect(onError).not.toHaveBeenCalled()
})
