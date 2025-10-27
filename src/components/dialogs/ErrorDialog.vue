<script setup lang="ts">
// ErrorDialog コンポーネント
// エラー表示ダイアログ

// Props定義（Phase 2で状態管理と連携予定）
interface Props {
  isOpen?: boolean
  title?: string
  message?: string
  actionLabel?: string
  showAction?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
  title: 'エラーが発生しました',
  message: '問題が発生しました。もう一度お試しください。',
  actionLabel: 'ページを再読み込み',
  showAction: true,
})

// イベント定義
const emit = defineEmits<{
  action: []
  close: []
}>()

const handleAction = () => {
  emit('action')
}

const handleClose = () => {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="isOpen" class="dialog-overlay">
        <div class="dialog-container">
          <!-- Error Icon -->
          <div class="error-icon">
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
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>

          <!-- Error Title -->
          <h3 class="dialog-title">{{ title }}</h3>

          <!-- Error Message -->
          <p class="dialog-message">{{ message }}</p>

          <!-- Action Buttons -->
          <div class="button-group">
            <button v-if="showAction" class="action-button" @click="handleAction">
              {{ actionLabel }}
            </button>
            <button class="close-button" @click="handleClose">閉じる</button>
          </div>
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
  width: 100%;
  text-align: center;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

/* Error Icon */
.error-icon {
  width: 4rem;
  height: 4rem;
  color: #dc2626;
}

.icon {
  width: 100%;
  height: 100%;
}

/* Dialog Title */
.dialog-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: bold;
  color: #333;
}

/* Dialog Message */
.dialog-message {
  margin: 0;
  font-size: 1rem;
  color: #666;
  line-height: 1.6;
}

/* Button Group */
.button-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  margin-top: 0.5rem;
}

/* Action Button */
.action-button {
  padding: 0.75rem 1.5rem;
  background-color: #2563eb;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.action-button:hover {
  background-color: #1d4ed8;
}

/* Close Button */
.close-button {
  padding: 0.75rem 1.5rem;
  background-color: #e5e7eb;
  color: #333;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.close-button:hover {
  background-color: #d1d5db;
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

  .error-icon {
    width: 3rem;
    height: 3rem;
  }

  .dialog-title {
    font-size: 1.125rem;
  }

  .dialog-message {
    font-size: 0.9375rem;
  }

  .action-button,
  .close-button {
    padding: 0.625rem 1.25rem;
    font-size: 0.9375rem;
  }
}
</style>
