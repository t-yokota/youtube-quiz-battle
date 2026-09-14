import { createApp, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import SettingsGeneral from '../SettingsGeneral.vue'
import { useGameStore } from '@/stores/gameStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { GameState } from '@/types'
let cleanup: () => void
beforeEach(() => localStorage.clear())
afterEach(() => cleanup?.())
it('表示方式→3Dタイプの階層を表示し、プレイ中も表示設定を変更できる', async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const game = useGameStore(),
    settings = useSettingsStore()
  game.transitionToState(GameState.READY)
  const host = document.createElement('div')
  const app = createApp(() => h(SettingsGeneral, { volumeLevel: 2 })).use(pinia)
  app.mount(host)
  cleanup = () => app.unmount()
  const mode = host.querySelector<HTMLSelectElement>('#button-mode')!
  expect(mode.closest('section')!.lastElementChild!.textContent).toBe(
    '早押しボタンの見た目を切り替えます',
  )
  expect(host.querySelector('#button-model')).toBeNull()
  mode.value = '3d'
  mode.dispatchEvent(new Event('change'))
  await nextTick()
  const model = host.querySelector<HTMLSelectElement>('#button-model')!
  expect(Array.from(model.options).map((option) => option.text)).toEqual([
    '丸型',
    '箱型（大ランプ）',
  ])
  expect(mode.closest('section')!.lastElementChild!.textContent).toBe(
    '早押しボタンの見た目を切り替えます',
  )
  model.value = 'waseda-style-v1'
  model.dispatchEvent(new Event('change'))
  expect(settings.button.modelId).toBe('waseda-style-v1')
  mode.value = '2d'
  mode.dispatchEvent(new Event('change'))
  await nextTick()
  expect(host.querySelector('#button-model')).toBeNull()
  mode.value = '3d'
  mode.dispatchEvent(new Event('change'))
  await nextTick()
  expect(host.querySelector<HTMLSelectElement>('#button-model')!.value).toBe('waseda-style-v1')
  game.transitionToState(GameState.QUESTIONING)
  await nextTick()
  expect(mode.disabled).toBe(false)
  const activeModel = host.querySelector<HTMLSelectElement>('#button-model')!
  activeModel.value = 'simple-round-v1'
  activeModel.dispatchEvent(new Event('change'))
  expect(settings.button.modelId).toBe('simple-round-v1')
  mode.value = '2d'
  mode.dispatchEvent(new Event('change'))
  expect(settings.button.renderMode).toBe('2d')
  game.transitionToState(GameState.FINISHED)
  await nextTick()
  expect(mode.disabled).toBe(false)
})
