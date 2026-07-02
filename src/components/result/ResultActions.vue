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
}

.replay-button {
  margin-top: 0.875rem;
  height: max(44px, 3rem);
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-signal-500);
  color: #fff;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.replay-button:hover {
  background: #f0523f;
}

.replay-button:active {
  filter: brightness(0.9);
}
</style>
