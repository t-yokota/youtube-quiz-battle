<script setup lang="ts">
// ResultActions コンポーネント
// リザルト画面のアクションボタン

// イベント定義
const emit = defineEmits<{
  replay: []
}>()

const handleReplay = () => {
  emit('replay')
}
</script>

<template>
  <div class="action-buttons">
    <button class="replay-button" @click="handleReplay">もう一度プレイ</button>
  </div>
</template>

<style scoped>
/* Action Buttons */
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0 0.5rem;
}

.replay-button {
  padding: 0.875rem 1.5rem;
  background-color: var(--color-legacy-blue);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.replay-button:hover {
  background-color: var(--color-legacy-blue-dark);
}

.replay-button:active {
  transform: translateY(1px);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* モバイル対応 */
@media (max-width: 640px) {
  .replay-button {
    padding: 0.75rem 1.25rem;
    font-size: 0.9375rem;
  }
}

/* 小さい画面での追加調整 */
@media (max-height: 700px) {
  .replay-button {
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
  }
}
</style>
