<script setup lang="ts">
import { useModalLayer } from '@/composables/useModalLayer'
// SettingsModal コンポーネント
// 設定画面のモーダル表示

import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import SettingsGeneral from './SettingsGeneral.vue'
import SettingsDebug from './SettingsDebug.vue'
import { useDebugStore } from '@/stores/debugStore'

// Props定義（Phase 2で状態管理と連携予定）
interface Props {
  isOpen?: boolean
  volumeLevel?: number // 0: Mute, 1-4: 音量レベル
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
  volumeLevel: 3,
})

const gameStore = useGameStore()
const debugStore = useDebugStore()

// デバッグモード対応データかどうか（クイズデータの settings.debug）
const isDebugData = computed(() => gameStore.quizData?.settings.debug === true)

// デバッグセクションの表示条件（Task 29-4）
const isDebugSectionVisible = computed(() => isDebugData.value && debugStore.isMenuVisible)

const handleDebugMenuToggle = () => {
  debugStore.setMenuVisible(!debugStore.isMenuVisible)
}

// イベント定義
const emit = defineEmits<{
  close: []
  updateVolume: [level: number]
  openThemeSwitcher: []
}>()

const handleClose = () => {
  emit('close')
}

// オーバーレイクリックで閉じる
const handleOverlayClick = (event: MouseEvent) => {
  if (event.target === event.currentTarget) {
    handleClose()
  }
}

const overlayRef = ref<HTMLElement | null>(null)
useModalLayer(overlayRef, () => props.isOpen, { label: '設定', priority: 1000, close: handleClose })
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isOpen" ref="overlayRef" class="modal-overlay" @click="handleOverlayClick">
        <div class="modal-container">
          <!-- Modal Header -->
          <div class="modal-header">
            <!-- デバッグメニュー表示トグル（debug データのみ表示。× ボタンの反対側） -->
            <button
              v-if="isDebugData"
              type="button"
              class="debug-menu-toggle"
              :class="{ 'debug-menu-toggle--active': debugStore.isMenuVisible }"
              aria-label="デバッグメニュー"
              @click="handleDebugMenuToggle"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="debug-menu-icon"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z"
                />
              </svg>
            </button>
            <h2 class="modal-title">設定</h2>
            <button
              class="close-button"
              data-dialog-autofocus
              aria-label="設定を閉じる"
              @click="handleClose"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="close-icon"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Modal Content -->
          <div class="modal-content">
            <p class="privacy-text">動画は停止します。解答中の制限時間は止まりません。</p>
            <SettingsGeneral
              :volume-level="volumeLevel"
              @update-volume="emit('updateVolume', $event)"
              @open-theme-switcher="emit('openThemeSwitcher')"
            />
            <SettingsDebug v-if="isDebugSectionVisible" />
            <section class="settings-section">
              <h3 class="section-title">データ収集について</h3>
              <div class="privacy-text">
                <p>
                  ゲーム改善のため匿名の利用データを収集しています。入力した解答内容も統計処理の対象ですが、個人を直接識別できる形では保存しません。
                </p>
                <ul class="privacy-list">
                  <li>プレイ統計</li>
                  <li>エラー情報</li>
                  <li>デバイス情報</li>
                  <li>入力した解答内容</li>
                </ul>
              </div>
            </section>

            <!-- Close Button -->
            <button class="primary-button" @click="handleClose">閉じる</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Modal Overlay */
.modal-overlay {
  /* 設定画面だけで調整できる縮尺。上下限は文字とUIで個別に調整可能 */
  --settings-layout-min: 13px;
  --settings-layout-max: 15px;
  --settings-font-min: 14px;
  --settings-font-max: 15px;
  --settings-layout-unit: clamp(
    var(--settings-layout-min),
    calc(min(var(--ui-layout-viewport-height) / 700, 100vw / 315) * 16),
    var(--settings-layout-max)
  );
  --settings-font-unit: clamp(
    var(--settings-font-min),
    calc(min(var(--ui-layout-viewport-height) / 700, 100vw / 315) * 16),
    var(--settings-font-max)
  );
  --settings-control-height: max(40px, calc(2.75 * var(--settings-layout-unit)));
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: var(--overlay-bg);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  /* コンテンツが長いときも上下に十分な余白を残す */
  padding: calc(2 * var(--settings-layout-unit)) var(--settings-layout-unit);
}

/* Modal Container */
.modal-container {
  background-color: var(--surface-panel);
  border: var(--panel-border);
  border-radius: var(--radius-lg);
  max-width: calc(27.5 * var(--settings-layout-unit));
  width: 100%;
  max-height: calc(var(--ui-viewport-height) - 4 * var(--settings-layout-unit));
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--modal-shadow);
}

/* Modal Header */
.modal-header {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: calc(0.75 * var(--settings-layout-unit)) var(--settings-layout-unit);
  border-bottom: 1px solid var(--color-line);
}

