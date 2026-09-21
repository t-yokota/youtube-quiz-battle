import { createApp, h, nextTick, reactive, ref } from 'vue'
import { defaultButton } from '@/constants/button'
import { useButtonPreviewImage } from '../useButtonPreviewImage'

const fake = vi.hoisted(() => ({ image: vi.fn() }))
vi.mock('../buttonPreviewImage', () => ({ getButtonPreviewImage: fake.image }))
let app: ReturnType<typeof createApp>
let resize: () => void
let disconnect: ReturnType<typeof vi.fn>
let host: HTMLElement
beforeEach(() => {
  fake.image.mockReset().mockReturnValue('data:image/png;base64,test')
  disconnect = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback
      }
      observe() {}
      disconnect = disconnect
    },
  )
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(250)
  host = document.createElement('div')
})
afterEach(() => {
  app.unmount()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function settle() {
  await nextTick()
  await vi.dynamicImportSettled()
  await nextTick()
}
function mount() {
  const settings = reactive({ ...defaultButton })
  app = createApp({
    setup() {
      const element = ref<HTMLElement>()
      const image = useButtonPreviewImage(element, () => settings)
      return () => h('div', { ref: element }, image.value ?? '')
    },
  })
  app.mount(host)
  return settings
}
it('2Dでは生成せず、モデル変更とリサイズに追従して2Dに戻すと画像を消す', async () => {
  const settings = mount()
  await settle()
  expect(fake.image).not.toHaveBeenCalled()
  settings.renderMode = '3d'
  await settle()
  expect(host.textContent).toContain('data:image/png')
  settings.modelId = 'waseda-style-v1'
  await settle()
  expect(fake.image).toHaveBeenLastCalledWith('waseda-style-v1', 200, 250, false)
  resize()
  await settle()
  expect(fake.image).toHaveBeenCalledTimes(3)
  settings.renderMode = '2d'
  await settle()
  expect(host.textContent).toBe('')
})
it('読込中に2Dへ戻すと古い3D画像を表示しない', async () => {
  const settings = mount()
  settings.renderMode = '3d'
  await nextTick()
  settings.renderMode = '2d'
  await settle()
  expect(host.textContent).toBe('')
})
it('失敗時は画像を使わず、破棄後は生成しない', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  fake.image.mockImplementation(() => {
    throw new Error('GPU unavailable')
  })
  const settings = mount()
  settings.renderMode = '3d'
  await settle()
  expect(host.textContent).toBe('')
  fake.image.mockClear()
  app.unmount()
  resize()
  await settle()
  expect(fake.image).not.toHaveBeenCalled()
  expect(disconnect).toHaveBeenCalledOnce()
})
