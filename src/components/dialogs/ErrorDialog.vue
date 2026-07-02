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
  showClose?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
  title: 'エラーが発生しました',
  message: '問題が発生しました。もう一度お試しください。',
  actionLabel: 'ページを再読み込み',
  showAction: true,
  showClose: true,
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
            <button v-if="showClose" class="close-button" @click="handleClose">閉じる</button>
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
  background-color: rgba(5, 8, 18, 0.72);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
}

/* Dialog Container（ステージ調） */
.dialog-container {
  background-color: var(--color-stage-800);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  padding: 1.625rem 1.375rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  max-width: 25rem;
  width: 100%;
  text-align: center;
  box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.6);
}

/* Error Icon */
.error-icon {
  width: 4rem;
  height: 4rem;
  color: var(--color-signal-500);
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
  color: var(--color-text-main);
}

/* Dialog Message */
.dialog-message {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-dim);
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
  padding: 0.625rem 1.375rem;
  min-height: max(44px, 2.75rem);
  background-color: var(--color-gold-400);
  color: var(--color-stage-900);
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 800;
  cursor: pointer;
  transition: background var(--duration-fast);
}

.action-button:hover {
  background-color: #ffd566;
}

/* Close Button */
.close-button {
  padding: 0.625rem 1.375rem;
  min-height: max(44px, 2.75rem);
  background-color: var(--color-stage-700);
  color: var(--color-text-main);
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 800;
  cursor: pointer;
  transition: filter var(--duration-fast);
}

.close-button:hover {
  filter: brightness(1.2);
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
