// 音声設定などのユーザー設定を管理する Pinia ストア
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { LOCALSTORAGE_KEY_SETTINGS, DEFAULT_VOLUME_LEVEL } from '@/constants/audio'
import { logger } from '@/utils/logger'

interface PersistedSettings {
  soundEnabled: boolean
  volumeLevel: number
  /** シーク許可のユーザー上書き（null = クイズデータの設定に従う） */
  disableSeekbarOverride: boolean | null
}

function loadPersistedSettings(): PersistedSettings {
  const defaults: PersistedSettings = {
    soundEnabled: true,
    volumeLevel: DEFAULT_VOLUME_LEVEL,
    disableSeekbarOverride: null,
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
      disableSeekbarOverride:
        typeof parsed.disableSeekbarOverride === 'boolean'
          ? parsed.disableSeekbarOverride
          : defaults.disableSeekbarOverride,
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
  const disableSeekbarOverride = ref<boolean | null>(initial.disableSeekbarOverride)

  function persist(): void {
    persistSettings({
      soundEnabled: soundEnabled.value,
      volumeLevel: volumeLevel.value,
      disableSeekbarOverride: disableSeekbarOverride.value,
    })
  }

  function setSoundEnabled(enabled: boolean): void {
    soundEnabled.value = enabled
    persist()
  }

  function setVolumeLevel(level: number): void {
    volumeLevel.value = level
    persist()
  }

  /** シーク許可の上書きを設定する（null でクイズデータの設定に戻す） */
  function setDisableSeekbarOverride(value: boolean | null): void {
    disableSeekbarOverride.value = value
    persist()
  }

  return {
    soundEnabled,
    volumeLevel,
    disableSeekbarOverride,
    setSoundEnabled,
    setVolumeLevel,
    setDisableSeekbarOverride,
  }
})
