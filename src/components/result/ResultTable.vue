<script setup lang="ts">
// ResultTable コンポーネント
// 問題別タイムライン表示（○×/スキップ/無解答マーク + 正答 + あなたの解答）

import type { QuestionResult } from '@/types/result'
import ResultChip, { type ChipVariant } from '@/components/game/ResultChip.vue'

// Props定義
interface Props {
  results?: QuestionResult[]
  showUserAnswers?: boolean // 「あなたの解答」行を表示するか
}

withDefaults(defineProps<Props>(), {
  results: () => [],
  showUserAnswers: true,
})

// 戦績 → チップ種別の判定（GameInfo のチップ列と同一基準）
function markOf(result: QuestionResult): ChipVariant {
  if (result.isCorrect) return 'correct'
  if (result.skipped) return 'skipped'
  if (result.userAnswers.length === 0) return 'noanswer'
  return 'incorrect'
}

// 「あなたの解答」表示テキスト
function yoursText(result: QuestionResult): string {
  if (result.skipped) return 'スキップ'
  const lastAnswer = result.userAnswers.findLast((a: string) => a !== '') ?? ''
  return `あなた: ${lastAnswer}`
}
</script>

<template>
  <div class="result-list">
    <div v-for="result in results" :key="result.questionNumber" class="result-row">
      <ResultChip class="mark" :variant="markOf(result)" />
      <span class="body">
        <span class="ans">{{ result.correctAnswer }}</span>
        <br v-if="showUserAnswers" />
        <span v-if="showUserAnswers" class="yours">{{ yoursText(result) }}</span>
      </span>
      <span class="qno">Q{{ result.questionNumber }}</span>
    </div>
  </div>
</template>

<style scoped>
/* 問題別タイムライン（スクロールバーは矢印なしの細バー・バーとリストの間隔を確保） */
.result-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 10px;
  padding-right: 6px; /* バー(4px) + 6px = 左の 10px と釣り合い、行が中央を保つ */
  scrollbar-gutter: stable;
}

.result-list::-webkit-scrollbar {
  width: 4px;
}

.result-list::-webkit-scrollbar-thumb {
  background: var(--color-stage-700);
  border-radius: 4px;
}

.result-list::-webkit-scrollbar-track {
  background: transparent;
}

.result-list::-webkit-scrollbar-button {
  display: none;
  width: 0;
  height: 0;
}

/* WebKit 疑似要素が効かない環境（Firefox）向け */
@supports not selector(::-webkit-scrollbar) {
  .result-list {
    scrollbar-width: thin;
    scrollbar-color: var(--color-stage-700) transparent;
  }
}

.result-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--color-stage-800);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: 9px 12px;
  font-size: 12px;
  color: var(--color-text-main);
}

.result-row .mark {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: block;
  flex-shrink: 0;
}

.result-row .body {
  min-width: 0;
}

.result-row .ans {
  font-weight: 700;
}

.result-row .yours {
  color: var(--color-text-dim);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-row .qno {
  margin-left: auto;
  color: var(--color-text-dim);
  font-size: 10px;
  flex-shrink: 0;
}
</style>
