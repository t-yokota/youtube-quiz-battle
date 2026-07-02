<script setup lang="ts">
// OrientationDialog コンポーネント
// 横画面警告ダイアログ

// Props定義（Phase 2で状態管理と連携予定）
interface Props {
  isOpen?: boolean
}

withDefaults(defineProps<Props>(), {
  isOpen: false,
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="isOpen" class="dialog-overlay">
        <div class="dialog-container">
          <!-- Rotation Icon -->
          <div class="rotation-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="icon"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
          </div>

          <!-- Message -->
          <h3 class="dialog-title">画面を縦向きにしてください</h3>
          <p class="dialog-message">
            このアプリは縦画面専用です。<br />
            デバイスを縦向きに回転させてください。
          </p>
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
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
}

/* Dialog Container */
.dialog-container {
  background-color: white;
  border-radius: 0.75rem;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

/* Rotation Icon */
.rotation-icon {
  width: 4rem;
  height: 4rem;
  color: var(--color-legacy-blue);
  animation: rotate 2s ease-in-out infinite;
}

.icon {
  width: 100%;
  height: 100%;
}

@keyframes rotate {
  0%, 100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(90deg);
  }
}

/* Dialog Title */
.dialog-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: bold;
  color: var(--color-legacy-gray-900);
}

/* Dialog Message */
.dialog-message {
  margin: 0;
  font-size: 1rem;
  color: var(--color-legacy-gray-600);
  line-height: 1.6;
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
  }

  .rotation-icon {
    width: 3rem;
    height: 3rem;
  }

  .dialog-title {
    font-size: 1.125rem;
  }

  .dialog-message {
    font-size: 0.9375rem;
  }
}
</style>
