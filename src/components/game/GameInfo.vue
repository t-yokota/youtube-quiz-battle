<script setup lang="ts">
// GameInfo コンポーネント（スコアボード）
// セグメント風の「Q 03 / 05」進行表示と、直近5問の○×チップ列を表示する
// チップ列は現在の問題を右端とするスライディングウィンドウ + 三角ページャ

import { ref, computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { CHIP_WINDOW } from '@/constants/scoreboard'
import { GameState } from '@/types'
import type { QuestionResult } from '@/types'
import ResultChip, { type ChipVariant } from './ResultChip.vue'

const gameStore = useGameStore()

const pad2 = (n: number) => String(n).padStart(2, '0')

// 表示中の問題番号（0: 問題開始前, 1~: 問題番号）
const current = computed(() => gameStore.currentQuestionNumber)
const total = computed(() => gameStore.totalQuestions)

// 進行表示テキスト（開始前は 00 と表示）
const progressNum = computed(() => pad2(current.value))
const progressTotal = computed(() => pad2(total.value))

// 問題番号 → 戦績マークの対応表
function markOf(result: QuestionResult): ChipVariant {
  if (result.isCorrect) return 'correct'
  if (result.skipped) return 'skipped'
  if (result.userAnswers.length === 0) return 'noanswer'
  return 'incorrect'
}

const resultMap = computed(() => {
  const map = new Map<number, ChipVariant>()
  for (const r of gameStore.results) {
    map.set(r.questionNumber, markOf(r))
  }
  return map
})

// ページャの表示ウィンドウ制御（null = 現在の問題に自動追従）
const chipStart = ref<number | null>(null)

// 右端は「現在の問題が右端に来る位置」まで。未来の問題側へは送れない
const maxChipStart = computed(() => Math.max(1, current.value - CHIP_WINDOW + 1))

const start = computed(() => chipStart.value ?? maxChipStart.value)
const end = computed(() => Math.min(total.value, start.value + CHIP_WINDOW - 1))

const showPager = computed(() => total.value > CHIP_WINDOW)
const prevDisabled = computed(() => start.value <= 1)
const nextDisabled = computed(() => start.value >= maxChipStart.value)

interface ChipItem {
  q: number
  variant: ChipVariant
  isCurrent: boolean
}

// 問題区間の進行中か（QUESTIONING〜REVEALING）。REVEAL 終了（TALKING 等）でグローを消す
const isQuestionActive = computed(() =>
  [GameState.QUESTIONING, GameState.ANSWERING, GameState.WAITING, GameState.REVEALING].includes(
    gameStore.currentState,
  ),
)

const chips = computed<ChipItem[]>(() => {
  const items: ChipItem[] = []
  for (let q = start.value; q <= end.value; q++) {
    // 結果が記録された瞬間に即マーク表示する。
    // 正解/不正解は確定（解答権 0）時、スキップはシーク消費時に記録されるため、
    // 未来の問題番号（前方シークで飛ばした問題）でも記録があれば表示する
    const variant: ChipVariant = resultMap.value.get(q) ?? 'empty'
    // 金グローはマーク表示に関わらず現在の問題に重ね、REVEAL 終了で消灯
    items.push({ q, variant, isCurrent: q === current.value && isQuestionActive.value })
  }
  return items
})

function moveChips(delta: number) {
  const next = (chipStart.value ?? maxChipStart.value) + delta
  chipStart.value = Math.min(maxChipStart.value, Math.max(1, next))
}
</script>

<template>
  <section class="game-info">
    <!-- 進行表示（Q NN / NN） -->
    <div class="progress">
      <span class="q-label">Q</span><span>{{ progressNum }}</span
      ><span class="total"> / {{ progressTotal }}</span>
    </div>

    <!-- ○×チップ列（直近5問ウィンドウ） -->
    <div class="score-chips">
      <button
        v-if="showPager"
        class="chips-nav prev"
        :disabled="prevDisabled"
        aria-label="前の結果"
        @click="moveChips(-1)"
      >
        <svg viewBox="0 0 10 12" aria-hidden="true">
          <path d="M2.5 1.5 L8.5 6 L2.5 10.5 Z" fill="currentColor" />
        </svg>
      </button>

      <ResultChip
        v-for="chip in chips"
        :key="chip.q"
        :variant="chip.variant"
        :current="chip.isCurrent"
      />

      <button
        v-if="showPager"
        class="chips-nav next"
        :disabled="nextDisabled"
        aria-label="次の結果"
        @click="moveChips(1)"
      >
        <svg viewBox="0 0 10 12" aria-hidden="true">
          <path d="M2.5 1.5 L8.5 6 L2.5 10.5 Z" fill="currentColor" />
        </svg>
      </button>
    </div>
  </section>
</template>

<style scoped>
/* スコアボード */
.game-info {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.625rem 0.875rem;
  background: var(--color-stage-800);
  border-bottom: 1px solid var(--color-line);
}

/* 進行表示 */
.progress {
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  font-size: 1.0625rem;
  letter-spacing: 0.04em;
  color: var(--color-text-main);
}

.progress .q-label {
  font-size: 0.9375rem;
  color: var(--color-gold-400);
  letter-spacing: 0.2em;
  margin-right: 0.2rem;
  vertical-align: 1px;
}

.progress .total {
  color: var(--color-text-dim);
  font-size: 0.75rem;
  font-weight: 600;
}

/* チップ列 */
.score-chips {
  display: flex;
  align-items: center;
  gap: 0.3125rem;
}

/* 三角ページャ（視覚は 7x9・タッチ領域は擬似要素で 2.75rem 確保） */
.chips-nav {
  position: relative;
  width: 0.875rem;
  height: 1rem;
  display: grid;
  place-items: center;
  background: none;
  border: none;
  padding: 0;
  color: var(--color-text-dim);
  cursor: pointer;
}

.chips-nav::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: max(44px, 2.75rem);
  height: max(44px, 2.75rem);
  transform: translate(-50%, -50%);
}

.chips-nav:hover:not(:disabled) {
  color: var(--color-text-main);
}

.chips-nav:disabled {
  opacity: 0.25;
  cursor: default;
}

.chips-nav svg {
  width: 0.4375rem;
  height: 0.5625rem;
  display: block;
}

.chips-nav.prev svg {
  transform: scaleX(-1);
}
</style>
