import { createApp, h, nextTick, reactive } from 'vue'
import { ButtonState } from '@/types'
import Button3DView from '../Button3DView.vue'
const mock = vi.hoisted(() => ({
  options: null as unknown as {
    onTarget(rect: { x: number; y: number; width: number; height: number; visible: boolean }): void
    onError(error: Error): void
  },
  fail: false,
  view: {
    setState: vi.fn(),
    setInteractionEnabled: vi.fn(),
    acceptsPoint: vi.fn(() => true),
    setModel: vi.fn(),
    resetView: vi.fn(),
    dispose: vi.fn(),
  },
}))
vi.mock('../view', () => ({
  createButtonView: (_: unknown, options: unknown) => {
    mock.options = options as typeof mock.options
    if (mock.fail) throw new Error('No WebGL')
    mock.options.onTarget({ x: 100, y: 100, width: 44, height: 44, visible: true })
    return mock.view
  },
}))
let cleanup: () => void
beforeEach(() => {
  vi.clearAllMocks()
  mock.fail = false
})
afterEach(() => cleanup?.())
async function mount() {
  const props = reactive({
    buttonState: ButtonState.STANDBY,
    enabled: true,
    blocked: false,
    modelId: 'simple-round-v1' as const,
    playMode: false,
  })
  const press = vi.fn(),
    failed = vi.fn(),
    ready = vi.fn()
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(() =>
    h(Button3DView, { ...props, onPress: press, onFailed: failed, onReady: ready }),
  )
  app.mount(host)
  cleanup = () => {
    app.unmount()
    host.remove()
  }
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
  return { props, host, press, failed, ready }
}
it('文字なしのネイティブbuttonから同期通知し、状態を同期反映する', async () => {
  const { host, props, press, ready } = await mount()
  expect(ready).toHaveBeenCalled()
  const button = host.querySelector<HTMLButtonElement>('.button-hit')!
  expect(button.textContent?.trim()).toBe('')
  expect(button.getAttribute('aria-label')).toBe('早押しボタン')
  button.click()
  expect(press).toHaveBeenCalledOnce()
  props.buttonState = ButtonState.RELEASED
  await nextTick()
  expect(mock.view.setState).toHaveBeenLastCalledWith(ButtonState.RELEASED)
  props.enabled = false
  await nextTick()
  button.click()
  expect(press).toHaveBeenCalledOnce()
  props.blocked = true
  await nextTick()
  expect(host.querySelector('[inert]')).not.toBeNull()
  cleanup()
  expect(mock.view.dispose).toHaveBeenCalled()
})
it('初期化失敗を通知する', async () => {
  mock.fail = true
  const { failed, ready } = await mount()
  expect(failed).toHaveBeenCalledOnce()
  expect(ready).not.toHaveBeenCalled()
})
it('context loss後は再描画せず失敗を通知する', async () => {
  const { failed } = await mount()
  mock.options.onError(new Error('context lost'))
  expect(failed).toHaveBeenCalledOnce()
})

it('キャップのドラッグ・cancelは押下せず、次のクリックとキーボード操作は受け付ける', async () => {
  const { host, press, props } = await mount()
  const button = host.querySelector<HTMLButtonElement>('.button-hit')!
  function pointer(type: string, x = 0) {
    const e = new Event(type)
    Object.assign(e, { isPrimary: true, button: 0, clientX: x, clientY: 0 })
    button.dispatchEvent(e)
  }
  pointer('pointerdown')
  pointer('pointermove', 20)
  button.dispatchEvent(new MouseEvent('click', { detail: 1 }))
  expect(press).not.toHaveBeenCalled()
  pointer('pointerdown')
  pointer('pointercancel')
  button.dispatchEvent(new MouseEvent('click', { detail: 1 }))
  expect(press).not.toHaveBeenCalled()
  pointer('pointerdown')
  button.dispatchEvent(new MouseEvent('click', { detail: 1 }))
  expect(press).toHaveBeenCalledOnce()
  props.playMode = true
  await nextTick()
  expect(button.getAttribute('aria-label')).toBe('動画を再生')
  button.click()
  expect(press).toHaveBeenCalledTimes(2)
  host.querySelector<HTMLButtonElement>('.button-reset')!.click()
  expect(mock.view.resetView).toHaveBeenCalledOnce()
})

it('遅延ロード完了前のunmountではviewを生成しない', async () => {
  const host = document.createElement('div')
  const app = createApp(() =>
    h(Button3DView, {
      buttonState: ButtonState.STANDBY,
      enabled: true,
      blocked: false,
      modelId: 'simple-round-v1',
      playMode: false,
    }),
  )
  app.mount(host)
  app.unmount()
  await new Promise((r) => setTimeout(r, 0))
  expect(mock.view.setState).not.toHaveBeenCalled()
})
