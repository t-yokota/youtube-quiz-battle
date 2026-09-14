import { createApp, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import QuizButton from '../QuizButton.vue'
import { useGameStore } from '@/stores/gameStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { ButtonState, GameState } from '@/types'
const mock = vi.hoisted(() => ({
  error: undefined as undefined | ((error: Error) => void),
  dispose: vi.fn(),
  setModel: vi.fn(),
}))
vi.mock('../button3d/view', () => ({
  createButtonView: (_: unknown, options: { onError(error: Error): void }) => {
    mock.error = options.onError
    return {
      dispose: mock.dispose,
      setModel: mock.setModel,
      setState() {},
      setInteractionEnabled() {},
      acceptsPoint() {
        return true
      },
      resetView() {},
    }
  },
}))
it('3D切替と一時障害後の2D復帰で保存モデルと早押し経路を維持する', async () => {
  localStorage.clear()
  vi.clearAllMocks()
  const pinia = createPinia()
  setActivePinia(pinia)
  const game = useGameStore(),
    settings = useSettingsStore()
  game.transitionToState(GameState.READY)
  const press = vi.fn(() => game.setButtonState(ButtonState.PUSHED))
  const host = document.createElement('div')
  const app = createApp(() => h(QuizButton, { buttonState: game.buttonState, onPress: press })).use(
    pinia,
  )
  app.mount(host)
  try {
    expect(host.querySelector('.button-3d')).toBeNull()
    settings.setButtonMode('3d')
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    await nextTick()
    expect(host.querySelector<HTMLElement>('.button-rig')!.style.display).toBe('none')
    const hit = host.querySelector<HTMLButtonElement>('.button-hit')!
    hit.click()
    hit.click()
    expect(press).toHaveBeenCalledOnce()
    settings.setButtonModel('waseda-style-v1')
    await nextTick()
    expect(mock.setModel).toHaveBeenCalledWith('waseda-style-v1')
    mock.error?.(new Error('context loss'))
    await nextTick()
    expect(host.querySelector('.button-3d')).toBeNull()
    expect(host.querySelector<HTMLElement>('.button-rig')!.style.display).toBe('')
    expect(settings.button).toMatchObject({ renderMode: '3d', modelId: 'waseda-style-v1' })
    settings.setButtonMode('2d')
    await nextTick()
    settings.setButtonMode('3d')
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    await nextTick()
    expect(host.querySelector('.button-3d')).not.toBeNull()
  } finally {
    app.unmount()
  }
})

it('プレイ中の表示切替はモデルとゲーム状態を保ち、入力制限中は切り替えない', async () => {
  localStorage.clear()
  const pinia = createPinia()
  setActivePinia(pinia)
  const settings = useSettingsStore()
  const game = useGameStore()
  settings.setButtonModel('waseda-style-v1')
  game.transitionToState(GameState.QUESTIONING)
  const host = document.createElement('div')
  const { ref } = await import('vue')
  const blocked = ref(false)
  const press = vi.fn()
  const app = createApp(() =>
    h(QuizButton, { interactionBlocked: blocked.value, onPress: press }),
  ).use(pinia)
  app.mount(host)
  try {
    const toggle = host.querySelector<HTMLButtonElement>('.display-mode-toggle')!
    expect(toggle).not.toBeNull()
    toggle.click()
    await nextTick()
    expect(settings.button).toMatchObject({ renderMode: '3d', modelId: 'waseda-style-v1' })
    expect(toggle.getAttribute('aria-label')).toContain('2Dに切り替え')
    toggle.click()
    await nextTick()
    expect(settings.button.renderMode).toBe('2d')
    blocked.value = true
    await nextTick()
    expect(toggle.disabled).toBe(true)
    toggle.click()
    expect(settings.button.renderMode).toBe('2d')
    expect(game.currentState).toBe(GameState.QUESTIONING)
    expect(press).not.toHaveBeenCalled()
  } finally {
    app.unmount()
  }
})
