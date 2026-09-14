import { createApp, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import SettingsGeneral from '../SettingsGeneral.vue'
import { useGameStore } from '@/stores/gameStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { GameState } from '@/types'
let cleanup: () => void
beforeEach(() => localStorage.clear())
afterEach(() => cleanup?.())
it('表示方式→3Dタイプの階層を表示し、プレイ中は変更を受け付けない', async () => {
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
  expect(host.querySelector('#button-model')).toBeNull()
  mode.value = '3d'
  mode.dispatchEvent(new Event('change'))
  await nextTick()
  const model = host.querySelector<HTMLSelectElement>('#button-model')!
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
  expect(mode.disabled).toBe(true)
  mode.value = '2d'
  mode.dispatchEvent(new Event('change'))
  const locked = host.querySelector<HTMLSelectElement>('#button-model')!
  locked.value = 'simple-round-v1'
  locked.dispatchEvent(new Event('change'))
  expect(settings.button).toMatchObject({ renderMode: '3d', modelId: 'waseda-style-v1' })
  game.transitionToState(GameState.FINISHED)
  await nextTick()
  expect(mode.disabled).toBe(false)
})
