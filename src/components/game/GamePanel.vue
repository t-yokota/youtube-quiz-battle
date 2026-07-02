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

    <!-- Answer Area -->
    <div class="answer-area">
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
  gap: 0;
}

/* Answer Area */
.answer-area {
  flex-shrink: 0;
  background-color: white;
  padding: 0.875rem;
  border-radius: 0 0 0.75rem 0.75rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  height: 110px;
  display: flex;
  align-items: stretch;
}

/* モバイル対応 */
@media (max-width: 640px) {
  .game-panel {
    gap: 0.15rem;
  }

  .answer-area {
    padding: 0.75rem;
    height: 100px;
  }
}

/* 小さい画面での追加調整 */
@media (max-height: 700px) {
  .game-panel {
    gap: 0.2rem;
  }

  .answer-area {
    padding: 0.625rem;
    height: 90px;
  }
}
</style>
