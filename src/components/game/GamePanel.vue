<script setup lang="ts">
// GamePanel コンポーネント
// GameInfo + Answer領域（GuideText/AnswerContent）を一つのパネルにまとめる

import GameInfo from './GameInfo.vue'
import GuideText from './GuideText.vue'
import AnswerContent from './AnswerContent.vue'

// Props定義
interface Props {
  // GameInfo props
  currentQuestion?: number
  totalQuestions?: number
  correctCount?: number
  incorrectCount?: number
  // Answer mode
  mode?: 'guide' | 'answer'
  guideText?: string
  // AnswerContent props
  remainingAttempts?: number
  remainingTime?: number
  answerResult?: 'correct' | 'incorrect' | null
  answerInput?: string
  isInputDisabled?: boolean
}

withDefaults(defineProps<Props>(), {
  currentQuestion: 0,
  totalQuestions: 5,
  correctCount: 0,
  incorrectCount: 0,
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

const handleSubmit = (answer: string) => {
  emit('submit', answer)
}

const handleUpdateInput = (value: string) => {
  emit('updateInput', value)
}
</script>

<template>
  <section class="game-panel">
    <!-- Game Info -->
    <GameInfo
      :current-question="currentQuestion"
      :total-questions="totalQuestions"
      :correct-count="correctCount"
      :incorrect-count="incorrectCount"
    />

    <!-- Answer Area -->
    <div class="answer-area">
      <!-- Guide Text Mode (LOADING/READY/TALKING状態) -->
      <GuideText v-if="mode === 'guide'" :guide-text="guideText" />

      <!-- Answer Content Mode (QUESTIONING/ANSWERING/WAITING/REVEALING状態) -->
      <AnswerContent
        v-else
        :remaining-attempts="remainingAttempts"
        :remaining-time="remainingTime"
        :answer-result="answerResult"
        :answer-input="answerInput"
        :is-input-disabled="isInputDisabled"
        @submit="handleSubmit"
        @update-input="handleUpdateInput"
      />
    </div>
  </section>
</template>

<style scoped>
/* Game Panel */
.game-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Answer Area */
.answer-area {
  flex-shrink: 0;
  background-color: white;
  padding: 0.875rem;
  border-radius: 0 0 0.75rem 0.75rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  height: 110px;
  display: flex;
  align-items: stretch;
}

/* モバイル対応 */
@media (max-width: 640px) {
  .game-panel {
    gap: 0.15rem;
  }

  .answer-area {
    padding: 0.75rem;
    height: 100px;
  }
}

/* 小さい画面での追加調整 */
@media (max-height: 700px) {
  .game-panel {
    gap: 0.2rem;
  }

  .answer-area {
    padding: 0.625rem;
    height: 90px;
  }
}
</style>
