<script setup lang="ts">
// AnswerContent コンポーネント
// 解答入力エリア（QUESTIONING/ANSWERING/WAITING/REVEALING状態）
// タイマーは conic-gradient リング（12時起点・時計回り減少・残り3秒以下で赤 + 脈動）

import { ref, computed, watch, nextTick } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { TIMER_URGENT_THRESHOLD_SEC } from '@/constants/timing'
import {
  calculateTimerLabelWidthCh,
  calculateTimerProgress,
  resolveTimerLabelWidthState,
  type TimerLabelWidthState,
} from './answerTimerLayout'

const gameStore = useGameStore()

// イベント定義（解答送信は GameManager 経由必須のため emit を維持）
const emit = defineEmits<{
  submit: [answer: string]
}>()

// 入力欄の参照（オートフォーカス用）
const inputRef = ref<HTMLInputElement | null>(null)

// 送信ボタンの無効状態（入力欄が無効 or 入力が空）
const isSubmitDisabled = () => gameStore.isInputDisabled || gameStore.answerInput.trim() === ''

// タイマーリング進捗（1 → 0。分母は設定の制限時間）
const answerTimeLimit = computed(() => gameStore.effectiveSettings?.answerTimeLimit ?? 10)
const timerLabelWidthState = ref<TimerLabelWidthState>()
watch(
  [() => gameStore.currentQuestionNumber, answerTimeLimit, () => gameStore.answerTimeRemaining],
  ([questionNumber, timeLimit, timeRemaining]) => {
    timerLabelWidthState.value = resolveTimerLabelWidthState(
      timerLabelWidthState.value,
      questionNumber,
      timeLimit,
      timeRemaining,
    )
  },
  { immediate: true },
)
const timerLabelWidth = computed(
  () =>
    `${timerLabelWidthState.value?.widthCh ?? calculateTimerLabelWidthCh(answerTimeLimit.value)}ch`,
)
const timerProgress = computed(() =>
  calculateTimerProgress(gameStore.answerTimeRemaining, answerTimeLimit.value),
)

// 残り3秒以下で赤 + 脈動
const isUrgent = computed(() => gameStore.answerTimeRemaining <= TIMER_URGENT_THRESHOLD_SEC)

const handleSubmit = () => {
  if (isSubmitDisabled()) return
  emit('submit', gameStore.answerInput)
}

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  gameStore.updateAnswerInput(target.value)
}

// ANSWERING遷移時にオートフォーカス
watch(
  () => gameStore.isInputDisabled,
  (disabled) => {
    if (!disabled) {
      nextTick(() => {
        inputRef.value?.focus()
      })
    }
  },
)

// 誤答リトライ時のフォーカス復帰（ANSWERING維持のまま answerResult が 'incorrect' に変わる場合）
watch(
  () => gameStore.answerResult,
  (result) => {
    if (result === 'incorrect' && !gameStore.isInputDisabled) {
      nextTick(() => {
        inputRef.value?.focus()
      })
    }
  },
)
</script>

<template>
  <div class="answer-content">
    <!-- Answer Meta Information -->
    <div class="answer-meta">
      <span class="attempts-counter"
        >残り {{ gameStore.remainingAttempts }}回<span class="dim">
          / {{ gameStore.effectiveSettings?.maxAttempts ?? gameStore.remainingAttempts }}</span
        ></span
      >
      <span
        v-if="!gameStore.isInputDisabled"
        class="answer-timer"
        :class="{ urgent: isUrgent }"
        :style="{
          '--timer-progress': timerProgress,
          '--timer-label-width': timerLabelWidth,
        }"
      >
        <span class="timer-ring"></span>
        <span class="sec">{{ gameStore.answerTimeRemaining }}s</span>
      </span>
    </div>

    <!-- 結果バナー（正解/不正解）。aria-live 領域は常設して変化を通知する -->
    <div aria-live="polite">
      <span v-if="gameStore.answerResult" :class="['answer-result', gameStore.answerResult]">
        {{ gameStore.answerResult === 'correct' ? '正解！' : '不正解' }}
      </span>
    </div>

    <!-- Answer Input -->
    <div class="answer-input-container">
      <input
        ref="inputRef"
        type="text"
        class="answer-input"
        placeholder="解答を入力"
        maxlength="100"
        :value="gameStore.answerInput"
        :disabled="gameStore.isInputDisabled"
        @input="handleInput"
        @keydown.enter="handleSubmit"
      />
      <button type="button" class="submit-button" :disabled="isSubmitDisabled()" @click="handleSubmit">
        送信
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Answer Content */
.answer-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

