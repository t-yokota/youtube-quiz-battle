<script setup lang="ts">
import ResultChip from './ResultChip.vue'
defineProps<{ correct: number; incorrect: number }>()
</script>

<template>
  <div class="score-counts">
    <span class="count correct" :aria-label="`正解 ${correct}問`">
      <ResultChip variant="correct" /><strong>{{ correct }}</strong>
    </span>
    <span class="count incorrect" :aria-label="`不正解 ${incorrect}問`">
      <ResultChip variant="incorrect" /><strong>{{ incorrect }}</strong>
    </span>
  </div>
</template>

<style scoped>
.score-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  font-size: 30px;
  font-variant-numeric: tabular-nums;
}
.count {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.count .chip {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
}
.count strong {
  color: var(--color-text-main);
}
</style>
