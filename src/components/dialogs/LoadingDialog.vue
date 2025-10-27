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
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

/* Dialog Container */
.dialog-container {
  background-color: white;
  border-radius: 0.75rem;
  padding: 3rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  min-width: 280px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

/* Loading Spinner */
.spinner {
  width: 4rem;
  height: 4rem;
  border: 4px solid #e5e7eb;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Loading Message */
.loading-message {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 500;
  color: #333;
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
