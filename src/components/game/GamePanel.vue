<script setup lang="ts">
// GamePanel コンポーネント
// GameInfo + Answer領域（GuideText/AnswerContent）を一つのパネルにまとめる
// 表示値は gameStore を直接参照する（props バケツリレーを廃止）

import GameInfo from './GameInfo.vue'
import GuideText from './GuideText.vue'
import AnswerContent from './AnswerContent.vue'
import { useGameStore } from '@/stores/gameStore'

const gameStore = useGameStore()

// イベント定義（解答送信は GameManager 経由必須のため emit を維持）
const emit = defineEmits<{
  submit: [answer: string]
}>()

const handleSubmit = (answer: string) => {
  emit('submit', answer)
}
</script>

<template>
  <section class="game-panel">
    <!-- Game Info -->
    <GameInfo />

    <!-- Answer Area（正解/不正解時は縁取りフラッシュ） -->
    <div
      class="answer-area"
      :class="{
        'flash-correct': gameStore.answerResult === 'correct',
        'flash-incorrect': gameStore.answerResult === 'incorrect',
      }"
    >
      <!-- Guide Text Mode (LOADING/READY/TALKING状態) -->
      <GuideText v-if="gameStore.gamePanelMode === 'guide'" />

      <!-- Answer Content Mode (QUESTIONING/ANSWERING/WAITING/REVEALING状態) -->
      <AnswerContent v-else @submit="handleSubmit" />
    </div>
  </section>
</template>

<style scoped>
/* Game Panel */
.game-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Answer Area（ステージ調カード） */
.answer-area {
  flex-shrink: 0;
  background: var(--color-stage-800);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  padding: 12px 14px;
  height: 110px;
  display: flex;
  align-items: stretch;
  position: relative;
  overflow: hidden;
  transition:
    border-color var(--duration-base),
    box-shadow var(--duration-base);
}

/* 正解/不正解時にエリア全体を縁取りフラッシュ */
.answer-area.flash-correct {
  border-color: var(--color-ok-400);
  box-shadow: 0 0 18px rgba(61, 220, 132, 0.25);
}

.answer-area.flash-incorrect {
  border-color: var(--color-signal-500);
  box-shadow: 0 0 18px rgba(230, 64, 46, 0.25);
}
</style>
