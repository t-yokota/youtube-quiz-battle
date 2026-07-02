<script setup lang="ts">
// FinalScore コンポーネント
// ゲーム終了時の最終スコア表示（リザルトステージ: 大型スコア + 正解率）

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
  <div>
    <p class="final-title">RESULT</p>
    <p class="final-score">
      <span class="num">{{ correctCount }}</span
      ><span class="den"> / {{ totalQuestions }}</span>
    </p>
    <p class="final-rate">
      正解率 <span class="pct">{{ percentage }}%</span>
    </p>
  </div>
</template>

<style scoped>
.final-title {
  margin: 0;
  text-align: center;
  font-size: 13px;
  letter-spacing: 0.3em;
  color: var(--color-gold-400);
  font-weight: 800;
}

.final-score {
  text-align: center;
  margin: 14px 0 4px;
  font-variant-numeric: tabular-nums;
}

.final-score .num {
  font-size: 56px;
  font-weight: 800;
  line-height: 1;
  color: var(--color-text-main);
}

.final-score .den {
  font-size: 20px;
  color: var(--color-text-dim);
  font-weight: 700;
}

.final-rate {
  text-align: center;
  color: var(--color-text-dim);
  font-size: 13px;
  margin: 0 0 18px;
}

.final-rate .pct {
  color: var(--color-gold-400);
  font-weight: 800;
}
</style>
