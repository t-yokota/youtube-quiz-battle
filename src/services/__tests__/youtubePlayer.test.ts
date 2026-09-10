import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createYouTubePlayerManager, loadYouTubeIframeAPI } from '../youtubePlayer'
import { quizFixture } from '@/__tests__/helpers/gameFixture'
import { YouTubePlayerState } from '@/types'

let events: NonNullable<YT.PlayerOptions['events']>
let player: { destroy: ReturnType<typeof vi.fn>; playVideo: ReturnType<typeof vi.fn> }
beforeEach(() => {
  vi.useFakeTimers()
  player = { destroy: vi.fn(), playVideo: vi.fn() }
  vi.stubGlobal('YT', {
    Player: vi.fn(function (_id: string, options: YT.PlayerOptions) {
      events = options.events!
      return player
    }),
  })
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.head.querySelectorAll('script[src*="youtube.com/iframe_api"]').forEach((s) => s.remove())
})
function create(signal?: AbortSignal) {
  return createYouTubePlayerManager('player', 'video', quizFixture().settings, signal)
}
function ready() {
  events.onReady!({ target: player } as unknown as YT.PlayerEvent)
}
function error() {
  events.onError!({ data: 150 } as YT.OnErrorEvent)
}

describe('YouTube Player lifecycle', () => {
  it('ready待機の期限切れで破棄し、遅れたreadyを無視する', async () => {
    const promise = create()
    const rejected = expect(promise).rejects.toThrow(/timed out/)
    await vi.advanceTimersByTimeAsync(10000)
    await rejected
    ready()
    expect(player.destroy).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('ready後のエラーを通知し、破棄後の通知を無視する', async () => {
    const promise = create()
    ready()
    const manager = await promise
    const listener = vi.fn()
    const stateListener = vi.fn()
    manager.onError!(listener)
    manager.onStateChange(stateListener)
    error()
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'YouTube Player Error: 150' }),
    )
    manager.destroy()
    manager.destroy()
    error()
    events.onStateChange!({ data: YouTubePlayerState.ENDED } as unknown as YT.OnStateChangeEvent)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(stateListener).not.toHaveBeenCalled()
    expect(player.destroy).toHaveBeenCalledTimes(1)
  })
  it('初期化途中のabortはプレイヤーと期限タイマーを解放する', async () => {
    const controller = new AbortController()
    const promise = create(controller.signal)
    const rejected = expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejected
    ready()
    expect(player.destroy).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('初期化エラーはPromiseで通知して破棄する', async () => {
    const promise = create()
    const rejected = expect(promise).rejects.toThrow('150')
    error()
    await rejected
    expect(player.destroy).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('スクリプト待機中のabortで監視を解除する', async () => {
    vi.stubGlobal('YT', undefined)
    const controller = new AbortController()
    const promise = loadYouTubeIframeAPI(controller.signal)
    const rejected = expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejected
    expect(vi.getTimerCount()).toBe(0)
  })
})
