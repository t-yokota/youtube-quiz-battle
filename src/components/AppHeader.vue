<script setup lang="ts">
// Header コンポーネント
// タイトル表示と設定ボタンを含む

// 設定ボタンクリック時のイベント
const handleSettingsClick = () => {
  // TODO: Phase 2で設定モーダル表示の実装
  console.log('Settings button clicked')
}
</script>

<template>
  <header class="header">
    <div class="header-content">
      <h1 class="header-title">YouTube Quiz Battle</h1>
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
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
/* Header */
.header {
  flex-shrink: 0;
  background-color: #2563eb;
  color: white;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 100%;
  margin: 0 auto;
}

.header-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: bold;
  flex: 1;
  text-align: center;
}

.settings-button {
  position: absolute;
  right: 1rem;
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  transition: background-color 0.2s;
}

.settings-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.settings-button:active {
  background-color: rgba(255, 255, 255, 0.2);
}

.settings-icon {
  width: 1.5rem;
  height: 1.5rem;
}

/* モバイル対応 */
@media (max-width: 640px) {
  .header {
    padding: 0.75rem;
  }

  .header-title {
    font-size: 1.25rem;
  }

  .settings-button {
    right: 0.75rem;
    padding: 0.375rem;
  }

  .settings-icon {
    width: 1.25rem;
    height: 1.25rem;
  }
}

/* 小さい画面での追加調整 */
@media (max-height: 700px) {
  .header {
    padding: 0.5rem;
  }

  .header-title {
    font-size: 1.125rem;
  }

  .settings-button {
    right: 0.5rem;
  }
}
</style>
