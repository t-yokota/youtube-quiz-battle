import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '../settingsStore'
import { LOCALSTORAGE_KEY_SETTINGS } from '@/constants/audio'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
it('2Dが既定、3Dタイプは2Dへ切替後も保存・復元する', () => {
  const store = useSettingsStore()
  expect(store.buzzer.renderMode).toBe('2d')
  store.setBuzzerMode('3d')
  store.setBuzzerModel('waseda-style-v1')
  store.setBuzzerMode('2d')
  setActivePinia(createPinia())
  expect(useSettingsStore().buzzer).toMatchObject({ renderMode: '2d', modelId: 'waseda-style-v1' })
})
it.each([null, { schemaVersion: 999 }, { schemaVersion: 1, modelId: 'unknown', renderMode: '3d' }])(
  '不明な設定%jから2Dへ復帰し音声設定は維持',
  (buzzer) => {
    localStorage.setItem(LOCALSTORAGE_KEY_SETTINGS, JSON.stringify({ soundEnabled: false, buzzer }))
    const store = useSettingsStore()
    expect(store.buzzer.renderMode).toBe('2d')
    expect(store.soundEnabled).toBe(false)
  },
)
it('不正なsetter値も拒否する', () => {
  const store = useSettingsStore()
  store.setBuzzerMode('unknown')
  store.setBuzzerModel('unknown')
  expect(store.buzzer).toMatchObject({ renderMode: '2d', modelId: 'simple-round-v1' })
})