/* Answer Meta Information */
.answer-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 1.625rem;
  /* 両端の残り回数・タイマーを枠から数 px 内側に寄せる */
  padding: 0 0.25rem;
  font-size: calc(0.75 * var(--ui-font-unit));
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.attempts-counter {
  color: var(--color-info);
  font-weight: 700;
  font-size: calc(0.8 * var(--ui-font-unit));
}

.attempts-counter .dim {
  color: var(--color-text-dim);
  font-weight: 500;
}

/* タイマー: conic-gradient リング + 残秒数（12時から時計回りに減る） */
.answer-timer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.375rem;
  width: calc(1.375rem + 0.375rem + var(--timer-label-width, 3ch));
  margin-left: auto;
  flex-shrink: 0;
  font-size: calc(0.8 * var(--ui-font-unit));
  font-weight: 800;
  color: var(--color-text-main);
  /* 1秒刻みの進捗更新を線形補間して連続的に見せる（@property 登録は main.css） */
  transition: --timer-progress 1s linear;
}

/* 制限時間の最大桁幅で固定し、桁が減ったら数字とsの左右に余白を作る */
.answer-timer .sec {
  width: var(--timer-label-width, 3ch);
  flex-shrink: 0;
  text-align: center;
  white-space: nowrap;
}

.timer-ring {
  width: 1.375rem;
  height: 1.375rem;
  flex-shrink: 0;
  border-radius: 50%;
  background: conic-gradient(
    var(--timer-track) calc((1 - var(--timer-progress)) * 360deg),
    var(--color-accent) 0deg
  );
  display: grid;
  place-items: center;
}

.timer-ring::after {
  content: '';
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 50%;
  background: var(--timer-hole);
}

.answer-timer.urgent {
  color: var(--color-urgent);
  animation: throb 0.5s ease-in-out infinite;
}

.answer-timer.urgent .timer-ring {
  background: conic-gradient(
    var(--timer-track) calc((1 - var(--timer-progress)) * 360deg),
    var(--color-urgent) 0deg
  );
}

@keyframes throb {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

/* 結果バナー（answer-area 上端中央にポップ表示） */
.answer-result {
  position: absolute;
  left: 50%;
  top: 0.5rem;
  transform: translateX(-50%);
  font-size: calc(0.875 * var(--ui-font-unit));
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 0.1875rem 0.875rem;
  border-radius: 62.4375rem;
  white-space: nowrap;
  animation: pop var(--duration-base) var(--ease-brand);
}

@keyframes pop {
  from {
    transform: translateX(-50%) scale(0.7);
    opacity: 0;
  }
}

.answer-result.correct {
  background: var(--banner-correct-bg);
  color: var(--color-answer-correct);
  border: 1px solid var(--color-answer-correct);
}

.answer-result.incorrect {
  background: var(--banner-wrong-bg);
  color: var(--color-answer-wrong);
  border: 1px solid var(--color-answer-wrong);
}

/* Answer Input Container */
.answer-input-container {
  display: flex;
  gap: 0.5rem;
}

.answer-input {
  flex: 1;
  min-width: 0;
  height: max(44px, 2.75rem);
  padding: 0 0.875rem;
  font-size: max(16px, var(--ui-font-unit)); /* iOSズーム防止（実 px 16 を下回らない） */
  color: var(--color-text-main);
  background: var(--input-bg);
  border: 2px solid var(--input-border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--input-shadow);
  outline: none;
  transition:
    border-color var(--duration-fast),
    box-shadow var(--duration-fast);
}

.answer-input::placeholder {
  color: var(--color-placeholder);
}

.answer-input:focus-visible {
  border-color: var(--input-focus-border-color);
  box-shadow: var(--input-focus-shadow);
}

.answer-input:disabled {
  opacity: 0.45;
}

.submit-button {
  height: max(44px, 2.75rem);
  min-width: max(44px, 2.75rem);
  padding: 0 1rem;
  font-size: calc(0.9375 * var(--ui-font-unit));
  font-weight: 800;
  color: var(--btn-primary-text);
  background: var(--btn-primary-bg);
  border: none;
  border-radius: var(--radius-md);
  box-shadow: var(--btn-primary-shadow);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    transform var(--duration-fast),
    background var(--duration-fast);
}

.submit-button:hover:not(:disabled) {
  background: var(--btn-primary-bg-hover);
}

.submit-button:active:not(:disabled) {
  transform: translateY(1px);
}

.submit-button:disabled {
  background: var(--surface-raised);
  color: var(--color-text-dim);
  box-shadow: none;
  cursor: not-allowed;
}
</style>