.modal-title {
  margin: 0;
  font-size: calc(1.25 * var(--settings-font-unit));
  font-weight: bold;
  color: var(--color-text-main);
}

.close-button {
  position: absolute;
  right: calc(0.5 * var(--settings-layout-unit));
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  /* タッチターゲット確保 */
  width: var(--settings-control-height);
  height: var(--settings-control-height);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-dim);
  transition: color 0.2s;
}

.close-button:hover {
  color: var(--color-text-main);
}

.close-icon {
  width: calc(1.25 * var(--settings-layout-unit));
  height: calc(1.25 * var(--settings-layout-unit));
}

/* Debug Menu Toggle（ヘッダー左・× ボタンの反対側。Task 29-4） */
.debug-menu-toggle {
  position: absolute;
  left: calc(0.5 * var(--settings-layout-unit));
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  /* タッチターゲット確保 */
  width: var(--settings-control-height);
  height: var(--settings-control-height);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-dim);
  transition: color 0.2s;
}

/* タッチデバイスの :hover 残留で --active の色が隠れないよう、ホバー可能環境に限定 */
@media (hover: hover) {
  .debug-menu-toggle:hover {
    color: var(--color-text-main);
  }
}

.debug-menu-toggle--active,
.debug-menu-toggle--active:hover {
  color: var(--color-accent);
}

.debug-menu-icon {
  width: calc(1.25 * var(--settings-layout-unit));
  height: calc(1.25 * var(--settings-layout-unit));
}

/* Modal Content */
.modal-content {
  overflow-y: auto;
  padding: var(--settings-layout-unit);
  display: flex;
  flex-direction: column;
  gap: calc(1.125 * var(--settings-layout-unit));
}

/* 子コンポーネントの表示トークンと共通コントロールを設定画面で統一する。 */
/* Settings Section（セクション間に罫線） */
:deep(.settings-section) {
  display: flex;
  flex-direction: column;
  gap: calc(0.5 * var(--settings-layout-unit));
}

:deep(.settings-section + .settings-section) {
  border-top: 1px solid var(--color-line);
  padding-top: var(--settings-layout-unit);
}

:deep(.section-title) {
  margin: 0;
  font-size: var(--settings-font-unit);
  font-weight: 700;
  color: var(--color-text-main);
}

/* 設定行（1段目: 見出しを兼ねるラベル + 右揃えの操作 UI） */
:deep(.setting-row) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(0.625 * var(--settings-layout-unit));
  min-height: var(--settings-control-height);
}

:deep(.theme-button) {
  min-height: var(--settings-control-height);
  padding: 0 calc(1.25 * var(--settings-layout-unit));
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  border: none;
  border-radius: var(--radius-md);
  box-shadow: var(--btn-primary-shadow);
  font-size: calc(0.875 * var(--settings-font-unit));
  font-weight: 800;
  cursor: pointer;
}

:deep(.setting-label) {
  font-size: var(--settings-font-unit);
  font-weight: 700;
  color: var(--color-text-main);
}

:deep(.seek-label) {
  font-size: calc(0.875 * var(--settings-font-unit));
  color: var(--color-text-main);
  font-weight: 500;
}

:deep(.seek-description) {
  margin: 0;
  font-size: calc(0.875 * var(--settings-font-unit));
  color: var(--color-text-dim);
}

