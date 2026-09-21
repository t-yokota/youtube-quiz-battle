import { createApp, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import QuizButton from '../QuizButton.vue'
import { useGameStore } from '@/stores/gameStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { ButtonState, GameState } from '@/types'
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
  )
})
afterEach(() => vi.unstubAllGlobals())
const mock = vi.hoisted(() => ({
  error: undefined as undefined | ((error: Error) => void),
  dispose: vi.fn(),
  setModel: vi.fn(),
  rotationChange: undefined as undefined | ((rotated: boolean) => void),
  resetView: vi.fn(),
}))
vi.mock('../button3d/view', () => ({
  createButtonView: (
    _: unknown,
    options: { onError(error: Error): void; onRotationChange(rotated: boolean): void },
  ) => {
    mock.error = options.onError
    mock.rotationChange = options.onRotationChange
    options.onRotationChange(false)
    return {
      dispose: mock.dispose,
      setModel: mock.setModel,
      setState() {},
      setInteractionEnabled() {},
      acceptsPoint() {
        return true
      },
      resetView() {
        mock.resetView()
        options.onRotationChange(false)
      },
      playStartPress() {},
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
    const controls = host.querySelector('.button-view-controls')!
    expect(Array.from(controls.children, (el) => el.className)).toEqual([
      'button-type-toggle',
      'display-mode-toggle',
    ])
    expect(host.querySelector('.button-reset')).toBeNull()
    mock.rotationChange?.(true)
    await nextTick()
    expect(controls.firstElementChild?.className).toBe('button-reset')
    host.querySelector<HTMLButtonElement>('.button-reset')!.click()
    await nextTick()
    expect(mock.resetView).toHaveBeenCalledOnce()
    const resetting = host.querySelector<HTMLButtonElement>('.button-reset')!
    expect(resetting.classList.contains('is-spinning')).toBe(true)
    expect(resetting.disabled).toBe(true)
    resetting.click()
    expect(mock.resetView).toHaveBeenCalledOnce()
    resetting.querySelector('svg')!.dispatchEvent(new Event('animationend'))
    await nextTick()
    expect(host.querySelector('.button-reset')).toBeNull()
    expect(press).not.toHaveBeenCalled()
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
    expect(host.querySelector('.button-reset')).toBeNull()
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
