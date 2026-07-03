<script setup lang="ts">
// AnswerContent コンポーネント
// 解答入力エリア（QUESTIONING/ANSWERING/WAITING/REVEALING状態）
// タイマーは conic-gradient リング（12時起点・時計回り減少・残り3秒以下で赤 + 脈動）

import { ref, computed, watch, nextTick } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { TIMER_URGENT_THRESHOLD_SEC } from '@/constants/timing'

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
const answerTimeLimit = computed(() => gameStore.quizData?.settings.answerTimeLimit ?? 10)
const timerProgress = computed(() => {
  if (answerTimeLimit.value <= 0) return 0
  return Math.max(0, Math.min(1, gameStore.answerTimeRemaining / answerTimeLimit.value))
})

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
          / {{ gameStore.quizData?.settings.maxAttempts ?? gameStore.remainingAttempts }}</span
        ></span
      >
      <span
        v-if="!gameStore.isInputDisabled"
        class="answer-timer"
        :class="{ urgent: isUrgent }"
        :style="{ '--timer-progress': timerProgress }"
      >
        <span class="timer-ring"></span>
        <span class="sec">{{ gameStore.answerTimeRemaining }}</span
        >s
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
      />
      <button class="submit-button" :disabled="isSubmitDisabled()" @click="handleSubmit">
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
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.attempts-counter {
  color: var(--color-info-400);
  font-weight: 700;
}

.attempts-counter .dim {
  color: var(--color-text-dim);
  font-weight: 500;
}

/* タイマー: conic-gradient リング + 残秒数（12時から時計回りに減る） */
.answer-timer {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-weight: 800;
  color: var(--color-text-main);
}

/* 秒数を固定幅にしてリング位置が桁数で動かないようにする */
.answer-timer .sec {
  display: inline-block;
  min-width: 2ch;
  text-align: right;
}

.timer-ring {
  width: 1.375rem;
  height: 1.375rem;
  border-radius: 50%;
  background: conic-gradient(
    var(--color-stage-700) calc((1 - var(--timer-progress)) * 360deg),
    var(--color-gold-400) 0deg
  );
  display: grid;
  place-items: center;
}

.timer-ring::after {
  content: '';
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 50%;
  background: var(--color-stage-800);
}

.answer-timer.urgent {
  color: var(--color-signal-500);
  animation: throb 0.8s ease-in-out infinite;
}

.answer-timer.urgent .timer-ring {
  background: conic-gradient(
    var(--color-stage-700) calc((1 - var(--timer-progress)) * 360deg),
    var(--color-signal-500) 0deg
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
  font-size: 0.875rem;
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
  background: rgba(61, 220, 132, 0.15);
  color: var(--color-ok-400);
  border: 1px solid var(--color-ok-400);
}

.answer-result.incorrect {
  background: rgba(230, 64, 46, 0.15);
  color: var(--color-signal-500);
  border: 1px solid var(--color-signal-500);
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
  font-size: max(16px, 1rem); /* iOSズーム防止（実 px 16 を下回らない） */
  color: var(--color-text-main);
  background: var(--color-stage-900);
  border: 2px solid var(--color-line);
  border-radius: var(--radius-md);
  outline: none;
  transition: border-color var(--duration-fast);
}

.answer-input::placeholder {
  color: #5a6a8e;
}

.answer-input:focus-visible {
  border-color: var(--color-info-400);
  box-shadow: 0 0 0 0.1875rem rgba(79, 140, 255, 0.25);
}

.answer-input:disabled {
  opacity: 0.45;
}

.submit-button {
  height: max(44px, 2.75rem);
  padding: 0 1rem;
  font-size: 0.9375rem;
  font-weight: 800;
  color: var(--color-stage-900);
  background: var(--color-gold-400);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    transform var(--duration-fast),
    background var(--duration-fast);
}

.submit-button:hover:not(:disabled) {
  background: #ffd566;
}

.submit-button:active:not(:disabled) {
  transform: translateY(1px);
}

.submit-button:disabled {
  background: var(--color-stage-700);
  color: var(--color-text-dim);
  cursor: not-allowed;
}
</style>
