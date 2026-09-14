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
vi.mock('../buzzer3d/view', () => ({
  createBuzzerView: (_: unknown, options: { onError(error: Error): void }) => {
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
    expect(host.querySelector('.buzzer-3d')).toBeNull()
    settings.setBuzzerMode('3d')
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    await nextTick()
    expect(host.querySelector<HTMLElement>('.button-rig')!.style.display).toBe('none')
    const hit = host.querySelector<HTMLButtonElement>('.buzzer-hit')!
    hit.click()
    hit.click()
    expect(press).toHaveBeenCalledOnce()
    settings.setBuzzerModel('waseda-style-v1')
    await nextTick()
    expect(mock.setModel).toHaveBeenCalledWith('waseda-style-v1')
    mock.error?.(new Error('context loss'))
    await nextTick()
    expect(host.querySelector('.buzzer-3d')).toBeNull()
    expect(host.querySelector<HTMLElement>('.button-rig')!.style.display).toBe('')
    expect(settings.buzzer).toMatchObject({ renderMode: '3d', modelId: 'waseda-style-v1' })
    settings.setBuzzerMode('2d')
    await nextTick()
    settings.setBuzzerMode('3d')
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    await nextTick()
    expect(host.querySelector('.buzzer-3d')).not.toBeNull()
  } finally {
    app.unmount()
  }
})
