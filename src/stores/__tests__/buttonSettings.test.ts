import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '../settingsStore'
import { LOCALSTORAGE_KEY_SETTINGS } from '@/constants/audio'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
it('2Dが既定、3Dタイプは2Dへ切替後も保存・復元する', () => {
  const store = useSettingsStore()
  expect(store.button.renderMode).toBe('2d')
  store.setButtonMode('3d')
  store.setButtonModel('waseda-style-v1')
  store.setButtonMode('2d')
  setActivePinia(createPinia())
  expect(useSettingsStore().button).toMatchObject({ renderMode: '2d', modelId: 'waseda-style-v1' })
})
it.each([null, { schemaVersion: 999 }, { schemaVersion: 1, modelId: 'unknown', renderMode: '3d' }])(
  '不明な設定%jから2Dへ復帰し音声設定は維持',
  (button) => {
    localStorage.setItem(LOCALSTORAGE_KEY_SETTINGS, JSON.stringify({ soundEnabled: false, button }))
    const store = useSettingsStore()
    expect(store.button.renderMode).toBe('2d')
    expect(store.soundEnabled).toBe(false)
  },
)
it('不正なsetter値も拒否する', () => {
  const store = useSettingsStore()
  store.setButtonMode('unknown')
  store.setButtonModel('unknown')
  expect(store.button).toMatchObject({ renderMode: '2d', modelId: 'simple-round-v1' })
})

it('旧buzzer設定を引き継ぎ、次の保存からbuttonに統一する', () => {
  const saved = {
    schemaVersion: 1,
    renderMode: '3d',
    modelId: 'waseda-style-v1',
    appearancePresetId: 'original-v1',
  }
  localStorage.setItem(LOCALSTORAGE_KEY_SETTINGS, JSON.stringify({ buzzer: saved }))
  const store = useSettingsStore()
  expect(store.button).toEqual(saved)
  store.setSoundEnabled(false)
  const persisted = JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY_SETTINGS)!)
  expect(persisted.button).toEqual(saved)
  expect(persisted).not.toHaveProperty('buzzer')
})
