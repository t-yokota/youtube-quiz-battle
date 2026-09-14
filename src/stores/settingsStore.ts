import {
  defaultBuzzer,
  isBuzzerModel,
  readBuzzerSettings,
  type BuzzerSettings,
} from '@/constants/buzzer'
import { readStoredValue, writeStoredValue } from '@/utils/browserStorage'
// 音声設定などのユーザー設定を管理する Pinia ストア
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { LOCALSTORAGE_KEY_SETTINGS, DEFAULT_VOLUME_LEVEL } from '@/constants/audio'
import { logger } from '@/utils/logger'

interface PersistedSettings {
  buzzer: BuzzerSettings
  soundEnabled: boolean
  volumeLevel: number
  /** シーク許可のユーザー上書き（null = クイズデータの設定に従う） */
  disableSeekbarOverride: boolean | null
  /** ボタンチェック演出のユーザー上書き（null = クイズデータの設定に従う） */
  buttonCheckOverride: boolean | null
}

function loadPersistedSettings(): PersistedSettings {
  const defaults: PersistedSettings = {
    buzzer: { ...defaultBuzzer },
    soundEnabled: true,
    volumeLevel: DEFAULT_VOLUME_LEVEL,
    disableSeekbarOverride: null,
    buttonCheckOverride: null,
  }

  const raw = readStoredValue(LOCALSTORAGE_KEY_SETTINGS)
  if (!raw) return defaults

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>
    return {
      buzzer: readBuzzerSettings(parsed.buzzer),
      soundEnabled:
        typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : defaults.soundEnabled,
      volumeLevel:
        typeof parsed.volumeLevel === 'number' ? parsed.volumeLevel : defaults.volumeLevel,
      disableSeekbarOverride:
        typeof parsed.disableSeekbarOverride === 'boolean'
          ? parsed.disableSeekbarOverride
          : defaults.disableSeekbarOverride,
      // 旧形式の buttonCheckEnabled は引き継がない（データ側デフォルトへ移行）
      buttonCheckOverride:
        typeof parsed.buttonCheckOverride === 'boolean'
          ? parsed.buttonCheckOverride
          : defaults.buttonCheckOverride,
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
  writeStoredValue(LOCALSTORAGE_KEY_SETTINGS, JSON.stringify(settings))
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = loadPersistedSettings()

  const buzzer = ref(initial.buzzer)
  const soundEnabled = ref(initial.soundEnabled)
  const volumeLevel = ref(initial.volumeLevel)
  const disableSeekbarOverride = ref<boolean | null>(initial.disableSeekbarOverride)
  const buttonCheckOverride = ref<boolean | null>(initial.buttonCheckOverride)

  function persist(): void {
    persistSettings({
      buzzer: buzzer.value,
      soundEnabled: soundEnabled.value,
      volumeLevel: volumeLevel.value,
      disableSeekbarOverride: disableSeekbarOverride.value,
      buttonCheckOverride: buttonCheckOverride.value,
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

  /** ボタンチェック演出のユーザー上書きを設定する（トグル操作後はユーザー任せ） */
  function setButtonCheckEnabled(enabled: boolean): void {
    buttonCheckOverride.value = enabled
    persist()
  }

  function setBuzzerMode(value: unknown): void {
    if (value !== '2d' && value !== '3d') return
    buzzer.value = { ...buzzer.value, renderMode: value }
    persist()
  }
  function setBuzzerModel(value: unknown): void {
    if (!isBuzzerModel(value)) return
    buzzer.value = { ...buzzer.value, modelId: value }
    persist()
  }

  return {
    buzzer,
    setBuzzerMode,
    setBuzzerModel,
    soundEnabled,
    volumeLevel,
    disableSeekbarOverride,
    buttonCheckOverride,
    setSoundEnabled,
    setVolumeLevel,
    setDisableSeekbarOverride,
    setButtonCheckEnabled,
  }
})
