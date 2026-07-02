<script setup lang="ts">
// GameInfo コンポーネント
// 問題進捗とスコアを表示

import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const gameStore = useGameStore()

// 問題進捗の表示テキスト
const progressText = computed(() => {
  if (gameStore.currentQuestionNumber === 0) {
    // 問題開始前：全問題数のみ表示
    return `問題: 全${gameStore.totalQuestions}問`
  }
  // 問題進行中：現在の問題番号と総数を表示
  return `問題: ${gameStore.currentQuestionNumber}/${gameStore.totalQuestions}`
})
</script>

<template>
  <section class="game-info">
    <!-- Progress Display -->
    <div class="progress-display">
      {{ progressText }}
    </div>

    <!-- Score Display -->
    <div class="score-display">
      ○: {{ gameStore.correctCount }} ×: {{ gameStore.incorrectCount }}
    </div>
  </section>
</template>

<style scoped>
/* Game Info */
.game-info {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: white;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem 0.75rem 0 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  gap: 1rem;
}

.progress-display,
.score-display {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-legacy-gray-900);
  white-space: nowrap;
}

/* モバイル対応 */
@media (max-width: 640px) {
  .game-info {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
  }

  .progress-display,
  .score-display {
    font-size: 0.875rem;
  }
}

/* 小さい画面での追加調整 */
@media (max-height: 700px) {
  .game-info {
    padding: 0.5rem 0.75rem;
  }

  .progress-display,
  .score-display {
    font-size: 0.8125rem;
  }
}
</style>
