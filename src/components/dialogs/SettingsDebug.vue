<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useDebugStore } from '@/stores/debugStore'
import {
  DEBUG_ANSWER_TIME_LIMIT_MIN,
  DEBUG_ANSWER_TIME_LIMIT_MAX,
  DEBUG_MAX_ATTEMPTS_MIN,
  DEBUG_MAX_ATTEMPTS_MAX,
} from '@/constants/debug'
const gameStore = useGameStore()
const debugStore = useDebugStore()
// 上書きコントロールは常に実効値（上書き > データ値）を表示する。
// 変更で上書き設定、リセットでデータ値表示に戻る。
// 数値は確定（change = blur/Enter）時のみ反映し、タイピング途中に clamp で丸めない
const effectiveAnswerTimeLimit = computed(
  () => debugStore.answerTimeLimitOverride ?? gameStore.quizData?.settings.answerTimeLimit ?? null,
)
const effectiveMaxAttempts = computed(
  () => debugStore.maxAttemptsOverride ?? gameStore.quizData?.settings.maxAttempts ?? null,
)

const handleAnswerTimeLimitOverrideChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  // 空欄で確定した場合は上書き解除（データ値表示に戻す）
  debugStore.setAnswerTimeLimitOverride(input.value === '' ? null : input.valueAsNumber)
  input.value = effectiveAnswerTimeLimit.value?.toString() ?? ''
}

const handleMaxAttemptsOverrideChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  debugStore.setMaxAttemptsOverride(input.value === '' ? null : input.valueAsNumber)
  input.value = effectiveMaxAttempts.value?.toString() ?? ''
}

// boolean 上書き: トグルスイッチ（クイズ画面右下と同型）。表示は実効値、タップで上書き設定
const effectiveJumpToRevealPeriod = computed(
  () =>
    debugStore.jumpToRevealPeriodOverride ??
    gameStore.quizData?.settings.jumpToRevealPeriod ??
    false,
)
const effectiveHideVideoPlayerDuringAnswer = computed(
  () =>
    debugStore.hideVideoPlayerDuringAnswerOverride ??
    gameStore.quizData?.settings.hideVideoPlayerDuringAnswer ??
    false,
)

const handleJumpToRevealPeriodOverrideToggle = () => {
  debugStore.setJumpToRevealPeriodOverride(!effectiveJumpToRevealPeriod.value)
}

const handleHideVideoPlayerDuringAnswerOverrideToggle = () => {
  debugStore.setHideVideoPlayerDuringAnswerOverride(!effectiveHideVideoPlayerDuringAnswer.value)
}

const handleResetOverrides = () => {
  debugStore.resetOverrides()
}
</script>
<template>
  <!-- Debug Settings（Task 29: debug データかつメニュー表示ONの時のみ） -->
  <section class="settings-section">
    <h3 class="section-title debug-section-title">デバッグ</h3>
    <p class="seek-description">クイズ設定を一時的に上書きします（リロードで解除）</p>

    <div class="debug-row">
      <span class="seek-label">解答制限時間（秒）</span>
      <input
        type="number"
        class="debug-input"
        aria-label="解答制限時間（秒）"
        :min="DEBUG_ANSWER_TIME_LIMIT_MIN"
        :max="DEBUG_ANSWER_TIME_LIMIT_MAX"
        :value="effectiveAnswerTimeLimit ?? ''"
        @change="handleAnswerTimeLimitOverrideChange"
      />
    </div>

    <div class="debug-row">
      <span class="seek-label">解答回数</span>
      <input
        type="number"
        class="debug-input"
        aria-label="解答回数"
        :min="DEBUG_MAX_ATTEMPTS_MIN"
        :max="DEBUG_MAX_ATTEMPTS_MAX"
        :value="effectiveMaxAttempts ?? ''"
        @change="handleMaxAttemptsOverrideChange"
      />
    </div>

    <div class="debug-row">
      <span class="seek-label">正解発表ジャンプ</span>
      <button
        type="button"
        class="ui-switch"
        role="switch"
        :aria-checked="effectiveJumpToRevealPeriod"
        aria-label="正解発表ジャンプ"
        @click="handleJumpToRevealPeriodOverrideToggle"
      >
        <span class="ui-switch-track" :class="{ on: effectiveJumpToRevealPeriod }">
          <span class="ui-switch-knob"></span>
        </span>
      </button>
    </div>

    <div class="debug-row">
      <span class="seek-label">解答中の動画非表示</span>
      <button
        type="button"
        class="ui-switch"
        role="switch"
        :aria-checked="effectiveHideVideoPlayerDuringAnswer"
        aria-label="解答中の動画非表示"
        @click="handleHideVideoPlayerDuringAnswerOverrideToggle"
      >
        <span class="ui-switch-track" :class="{ on: effectiveHideVideoPlayerDuringAnswer }">
          <span class="ui-switch-knob"></span>
        </span>
      </button>
    </div>

    <button type="button" class="debug-reset-button" @click="handleResetOverrides">
      すべてリセット
    </button>
  </section>

  <!-- Privacy Info -->
</template>
