import { effectScope, nextTick, ref } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { useMobileVideoCollapse } from '../useMobileVideoCollapse'

afterEach(() => vi.unstubAllGlobals())
it('移動完了まで動画領域を保持し、途中の取り消し後には畳まない', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  const main = document.createElement('main')
  main.innerHTML = '<div class="video-player-container"></div><div class="game-ui"></div>'
  const resolve: (() => void)[] = []
  const cancel = vi.fn()
  const game = main.querySelector<HTMLElement>('.game-ui')!
  game.animate = vi.fn(
    () =>
      ({
        finished: new Promise<void>((done) => resolve.push(done)),
        cancel,
      }) as unknown as Animation,
  )
  const scope = effectScope()
  const requested = ref(false)
  const collapsed = scope.run(() => useMobileVideoCollapse(ref(main), requested))!
  const flush = async () => {
    for (let i = 0; i < 8; i++) await nextTick()
  }
  try {
    requested.value = true
    await flush()
    expect(collapsed.value).toBe(false)
    expect(game.animate).toHaveBeenCalledOnce()
    resolve[0]!()
    await flush()
    expect(collapsed.value).toBe(true)
    requested.value = false
    await flush()
    expect(collapsed.value).toBe(false)
    requested.value = true
    await flush()
    requested.value = false
    await flush()
    resolve[2]!()
    await flush()
    expect(collapsed.value).toBe(false)
    expect(cancel).toHaveBeenCalled()
  } finally {
    scope.stop()
  }
})
