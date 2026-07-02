<script setup lang="ts">
// Header コンポーネント
// タイトル表示と設定ボタンを含む

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
        <!-- 歯車アイコン (Heroicons Cog-6-tooth) -->
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="settings-icon"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
/* Header（ステージ調） */
.header {
  flex-shrink: 0;
  padding: 0.625rem 0.75rem 0.5rem;
  border-bottom: 1px solid var(--color-line);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent);
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
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-main);
}

.wordmark .accent {
  color: var(--color-gold-400);
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
  background-color: var(--color-stage-700);
}

.settings-icon {
  width: 1.5rem;
  height: 1.5rem;
}
</style>
