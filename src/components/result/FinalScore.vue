<script setup lang="ts">
// FinalScore コンポーネント
// ゲーム終了時の最終スコア表示

import { computed } from 'vue'

// Props定義
interface Props {
  correctCount?: number
  totalQuestions?: number
}

const props = withDefaults(defineProps<Props>(), {
  correctCount: 0,
  totalQuestions: 5,
})

// 正解率の計算
const percentage = computed(() => {
  if (props.totalQuestions === 0) return 0
  return Math.round((props.correctCount / props.totalQuestions) * 100)
})
</script>

<template>
  <div class="final-score">
    <p class="score-title">ゲーム終了！</p>
    <p class="score-text">正解数: {{ correctCount }}/{{ totalQuestions }}問 ({{ percentage }}%)</p>
  </div>
</template>

<style scoped>
/* Final Score */
.final-score {
  text-align: center;
  padding: 1.5rem;
  background-color: white;
  border-radius: 0.75rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.score-title {
  margin: 0 0 0.75rem 0;
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--color-legacy-gray-900);
}

.score-text {
  margin: 0;
  font-size: 1.125rem;
  color: var(--color-legacy-gray-600);
}

/* モバイル対応 */
@media (max-width: 640px) {
  .final-score {
    padding: 1rem;
  }

  .score-title {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
  }

  .score-text {
    font-size: 1rem;
  }
}

/* 小さい画面での追加調整 */
@media (max-height: 700px) {
  .final-score {
    padding: 0.875rem;
  }

  .score-title {
    font-size: 1.125rem;
    margin-bottom: 0.5rem;
  }

  .score-text {
    font-size: 0.9375rem;
  }
}
</style>
