import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from '../settingsStore'
import { LOCALSTORAGE_KEY_SETTINGS, DEFAULT_VOLUME_LEVEL } from '@/constants/audio'

describe('settingsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  describe('既定値', () => {
    it('正常系: LocalStorage が空の場合 soundEnabled=true, volumeLevel=既定値 になる', () => {
      const store = useSettingsStore()

      expect(store.soundEnabled).toBe(true)
      expect(store.volumeLevel).toBe(DEFAULT_VOLUME_LEVEL)
    })
  })

  describe('setSoundEnabled', () => {
    it('正常系: 値を更新し LocalStorage に保存する', () => {
      const store = useSettingsStore()

      store.setSoundEnabled(false)

      expect(store.soundEnabled).toBe(false)
      const saved = JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY_SETTINGS) ?? '{}') as {
        soundEnabled: boolean
      }
      expect(saved.soundEnabled).toBe(false)
    })
  })

  describe('setVolumeLevel', () => {
    it('正常系: 値を更新し LocalStorage に保存する', () => {
      const store = useSettingsStore()

      store.setVolumeLevel(1)

      expect(store.volumeLevel).toBe(1)
      const saved = JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY_SETTINGS) ?? '{}') as {
        volumeLevel: number
      }
      expect(saved.volumeLevel).toBe(1)
    })

    it('異常系: 範囲外の値（現仕様）でもクランプせずそのまま保持する', () => {
      const store = useSettingsStore()

      store.setVolumeLevel(99)
      expect(store.volumeLevel).toBe(99)

      store.setVolumeLevel(-1)
      expect(store.volumeLevel).toBe(-1)
    })
  })

  describe('永続化からの復元', () => {
    it('正常系: LocalStorage に保存済みの値を初期値として復元する', () => {
      localStorage.setItem(
        LOCALSTORAGE_KEY_SETTINGS,
        JSON.stringify({ soundEnabled: false, volumeLevel: 0 }),
      )

      const store = useSettingsStore()

      expect(store.soundEnabled).toBe(false)
      expect(store.volumeLevel).toBe(0)
    })

    it('異常系: 壊れた JSON の場合は既定値にフォールバックする', () => {
      localStorage.setItem(LOCALSTORAGE_KEY_SETTINGS, '{invalid-json')

      const store = useSettingsStore()

      expect(store.soundEnabled).toBe(true)
      expect(store.volumeLevel).toBe(DEFAULT_VOLUME_LEVEL)
    })

    it('異常系: 型が不正なフィールドは既定値にフォールバックする', () => {
      localStorage.setItem(
        LOCALSTORAGE_KEY_SETTINGS,
        JSON.stringify({ soundEnabled: 'not-a-boolean', volumeLevel: 'not-a-number' }),
      )

      const store = useSettingsStore()

      expect(store.soundEnabled).toBe(true)
      expect(store.volumeLevel).toBe(DEFAULT_VOLUME_LEVEL)
    })
  })
})
