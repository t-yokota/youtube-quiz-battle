<script setup lang="ts">
// SettingsModal コンポーネント
// 設定画面のモーダル表示

import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useSettingsStore } from '@/stores/settingsStore'

// Props定義（Phase 2で状態管理と連携予定）
interface Props {
  isOpen?: boolean
  volumeLevel?: number // 0: Mute, 1-4: 音量レベル
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
  volumeLevel: 3,
})

const gameStore = useGameStore()
const settingsStore = useSettingsStore()

// シーク許可の実効値（ユーザー上書き > クイズデータの設定。Task 19-3）
const isSeekAllowed = computed(
  () =>
    !(settingsStore.disableSeekbarOverride ?? gameStore.quizData?.settings.disableSeekbar ?? true),
)

const handleSeekToggle = (event: Event) => {
  const target = event.target as HTMLInputElement
  // トグル操作でユーザー上書きを設定（checked = シーク許可 = disableSeekbar false）
  settingsStore.setDisableSeekbarOverride(!target.checked)
}

const handleButtonCheckToggle = (event: Event) => {
  const target = event.target as HTMLInputElement
  settingsStore.setButtonCheckEnabled(target.checked)
}

// イベント定義
const emit = defineEmits<{
  close: []
  updateVolume: [level: number]
}>()

const handleClose = () => {
  emit('close')
}

const handleVolumeChange = (level: number) => {
  emit('updateVolume', level)
}

// オーバーレイクリックで閉じる
const handleOverlayClick = (event: MouseEvent) => {
  if (event.target === event.currentTarget) {
    handleClose()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isOpen" class="modal-overlay" @click="handleOverlayClick">
        <div class="modal-container">
          <!-- Modal Header -->
          <div class="modal-header">
            <h2 class="modal-title">設定</h2>
            <button class="close-button" aria-label="設定を閉じる" @click="handleClose">
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
            <!-- Audio Settings -->
            <section class="settings-section">
              <h3 class="section-title">効果音設定</h3>

              <!-- Volume Slider -->
              <div class="volume-control">
                <span class="volume-description"
                  >早押しボタンと正誤判定音の音量を調整できます。</span
                >
                <div class="volume-slider">
                  <!-- Volume Icon SVG -->
                  <svg
                    :class="['volume-icon', { muted: volumeLevel === 0 }]"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <!-- Speaker Base -->
                    <path
                      d="M11 5L6 9H2v6h4l5 4V5z"
                      fill="currentColor"
                      stroke="currentColor"
                      stroke-width="1"
                      stroke-linejoin="round"
                    />

                    <!-- Mute X (volumeLevel === 0) -->
                    <path
                      v-if="volumeLevel === 0"
                      class="mute-x"
                      d="M23 9l-6 6m0-6l6 6"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />

                    <!-- Sound Wave 1 (volumeLevel >= 1) -->
                    <path
                      v-if="volumeLevel >= 1"
                      d="M14 10a3 3 0 010 4"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />

                    <!-- Sound Wave 2 (volumeLevel >= 2) -->
                    <path
                      v-if="volumeLevel >= 2"
                      d="M16 8a6 6 0 010 8"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />

                    <!-- Sound Wave 3 (volumeLevel >= 3) -->
                    <path
                      v-if="volumeLevel >= 3"
                      d="M18 6a9 9 0 010 12"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />

                    <!-- Sound Wave 4 (volumeLevel === 4) -->
                    <path
                      v-if="volumeLevel === 4"
                      d="M20 4a12 12 0 010 16"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                  </svg>

                  <input
                    type="range"
                    min="0"
                    max="4"
                    :value="volumeLevel"
                    :style="{
                      background: `linear-gradient(to right, var(--color-info-400) 0%, var(--color-info-400) ${(volumeLevel / 4) * 100}%, var(--color-stage-700) ${(volumeLevel / 4) * 100}%, var(--color-stage-700) 100%)`,
                    }"
                    class="slider"
                    @input="handleVolumeChange(($event.target as HTMLInputElement).valueAsNumber)"
                  />
                </div>
              </div>
            </section>

            <!-- Button Check Settings -->
            <section class="settings-section">
              <h3 class="section-title">ボタンチェック演出</h3>
              <div class="seek-control">
                <label class="seek-toggle">
                  <input
                    type="checkbox"
                    class="seek-checkbox"
                    :checked="settingsStore.buttonCheckEnabled"
                    @change="handleButtonCheckToggle"
                  />
                  <span class="seek-label">ゲーム開始前のボタンチェック演出を行う</span>
                </label>
                <p class="seek-description">
                  OFF にすると、開始ボタンは効果音なしの再生ボタンとして動作します。
                </p>
              </div>
            </section>

            <!-- Seek Settings -->
            <section class="settings-section">
              <h3 class="section-title">シーク操作</h3>
              <div class="seek-control">
                <label class="seek-toggle">
                  <input
                    type="checkbox"
                    class="seek-checkbox"
                    :checked="isSeekAllowed"
                    @change="handleSeekToggle"
                  />
                  <span class="seek-label">シークバーでの動画移動を許可する</span>
                </label>
                <p class="seek-description">
                  許可すると、シークで飛ばした問題は不参加（スキップ）扱いになります。
                </p>
              </div>
            </section>

            <!-- Privacy Info -->
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
  z-index: 1000;
  /* コンテンツが長いときも上下に十分な余白を残す */
  padding: 32px 16px;
}

