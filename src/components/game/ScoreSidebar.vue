<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { GameState } from '@/types'
import ResultChip, { type ChipVariant } from './ResultChip.vue'
import ScoreCounts from './ScoreCounts.vue'
const store = useGameStore()
// 判定確定後の問題数。解答試行回数ではなく、RESULTSの○／×と一致させる。
const counts = computed(() => ({
  correct: store.results.filter((result) => !result.skipped && result.isCorrect).length,
  incorrect: store.results.filter(
    (result) => !result.skipped && !result.isCorrect && result.userAnswers.length > 0,
  ).length,
}))
const resultMap = computed(
  () => new Map(store.results.map((result) => [result.questionNumber, result])),
)
const showCurrent = computed(
  () =>
    [GameState.QUESTIONING, GameState.ANSWERING].includes(store.currentState) &&
    !resultMap.value.has(store.currentQuestionNumber),
)
function markOf(number: number): ChipVariant {
  const result = resultMap.value.get(number)
  if (!result) return 'empty'
  if (result.isCorrect) return 'correct'
  if (result.skipped) return 'skipped'
  return result.userAnswers.length === 0 ? 'noanswer' : 'incorrect'
}
</script>
<template>
  <aside class="score-sidebar" aria-label="クイズの進行と結果">
    <section class="score-progress">
      <h2>QUESTION</h2>
      <p class="score-question">
        <span>Q</span> {{ String(store.currentQuestionNumber).padStart(2, '0')
        }}<small> / {{ String(store.totalQuestions).padStart(2, '0') }}</small>
      </p>
      <h2 class="score-heading">SCORE</h2>
      <ScoreCounts :correct="counts.correct" :incorrect="counts.incorrect" />
    </section>
    <h2 class="results-heading">RESULTS</h2>
    <div class="sidebar-results">
      <div v-for="result in store.results" :key="result.questionNumber" class="result-row">
        <ResultChip :variant="markOf(result.questionNumber)" />
        <div class="result-body">
          <strong>{{ result.correctAnswer }}</strong
          ><span>{{
            result.skipped
              ? 'スキップ'
              : result.userAnswers.some((answer) => answer !== '')
                ? `あなた: ${result.userAnswers.findLast((answer) => answer !== '')}`
                : '無解答'
          }}</span>
        </div>
        <span class="result-number">Q{{ result.questionNumber }}</span>
      </div>
      <div v-if="showCurrent" class="current-question-row score-chips">
        <ResultChip variant="empty" current />
        <strong>{{ store.currentState === GameState.ANSWERING ? '解答中' : '出題中' }}</strong>
        <span class="result-number">Q{{ store.currentQuestionNumber }}</span>
      </div>
    </div>
  </aside>
</template>
<style scoped>
.score-sidebar {
  min-width: 0;
  container-type: inline-size;
  --sidebar-unit: clamp(16px, 6.25cqw, 20px);
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 0.875rem;
  background: var(--surface-app);
  border-left: 1px solid var(--color-line);
}
h2 {
  margin: 0;
  font-size: calc(0.75 * var(--sidebar-unit));
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--color-text-dim);
}
.results-heading {
  margin-top: 0.5rem;
}
.score-heading {
  margin-bottom: 0.875rem;
}
.score-progress {
  padding: clamp(0.5rem, 5cqw, 1.125rem);
  min-width: 0;
  border: var(--panel-border);
  border-radius: var(--radius-lg);
  background: var(--surface-panel);
  box-shadow: var(--panel-shadow);
}
.score-question {
  margin: 0.5rem 0 1.125rem;
  font-size: calc(2.4 * var(--sidebar-unit));
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.score-question > span {
  font-size: calc(1.4 * var(--sidebar-unit));
  color: var(--color-accent);
}
.score-question small {
  font-size: calc(1.125 * var(--sidebar-unit));
  color: var(--color-text-dim);
}
.score-chips .chip {
  width: clamp(24px, 10cqw, 34px);
  height: clamp(24px, 10cqw, 34px);
  flex-shrink: 0;
}
.sidebar-results {
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  /* 行幅を保ったままスクロール領域を広げ、四辺で影を切らない。 */
  margin-inline: calc(0.125rem - var(--result-shadow-gutter, 0.125rem));
  padding: var(--result-shadow-gutter, 0.125rem) var(--result-shadow-gutter, 0.125rem) 0.5rem;
  scrollbar-width: thin;
}
.result-row,
.current-question-row {
  display: flex;
  align-items: center;
  gap: clamp(0.25rem, 3cqw, 0.625rem);
  flex-shrink: 0;
  min-height: 3.125rem;
  padding: 0.5rem clamp(0.25rem, 3cqw, 0.75rem);
  border: var(--panel-border);
  border-radius: var(--radius-md);
  background: var(--surface-panel);
  box-shadow: var(--row-shadow);
  font-size: calc(0.75 * var(--sidebar-unit));
}
.result-row .chip,
.current-question-row .chip {
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
}
.result-body {
  min-width: 0;
  overflow-wrap: anywhere;
}
.result-body span {
  display: block;
  color: var(--color-text-dim);
  font-size: calc(0.6875 * var(--sidebar-unit));
}
.result-number {
  margin-left: auto;
  color: var(--color-text-dim);
  flex-shrink: 0;
}
.current-question-row {
  border: 1px dashed var(--color-accent);
  color: var(--color-accent);
  background: transparent;
  box-shadow: none;
}
</style>