/* トグルスイッチ（ゲーム画面のボタンチェックトグルと同型・青系） */
:deep(.ui-switch) {
  display: flex;
  align-items: center;
  min-height: var(--settings-control-height);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

:deep(.ui-switch-track) {
  position: relative;
  width: calc(2.75 * var(--settings-layout-unit));
  height: calc(1.625 * var(--settings-layout-unit));
  border-radius: 999px;
  background: var(--toggle-track);
  border: 1px solid var(--toggle-track-border);
  box-shadow: var(--toggle-track-shadow);
  flex-shrink: 0;
  transition:
    background var(--duration-base),
    border-color var(--duration-base);
}

:deep(.ui-switch-track.on) {
  background: var(--toggle-on-track);
  border-color: var(--toggle-on-border);
}

:deep(.ui-switch-knob) {
  position: absolute;
  top: 50%;
  left: calc(0.1875 * var(--settings-layout-unit));
  transform: translateY(-50%);
  width: calc(1.25 * var(--settings-layout-unit));
  height: calc(1.25 * var(--settings-layout-unit));
  border-radius: 50%;
  background: var(--toggle-knob);
  transition:
    left var(--duration-base) var(--ease-brand),
    background var(--duration-base);
}

:deep(.ui-switch-track.on .ui-switch-knob) {
  left: calc(100% - 1.25 * var(--settings-layout-unit) - 0.1875 * var(--settings-layout-unit));
  background: var(--toggle-on-knob);
}

:deep(.volume-slider) {
  display: flex;
  align-items: center;
  gap: calc(0.75 * var(--settings-layout-unit));
}

:deep(.volume-icon) {
  width: calc(1.375 * var(--settings-layout-unit));
  height: calc(1.375 * var(--settings-layout-unit));
  flex-shrink: 0;
  color: var(--color-accent);
  transition: color 0.2s;
}

:deep(.volume-icon.muted) {
  color: var(--color-text-dim);
}

:deep(.volume-icon .mute-x) {
  stroke: var(--color-text-dim);
}

/* Range Slider */
:deep(.slider) {
  width: calc(6.875 * var(--settings-layout-unit));
  height: calc(0.375 * var(--settings-layout-unit));
  border-radius: calc(0.1875 * var(--settings-layout-unit));
  -webkit-appearance: none;
  appearance: none;
}

:deep(.slider::-webkit-slider-track) {
  width: 100%;
  height: calc(0.375 * var(--settings-layout-unit));
  border-radius: calc(0.1875 * var(--settings-layout-unit));
  background: transparent;
}

:deep(.slider::-moz-range-track) {
  width: 100%;
  height: calc(0.375 * var(--settings-layout-unit));
  border-radius: calc(0.1875 * var(--settings-layout-unit));
  background: transparent;
}

:deep(.slider::-webkit-slider-thumb) {
  -webkit-appearance: none;
  appearance: none;
  width: calc(1.25 * var(--settings-layout-unit));
  height: calc(1.25 * var(--settings-layout-unit));
  border-radius: 50%;
  background: var(--slider-thumb);
  box-shadow: var(--slider-thumb-shadow);
  cursor: pointer;
  transition: transform 0.2s;
}

:deep(.slider::-moz-range-thumb) {
  width: calc(1.25 * var(--settings-layout-unit));
  height: calc(1.25 * var(--settings-layout-unit));
  border-radius: 50%;
  background: var(--slider-thumb);
  box-shadow: var(--slider-thumb-shadow);
  border: none;
  cursor: pointer;
  transition: transform 0.2s;
}

:deep(.slider::-webkit-slider-thumb:hover) {
  transform: scale(1.2);
}

:deep(.slider::-moz-range-thumb:hover) {
  transform: scale(1.2);
}

:deep(.slider:active::-webkit-slider-thumb) {
  transform: scale(1.1);
}

:deep(.slider:active::-moz-range-thumb) {
  transform: scale(1.1);
}

/* Debug Section（Task 29-4） */
:deep(.debug-section-title) {
  color: var(--color-accent);
}

:deep(.debug-row) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(0.625 * var(--settings-layout-unit));
  /* 行高を統一しつつ詰める（gap 8px と合わせた実効間隔を確保） */
  min-height: max(32px, calc(2.25 * var(--settings-layout-unit)));
}

:deep(.debug-input) {
  width: calc(3.5 * var(--settings-layout-unit));
  height: calc(1.875 * var(--settings-layout-unit));
  padding: 0 calc(0.5 * var(--settings-layout-unit));
  font-size: calc(0.875 * var(--settings-font-unit));
  color: var(--color-text-main);
  background: var(--input-bg);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  text-align: right;
}

:deep(.debug-input:disabled) {
  opacity: 0.45;
}

:deep(.debug-reset-button) {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--settings-control-height);
  padding: 0 var(--settings-layout-unit);
  line-height: 1;
  font-size: calc(0.875 * var(--settings-font-unit));
  font-weight: 700;
  color: var(--color-text-main);
  background: var(--input-bg);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color 0.2s;
}

:deep(.debug-reset-button:hover) {
  border-color: var(--color-accent);
}

/* Privacy Text */
.privacy-text {
  font-size: calc(0.875 * var(--settings-font-unit));
  color: var(--color-text-dim);
  line-height: 1.55;
}

.privacy-text p {
  margin: 0 0 calc(0.5 * var(--settings-layout-unit)) 0;
}

.privacy-list {
  margin: 0;
  padding-left: calc(0.25 * var(--settings-layout-unit));
  list-style: none;
}

.privacy-list li {
  margin-bottom: calc(0.125 * var(--settings-layout-unit));
  position: relative;
  padding-left: calc(0.75 * var(--settings-layout-unit));
}

.privacy-list li::before {
  content: '-';
  position: absolute;
  left: 0;
}

/* Primary Button */
.primary-button {
  padding: calc(0.625 * var(--settings-layout-unit)) calc(1.5 * var(--settings-layout-unit));
  min-height: var(--settings-control-height);
  background-color: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  border: none;
  box-shadow: var(--btn-primary-shadow);
  border-radius: var(--radius-md);
  font-size: var(--settings-font-unit);
  font-weight: 800;
  cursor: pointer;
  transition: background 0.2s;
  align-self: center;
  min-width: calc(7.5 * var(--settings-layout-unit));
}

.primary-button:hover {
  background-color: var(--btn-primary-bg-hover);
}

/* Modal Transition */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
