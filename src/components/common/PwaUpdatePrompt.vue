<script setup lang="ts">
import { ref } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'

const { needRefresh, updateServiceWorker } = useRegisterSW()
const isUpdating = ref(false)
const updateFailed = ref(false)

function dismiss() {
  needRefresh.value = false
  updateFailed.value = false
}

async function applyUpdate() {
  if (isUpdating.value) return

  isUpdating.value = true
  updateFailed.value = false
  try {
    // このPromiseは更新要求の送信で完了し、再読み込み完了を待つものではない。
    // 成功時は更新中表示を維持し、タップへの応答が一瞬で元に戻るのを防ぐ。
    await updateServiceWorker(true)
  } catch {
    updateFailed.value = true
    isUpdating.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pwa-update">
      <aside
        v-if="needRefresh || isUpdating"
        class="pwa-update-prompt"
        :class="{ 'pwa-update-toast': isUpdating }"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <p class="pwa-update-message">
          {{
            isUpdating
              ? '更新しています…'
              : updateFailed
                ? '更新できませんでした。もう一度お試しください'
                : '新しいバージョンがあります'
          }}
        </p>
        <div v-if="!isUpdating" class="pwa-update-actions">
          <button type="button" class="pwa-update-dismiss" @click="dismiss">あとで</button>
          <button
            type="button"
            class="pwa-update-action"
            :disabled="isUpdating"
            @click="applyUpdate"
          >
            {{ isUpdating ? '更新中…' : '更新' }}
          </button>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pwa-update-prompt {
  position: fixed;
  left: max(1rem, env(safe-area-inset-left));
  right: max(1rem, env(safe-area-inset-right));
  bottom: max(1rem, env(safe-area-inset-bottom));
  z-index: 2400;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0.875rem;
  border: var(--panel-border);
  border-radius: 0.75rem;
  background: var(--surface-panel);
  box-shadow: var(--modal-shadow);
  color: var(--color-text-main);
}

.pwa-update-message {
  margin: 0;
  font-size: calc(0.8125 * var(--ui-font-unit));
  font-weight: 700;
  line-height: 1.4;
}

.pwa-update-toast {
  width: fit-content;
  max-width: calc(100% - 2rem - env(safe-area-inset-left) - env(safe-area-inset-right));
  margin-inline: auto;
  justify-content: center;
  padding: 0.75rem 1.25rem;
  border: 0;
  border-radius: 0.5rem;
  background: #262626;
  color: #fff;
  box-shadow: 0 3px 12px rgb(0 0 0 / 20%);
  text-align: center;
}

.pwa-update-toast .pwa-update-message {
  font-weight: 500;
}

.pwa-update-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 0.5rem;
}

.pwa-update-dismiss,
.pwa-update-action {
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  font: inherit;
  font-size: calc(0.75 * var(--ui-font-unit));
  font-weight: 700;
  cursor: pointer;
}

.pwa-update-dismiss {
  border: 1px solid var(--color-line);
  background: transparent;
  color: var(--color-text-sub);
}

.pwa-update-action {
  border: 1px solid transparent;
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  box-shadow: var(--btn-primary-shadow);
}

.pwa-update-action:disabled {
  cursor: wait;
  opacity: 0.7;
}

.pwa-update-enter-active,
.pwa-update-leave-active {
  transition:
    opacity var(--duration-base),
    transform var(--duration-base);
}

.pwa-update-enter-from,
.pwa-update-leave-to {
  opacity: 0;
  transform: translateY(0.75rem);
}

@media (max-width: 340px) {
  .pwa-update-prompt {
    align-items: stretch;
    flex-direction: column;
  }

  .pwa-update-actions {
    justify-content: flex-end;
  }
}
</style>
