import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { useSettingsStore } from '../settingsStore'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.resetModules()
})
afterEach(() => vi.restoreAllMocks())
it('保存領域を読めなくても設定とテーマを既定値で開始する', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('denied', 'SecurityError')
  })
  expect(() => useSettingsStore()).not.toThrow()
  expect(useSettingsStore().soundEnabled).toBe(true)
  const { useTheme } = await import('@/composables/useTheme')
  expect(() => useTheme()).not.toThrow()
  expect(useTheme().currentThemeId.value).toBe('light')
})
it('書込失敗でもセッション内の設定とテーマ変更を完了する', async () => {
  const store = useSettingsStore()
  const { useTheme } = await import('@/composables/useTheme')
  const theme = useTheme()
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError')
  })
  expect(() => store.setSoundEnabled(false)).not.toThrow()
  expect(() => store.setVolumeLevel(1)).not.toThrow()
  expect(() => theme.setTheme('dark')).not.toThrow()
  expect(store.soundEnabled).toBe(false)
  expect(store.volumeLevel).toBe(1)
  expect(theme.currentThemeId.value).toBe('dark')
})
