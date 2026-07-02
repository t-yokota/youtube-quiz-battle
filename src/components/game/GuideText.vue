<script setup lang="ts">
// GuideText コンポーネント
// ガイドテキスト表示（LOADING/READY/TALKING状態）
// READY ではボタンへ視線誘導する矢印モーションを表示する

import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { GameState } from '@/types'

const gameStore = useGameStore()

// READY時のみボタンへの視線誘導矢印を表示
const showDownCue = computed(() => gameStore.currentState === GameState.READY)
</script>

<template>
  <div class="guide-text">
    <span class="guide-message">{{ gameStore.guideText }}</span>
    <span v-if="showDownCue" class="down-cue" aria-hidden="true">▼</span>
  </div>
</template>

<style scoped>
/* Guide Text */
.guide-text {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  color: var(--color-text-dim);
  line-height: 1.5;
}

.guide-message {
  margin: 0;
}

/* READY時: ボタンへの視線誘導 */
.down-cue {
  font-size: 0.875rem;
  color: var(--color-gold-400);
  animation: bob 1.2s ease-in-out infinite;
}

@keyframes bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(0.25rem);
  }
}
</style>
