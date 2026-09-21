<script setup lang="ts">
// GamePanel コンポーネント
// 解答エリア（GuideText/AnswerContent）のパネル
// 表示値は gameStore を直接参照する（props バケツリレーを廃止）
// スコアボード（GameInfo）は video 直下に密着させるため App.vue 側で配置する

import { ref } from 'vue'
import GuideText from './GuideText.vue'
import AnswerContent from './AnswerContent.vue'
import { useGameStore } from '@/stores/gameStore'
import { GameState } from '@/types'

defineProps<{ desktop?: boolean; compact?: boolean; focusBlocked?: boolean }>()
const gameStore = useGameStore()
const compactLabelWidth = ref<number>()

// イベント定義（解答送信は GameManager 経由必須のため emit を維持）
const emit = defineEmits<{
  submit: [answer: string]
  replay: []
}>()

const handleSubmit = (answer: string) => {
  emit('submit', answer)
}
</script>

<template>
  <button
    v-if="desktop && gameStore.currentState === GameState.FINISHED"
    type="button"
    class="answer-area is-guide replay-card"
    :style="{ '--compact-label-width': compactLabelWidth ? `${compactLabelWidth}px` : undefined }"
    :disabled="focusBlocked"
    @click="emit('replay')"
  >
    <GuideText
      message="もう一度プレイ"
      hide-down-cue
      measure-width
      @content-width="compactLabelWidth = $event"
    />
  </button>
  <!-- Answer Area（正解/不正解時は縁取りフラッシュ。REVEALING 終了＝guide モード復帰で消灯） -->
  <section
    v-else
    class="answer-area"
    :style="{ '--compact-label-width': compactLabelWidth ? `${compactLabelWidth}px` : undefined }"
    :class="{
      'is-guide': gameStore.gamePanelMode === 'guide',
      'flash-correct': gameStore.gamePanelMode === 'answer' && gameStore.answerResult === 'correct',
      'flash-incorrect':
        gameStore.gamePanelMode === 'answer' && gameStore.answerResult === 'incorrect',
    }"
  >
    <!-- Guide Text Mode (LOADING/READY/TALKING状態) -->
    <GuideText
      v-if="gameStore.gamePanelMode === 'guide'"
      :hide-down-cue="desktop"
      :measure-width="desktop"
      @content-width="compactLabelWidth = $event"
    />

    <!-- Answer Content Mode (QUESTIONING/ANSWERING/WAITING/REVEALING状態) -->
    <AnswerContent
      v-else
      :desktop="desktop"
      :compact="compact"
      :focus-blocked="focusBlocked"
      @compact-width="compactLabelWidth = $event"
      @submit="handleSubmit"
    />
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
  min-height: 6.875rem;
  display: flex;
  align-items: stretch;
  position: relative;
  overflow: hidden;
  box-shadow: var(--panel-shadow);
  transition: border-color var(--duration-base);
}

.answer-area.is-guide {
  height: 6.875rem;
}

/* 正解/不正解時はエリア全体の枠色だけを切り替える */
.answer-area.flash-correct {
  border-color: var(--color-answer-correct);
}

.answer-area.flash-incorrect {
  border-color: var(--color-answer-wrong);
}
</style>
