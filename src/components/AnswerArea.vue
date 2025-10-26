<script setup lang="ts">
// AnswerArea コンポーネント
// ゲーム状態に応じて解答エリアの表示を切り替え

// Props定義（Phase 2で状態管理と連携予定）
interface Props {
  // 表示モード: 'guide' = ガイドテキスト, 'answer' = 解答コンテンツ
  mode?: 'guide' | 'answer'
  guideText?: string
  remainingAttempts?: number
  remainingTime?: number
  answerResult?: 'correct' | 'incorrect' | null
  answerInput?: string
  isInputDisabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'answer',
  guideText: 'ボタンを押してゲームを開始',
  remainingAttempts: 2,
  remainingTime: 10,
  answerResult: null,
  answerInput: '',
  isInputDisabled: false,
})

// イベント定義
const emit = defineEmits<{
  submit: [answer: string]
  updateInput: [value: string]
}>()

const handleSubmit = () => {
  emit('submit', props.answerInput)
}

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('updateInput', target.value)
}
</script>

<template>
  <section class="answer-area">
    <!-- Guide Text Mode (LOADING/READY/TALKING状態) -->
    <div v-if="mode === 'guide'" class="guide-text">
      <p class="guide-message">{{ guideText }}</p>
    </div>

    <!-- Answer Content Mode (QUESTIONING/ANSWERING/WAITING/REVEALING状態) -->
    <div v-else class="answer-content">
      <!-- Answer Meta Information -->
      <div class="answer-meta">
        <span class="attempts-counter">残り {{ remainingAttempts }}回</span>
        <span class="answer-timer">残り {{ remainingTime }}秒</span>
        <span v-if="answerResult" :class="['answer-result', answerResult]">
          {{ answerResult === 'correct' ? '正解！' : '不正解！' }}
        </span>
      </div>

      <!-- Answer Input -->
      <div class="answer-input-container">
        <input
          type="text"
          class="answer-input"
          placeholder="解答を入力"
          maxlength="100"
          :value="answerInput"
          :disabled="isInputDisabled"
          @input="handleInput"
        />
        <button class="submit-button" :disabled="isInputDisabled" @click="handleSubmit">
          送信
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Answer Area */
.answer-area {
  flex-shrink: 0;
  background-color: white;
  padding: 0.875rem;
  border-radius: 0.75rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  height: 110px;
  display: flex;
  align-items: stretch;
}

/* Guide Text */
.guide-text {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.guide-message {
  margin: 0;
  color: #6b7280;
  font-size: 1rem;
  line-height: 1.4;
}

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
  /* padding-left: 1.1rem; */
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
  .answer-area {
    padding: 0.75rem;
    height: 100px;
  }

  .guide-message {
    font-size: 0.9375rem;
  }

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
  .answer-area {
    padding: 0.625rem;
    height: 90px;
  }

  .guide-message {
    font-size: 0.875rem;
  }

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
