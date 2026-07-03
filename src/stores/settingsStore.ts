// 音声設定などのユーザー設定を管理する Pinia ストア
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { LOCALSTORAGE_KEY_SETTINGS, DEFAULT_VOLUME_LEVEL } from '@/constants/audio'
import { logger } from '@/utils/logger'

interface PersistedSettings {
  soundEnabled: boolean
  volumeLevel: number
}

function loadPersistedSettings(): PersistedSettings {
  const defaults: PersistedSettings = {
    soundEnabled: true,
    volumeLevel: DEFAULT_VOLUME_LEVEL,
  }

  const raw = localStorage.getItem(LOCALSTORAGE_KEY_SETTINGS)
  if (!raw) return defaults

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>
    return {
      soundEnabled:
        typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : defaults.soundEnabled,
      volumeLevel:
        typeof parsed.volumeLevel === 'number' ? parsed.volumeLevel : defaults.volumeLevel,
    }
  } catch (error) {
    logger.warn(
      '[settingsStore] Failed to parse persisted settings, falling back to defaults:',
      error,
    )
    return defaults
  }
}

function persistSettings(settings: PersistedSettings): void {
  localStorage.setItem(LOCALSTORAGE_KEY_SETTINGS, JSON.stringify(settings))
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = loadPersistedSettings()

  const soundEnabled = ref(initial.soundEnabled)
  const volumeLevel = ref(initial.volumeLevel)

  function setSoundEnabled(enabled: boolean): void {
    soundEnabled.value = enabled
    persistSettings({ soundEnabled: soundEnabled.value, volumeLevel: volumeLevel.value })
  }

  function setVolumeLevel(level: number): void {
    volumeLevel.value = level
    persistSettings({ soundEnabled: soundEnabled.value, volumeLevel: volumeLevel.value })
  }

  return {
    soundEnabled,
    volumeLevel,
    setSoundEnabled,
    setVolumeLevel,
  }
})
