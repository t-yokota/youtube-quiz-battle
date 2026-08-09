import { createApp, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import QuizButton from '../QuizButton.vue'
import { useGameStore } from '@/stores/gameStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { ButtonState, GameState } from '@/types'
import type { QuizData } from '@/types'

function makeQuizData(buttonCheckEnabled: boolean): QuizData {
  return {
    videoId: 'test-video',
    questions: [
      {
        index: 0,
        startTime: 10,
        revealTime: 20,
        endTime: 25,
        answers: ['answer'],
      },
    ],
    settings: {
      maxAttempts: 2,
      answerTimeLimit: 10,
      disableSeekbar: true,
      jumpToRevealPeriod: false,
      hideVideoPlayerDuringAnswer: false,
      buttonCheckEnabled,
      debug: false,
    },
  }
}

function mountQuizButton(
  pinia: ReturnType<typeof createPinia>,
  gameStore: ReturnType<typeof useGameStore>,
) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp({
    setup: () => () => h(QuizButton, { buttonState: gameStore.buttonState }),
  })
  app.use(pinia)
  app.mount(host)

  return {
    host,
    unmount: () => {
      app.unmount()
      host.remove()
    },
  }
}

describe('QuizButtonの開始表示', () => {
  let cleanup: (() => void) | undefined

  beforeEach(() => {
    localStorage.clear()
    cleanup = undefined
  })

  afterEach(() => {
    cleanup?.()
  })

  it('ボタンチェック終了時はゲーム状態の更新前でもWAITへ切り替わる', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const gameStore = useGameStore()
    gameStore.setQuizData(makeQuizData(true))
    gameStore.transitionToState(GameState.READY)
    const mounted = mountQuizButton(pinia, gameStore)
    cleanup = mounted.unmount

    gameStore.setButtonState(ButtonState.PUSHED)
    await nextTick()
    expect(mounted.host.querySelector('.check-label')?.textContent).toContain('BUTTONCHECK')

    gameStore.setButtonState(ButtonState.DISABLED)
    await nextTick()

    expect(mounted.host.querySelector('.check-label')).toBeNull()
    expect(mounted.host.querySelector('.button-label')?.textContent).toBe('WAIT')
  })

  it('ボタンチェックOFF時はゲーム状態の更新前でも再生アイコンからWAITへ切り替わる', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const gameStore = useGameStore()
    gameStore.setQuizData(makeQuizData(true))
    useSettingsStore().setButtonCheckEnabled(false)
    gameStore.transitionToState(GameState.READY)
    const mounted = mountQuizButton(pinia, gameStore)
    cleanup = mounted.unmount

    expect(mounted.host.querySelector('.play-icon')).not.toBeNull()

    gameStore.setButtonState(ButtonState.DISABLED)
    await nextTick()

    expect(mounted.host.querySelector('.play-icon')).toBeNull()
    expect(mounted.host.querySelector('.button-label')?.textContent).toBe('WAIT')
  })
})
