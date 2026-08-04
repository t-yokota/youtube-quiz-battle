<script setup lang="ts">
// Header コンポーネント
// タイトル表示と設定ボタンを含む
import SettingsIcon from './SettingsIcon.vue'

// イベント定義
const emit = defineEmits<{
  openSettings: []
}>()

// 設定ボタンクリック時のイベント
const handleSettingsClick = () => {
  emit('openSettings')
}
</script>

<template>
  <header class="header">
    <div class="header-content">
      <span class="wordmark">YouTube <span class="accent">Quiz Battle</span></span>
      <button
        class="settings-button"
        @click="handleSettingsClick"
        aria-label="設定を開く"
        title="設定"
      >
        <SettingsIcon class="settings-icon" />
      </button>
    </div>
  </header>
</template>

<style scoped>
/* Header（テーマトークン化: 背景・アクセント・ホバー面） */
.header {
  flex-shrink: 0;
  padding: 0.625rem 0.75rem 0.5rem;
  border-bottom: 1px solid var(--color-line);
  background: var(--header-bg);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 100%;
  margin: 0 auto;
}

.wordmark {
  font-weight: 800;
  font-size: 0.8125rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-main);
}

.wordmark .accent {
  color: var(--color-accent);
}

.settings-button {
  background: none;
  border: none;
  color: var(--color-text-dim);
  cursor: pointer;
  /* タッチターゲット確保（≥2.75rem）。視覚アイコンは 1.5rem */
  width: max(44px, 2.75rem);
  height: max(44px, 2.75rem);
  /* 当たり判定拡張ぶんを右に逃がし、アイコンの視覚位置をヘッダー右端に揃える */
  margin: -0.625rem calc((max(44px, 2.75rem) - 1.5rem) / -2) -0.625rem 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition:
    color var(--duration-fast),
    background-color var(--duration-fast);
}

.settings-button:hover {
  color: var(--color-text-main);
  background-color: var(--surface-raised);
}

.settings-icon {
  width: 1.5rem;
  height: 1.5rem;
}
</style>
