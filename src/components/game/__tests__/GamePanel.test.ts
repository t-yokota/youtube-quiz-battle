import { createApp, h, nextTick, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { expect, it, vi } from 'vitest'
import GamePanel from '../GamePanel.vue'
import { useGameStore } from '@/stores/gameStore'
import { GameState } from '@/types'

it('PCの終了時はカード自体を再プレイボタンに置き換える', async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGameStore()
  const blocked = ref(false)
  const replay = vi.fn()
  const host = document.createElement('div')
  const app = createApp(() =>
    h(GamePanel, {
      desktop: true,
      compact: true,
      focusBlocked: blocked.value,
      onReplay: replay,
    }),
  ).use(pinia)
  app.mount(host)
  try {
    store.transitionToState(GameState.FINISHED)
    await nextTick()
    const button = host.querySelector<HTMLButtonElement>('button.answer-area')!
    expect(button).not.toBeNull()
    expect(button.textContent?.trim()).toBe('もう一度プレイ')
    expect(host.querySelector('section.answer-area')).toBeNull()
    expect(host.querySelector('.answer-input')).toBeNull()
    button.click()
    expect(replay).toHaveBeenCalledTimes(1)
    blocked.value = true
    await nextTick()
    expect(button.disabled).toBe(true)
    button.click()
    expect(replay).toHaveBeenCalledTimes(1)
    store.transitionToState(GameState.READY)
    await nextTick()
    expect(host.querySelector('.replay-card')).toBeNull()
    expect(host.querySelector('.guide-message')?.textContent).toBe(store.guideText)
  } finally {
    app.unmount()
  }
})

it.each([false, true])(
  'desktop=%sでも同じゲーム状態で案内と解答内容を切り替える',
  async (desktop) => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useGameStore()
    const host = document.createElement('div')
    const app = createApp(() => h(GamePanel, { desktop, compact: desktop })).use(pinia)
    app.mount(host)
    try {
      for (const state of [GameState.LOADING, GameState.READY, GameState.TALKING]) {
        store.transitionToState(state)
        await nextTick()
        expect(host.querySelector('.guide-message')?.textContent).toBe(store.guideText)
        expect(host.querySelector('.attempts-counter')).toBeNull()
        expect(!!host.querySelector('.down-cue')).toBe(!desktop && state === GameState.READY)
      }
      store.currentQuestionIndex = 0
      await nextTick()
      expect(host.querySelector('.guide-message')?.textContent).toBe('次の問題をお待ちください')
      for (const state of [GameState.QUESTIONING, GameState.WAITING, GameState.REVEALING]) {
        store.transitionToState(state)
        await nextTick()
        expect(host.querySelector('.guide-message')).toBeNull()
        expect(host.querySelector('.attempts-counter')).not.toBeNull()
      }
      store.transitionToState(GameState.TALKING)
      await nextTick()
      expect(host.querySelector('.attempts-counter')).toBeNull()
      expect(host.querySelector('.guide-message')?.textContent).toBe(store.guideText)
    } finally {
      app.unmount()
    }
  },
)