/* Modal Container */
.modal-container {
  background-color: var(--color-stage-800);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  max-width: 440px;
  width: 100%;
  max-height: calc(100dvh - 64px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
}

/* Modal Header */
.modal-header {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-line);
}

.modal-title {
  margin: 0;
  font-size: 20px;
  font-weight: bold;
  color: var(--color-text-main);
}

.close-button {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  /* タッチターゲット確保 */
  width: 44px;
  height: 44px;
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
  width: 20px;
  height: 20px;
}

/* Modal Content */
.modal-content {
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* Settings Section（セクション間に罫線） */
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-section + .settings-section {
  border-top: 1px solid var(--color-line);
  padding-top: 16px;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-main);
}

/* Volume Control */
.volume-control {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Seek Control（Task 19-3） */
.seek-control {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.seek-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  /* タッチターゲット確保 */
  min-height: 44px;
}

.seek-checkbox {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  accent-color: var(--color-info-400);
  cursor: pointer;
}

.seek-label {
  font-size: 14px;
  color: var(--color-text-main);
  font-weight: 500;
}

.seek-description {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-dim);
}

.volume-description {
  font-size: 14px;
  color: var(--color-text-dim);
  font-weight: 500;
}

.volume-slider {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 4px;
}

.volume-icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  color: var(--color-info-400);
  transition: color 0.2s;
}

.volume-icon.muted {
  color: var(--color-text-dim);
}

.volume-icon .mute-x {
  stroke: var(--color-signal-500);
}

/* Range Slider */
.slider {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.slider::-webkit-slider-track {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: transparent;
}

.slider::-moz-range-track {
  width: 100%;
  height: 0.375rem;
  border-radius: 0.1875rem;
  background: transparent;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-info-400);
  cursor: pointer;
  transition: transform 0.2s;
}

.slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-info-400);
  border: none;
  cursor: pointer;
  transition: transform 0.2s;
}

.slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.slider::-moz-range-thumb:hover {
  transform: scale(1.2);
}

.slider:active::-webkit-slider-thumb {
  transform: scale(1.1);
}

.slider:active::-moz-range-thumb {
  transform: scale(1.1);
}

/* Privacy Text */
.privacy-text {
  font-size: 14px;
  color: var(--color-text-dim);
  line-height: 1.55;
}

.privacy-text p {
  margin: 0 0 8px 0;
}

.privacy-list {
  margin: 0;
  padding-left: 4px;
  list-style: none;
}

.privacy-list li {
  margin-bottom: 2px;
  position: relative;
  padding-left: 12px;
}

.privacy-list li::before {
  content: '-';
  position: absolute;
  left: 0;
}

/* Primary Button */
.primary-button {
  padding: 10px 24px;
  min-height: 44px;
  background-color: var(--color-gold-400);
  color: var(--color-stage-900);
  border: none;
  border-radius: var(--radius-md);
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.2s;
  align-self: center;
  min-width: 120px;
}

.primary-button:hover {
  background-color: #ffd566;
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

/* 固定 px のため画面幅による追加縮小は不要 */
</style>
