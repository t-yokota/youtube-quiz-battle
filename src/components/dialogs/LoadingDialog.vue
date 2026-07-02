<script setup lang="ts">
// LoadingDialog コンポーネント
// ローディング中のダイアログ表示

// Props定義（Phase 2で状態管理と連携予定）
interface Props {
  isOpen?: boolean
  message?: string
}

withDefaults(defineProps<Props>(), {
  isOpen: false,
  message: '読み込み中...',
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="isOpen" class="dialog-overlay">
        <div class="dialog-container">
          <!-- Loading Spinner -->
          <div class="spinner"></div>

          <!-- Loading Message -->
          <p class="loading-message">{{ message }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Dialog Overlay */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(5, 8, 18, 0.72);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

/* Dialog Container（ステージ調） */
.dialog-container {
  background-color: var(--color-stage-800);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  padding: 26px 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  min-width: 280px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
}

/* Loading Spinner */
.spinner {
  width: 44px;
  height: 44px;
  border: 4px solid var(--color-stage-700);
  border-top-color: var(--color-gold-400);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Loading Message */
.loading-message {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-main);
}

/* Dialog Transition */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.3s;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

/* モバイル対応 */
@media (max-width: 640px) {
  .dialog-container {
    padding: 1.5rem;
    min-width: 180px;
  }

  .spinner {
    width: 2.5rem;
    height: 2.5rem;
  }

  .loading-message {
    font-size: 0.9375rem;
  }
}
</style>
