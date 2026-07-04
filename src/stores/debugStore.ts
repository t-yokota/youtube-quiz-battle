// デバッグモード用のPiniaストア（クイズ設定の実行時上書き）
// セッション限り（LocalStorageに永続化しない）。gameStore.effectiveSettings から参照される。
import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  DEBUG_ANSWER_TIME_LIMIT_MIN,
  DEBUG_ANSWER_TIME_LIMIT_MAX,
  DEBUG_MAX_ATTEMPTS_MIN,
  DEBUG_MAX_ATTEMPTS_MAX,
} from '@/constants/debug'

/**
 * 数値上書き値をガードする（範囲外は clamp、非有限値は上書きなし扱い）
 */
function guardNumberOverride(value: number | null, min: number, max: number): number | null {
  if (value === null) return null
  if (!Number.isFinite(value)) return null
  return Math.min(max, Math.max(min, Math.round(value)))
}

export const useDebugStore = defineStore('debug', () => {
  // クイズ設定の実行時上書き（null = 上書きなし）
  const answerTimeLimitOverride = ref<number | null>(null)
  const maxAttemptsOverride = ref<number | null>(null)
  const jumpToRevealPeriodOverride = ref<boolean | null>(null)
  const hideVideoPlayerDuringAnswerOverride = ref<boolean | null>(null)

  // デバッグメニューの表示状態（セッション限り、既定false）
  const isMenuVisible = ref(false)

  /**
   * answerTimeLimit の上書き値を設定する（1〜300 に clamp）
   */
  function setAnswerTimeLimitOverride(value: number | null): void {
    answerTimeLimitOverride.value = guardNumberOverride(
      value,
      DEBUG_ANSWER_TIME_LIMIT_MIN,
      DEBUG_ANSWER_TIME_LIMIT_MAX,
    )
  }

  /**
   * maxAttempts の上書き値を設定する（1〜9 に clamp）
   */
  function setMaxAttemptsOverride(value: number | null): void {
    maxAttemptsOverride.value = guardNumberOverride(
      value,
      DEBUG_MAX_ATTEMPTS_MIN,
      DEBUG_MAX_ATTEMPTS_MAX,
    )
  }

  /**
   * jumpToRevealPeriod の上書き値を設定する
   */
  function setJumpToRevealPeriodOverride(value: boolean | null): void {
    jumpToRevealPeriodOverride.value = value
  }

  /**
   * hideVideoPlayerDuringAnswer の上書き値を設定する
   */
  function setHideVideoPlayerDuringAnswerOverride(value: boolean | null): void {
    hideVideoPlayerDuringAnswerOverride.value = value
  }

  /**
   * デバッグメニューの表示状態を設定する
   */
  function setMenuVisible(visible: boolean): void {
    isMenuVisible.value = visible
  }

  /**
   * 全ての上書きをリセットする（isMenuVisible は変更しない）
   */
  function resetOverrides(): void {
    answerTimeLimitOverride.value = null
    maxAttemptsOverride.value = null
    jumpToRevealPeriodOverride.value = null
    hideVideoPlayerDuringAnswerOverride.value = null
  }

  return {
    answerTimeLimitOverride,
    maxAttemptsOverride,
    jumpToRevealPeriodOverride,
    hideVideoPlayerDuringAnswerOverride,
    isMenuVisible,
    setAnswerTimeLimitOverride,
    setMaxAttemptsOverride,
    setJumpToRevealPeriodOverride,
    setHideVideoPlayerDuringAnswerOverride,
    setMenuVisible,
    resetOverrides,
  }
})
