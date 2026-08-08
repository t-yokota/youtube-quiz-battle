<script setup lang="ts">
// GamePanel コンポーネント
// 解答エリア（GuideText/AnswerContent）のパネル
// 表示値は gameStore を直接参照する（props バケツリレーを廃止）
// スコアボード（GameInfo）は video 直下に密着させるため App.vue 側で配置する

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
  <!-- Answer Area（正解/不正解時は縁取りフラッシュ。REVEALING 終了＝guide モード復帰で消灯） -->
  <section
    class="answer-area"
    :class="{
      'flash-correct': gameStore.gamePanelMode === 'answer' && gameStore.answerResult === 'correct',
      'flash-incorrect':
        gameStore.gamePanelMode === 'answer' && gameStore.answerResult === 'incorrect',
    }"
  >
    <!-- Guide Text Mode (LOADING/READY/TALKING状態) -->
    <GuideText v-if="gameStore.gamePanelMode === 'guide'" />

    <!-- Answer Content Mode (QUESTIONING/ANSWERING/WAITING/REVEALING状態) -->
    <AnswerContent v-else @submit="handleSubmit" />
  </section>
</template>

<style scoped>
/* Answer Area（テーマトークン化: 面・境界・ソフトシャドウ） */
.answer-area {
  flex-shrink: 0;
  background: var(--surface-panel);
  border: var(--panel-border);
  border-radius: var(--radius-lg);
  padding: 0.75rem 0.875rem;
  height: 6.875rem;
  display: flex;
  align-items: stretch;
  position: relative;
  overflow: hidden;
  box-shadow: var(--panel-shadow);
  transition: border-color var(--duration-base);
}

/* 正解/不正解時はエリア全体の枠色だけを切り替える */
.answer-area.flash-correct {
  border-color: var(--color-answer-correct);
}

.answer-area.flash-incorrect {
  border-color: var(--color-answer-wrong);
}
</style>
