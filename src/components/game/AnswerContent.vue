<script setup lang="ts">
// AnswerContent コンポーネント
// 解答入力エリア（QUESTIONING/ANSWERING/WAITING/REVEALING状態）

import { ref, watch, nextTick } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const gameStore = useGameStore()

// イベント定義（解答送信は GameManager 経由必須のため emit を維持）
const emit = defineEmits<{
  submit: [answer: string]
}>()

// 入力欄の参照（オートフォーカス用）
const inputRef = ref<HTMLInputElement | null>(null)

// 送信ボタンの無効状態（入力欄が無効 or 入力が空）
const isSubmitDisabled = () => gameStore.isInputDisabled || gameStore.answerInput.trim() === ''

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
      <span class="attempts-counter">残り {{ gameStore.remainingAttempts }}回</span>
      <span v-if="!gameStore.isInputDisabled" class="answer-timer"
        >残り {{ gameStore.answerTimeRemaining }}秒</span
      >
      <span v-if="gameStore.answerResult" :class="['answer-result', gameStore.answerResult]">
        {{ gameStore.answerResult === 'correct' ? '正解！' : '不正解！' }}
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
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  position: relative;
  height: 24px;
  flex-shrink: 0;
}

.attempts-counter {
  color: #2563eb;
  font-weight: bold;
  flex: 1;
}

.answer-timer {
  color: #ef4444;
  font-weight: bold;
  flex: 1;
  text-align: right;
}

.answer-result {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 1rem;
  font-weight: bold;
  padding: 0.25rem 0.75rem;
  border-radius: 0.375rem;
  white-space: nowrap;
}

.answer-result.correct {
  background: #dcfce7;
  color: #166534;
  padding-right: 0.4rem;
}

.answer-result.incorrect {
  background: #fef2f2;
  color: #dc2626;
  padding-right: 0.4rem;
}

/* Answer Input Container */
.answer-input-container {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}

.answer-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 1rem;
  outline: none;
  min-width: 0;
  height: 44px;
  box-sizing: border-box;
}

.answer-input:focus {
  border-color: #2563eb;
}

.answer-input:disabled {
  background: #f9fafb;
  color: #6b7280;
}

.submit-button {
  padding: 0.75rem 1rem;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
  height: 44px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}

.submit-button:hover:not(:disabled) {
  background: #1d4ed8;
}

.submit-button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

/* モバイル対応 */
@media (max-width: 640px) {
  .answer-meta {
    font-size: 0.8125rem;
    margin-bottom: 0.375rem;
  }

  .answer-input,
  .submit-button {
    font-size: 0.9375rem;
    height: 40px;
  }

  .answer-input {
    padding: 0.625rem 0.875rem;
  }

  .submit-button {
    padding: 0.625rem 0.875rem;
  }
}

/* 小さい画面での追加調整 */
@media (max-height: 700px) {
  .answer-meta {
    font-size: 0.75rem;
    margin-bottom: 0.25rem;
    height: 20px;
  }

  .answer-result {
    font-size: 0.875rem;
    padding: 0.125rem 0.5rem;
  }

  .answer-input,
  .submit-button {
    font-size: 0.875rem;
    height: 38px;
  }

  .answer-input {
    padding: 0.5rem 0.75rem;
  }

  .submit-button {
    padding: 0.5rem 0.75rem;
  }
}
</style>
