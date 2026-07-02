<script setup lang="ts">
// GuideText コンポーネント
// ガイドテキスト表示（LOADING/READY/TALKING状態）

import { useGameStore } from '@/stores/gameStore'

const gameStore = useGameStore()
</script>

<template>
  <div class="guide-text">
    <p class="guide-message">{{ gameStore.guideText }}</p>
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
}

.guide-message {
  margin: 0;
  color: #6b7280;
  font-size: 1rem;
  line-height: 1.4;
}

/* モバイル対応 */
@media (max-width: 640px) {
  .guide-message {
    font-size: 0.9375rem;
  }
}

/* 小さい画面での追加調整 */
@media (max-height: 700px) {
  .guide-message {
    font-size: 0.875rem;
  }
}
</style>
