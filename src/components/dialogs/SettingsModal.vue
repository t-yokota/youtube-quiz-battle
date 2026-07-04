<script setup lang="ts">
// SettingsModal コンポーネント
// 設定画面のモーダル表示

import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDebugStore } from '@/stores/debugStore'
import {
  DEBUG_ANSWER_TIME_LIMIT_MIN,
  DEBUG_ANSWER_TIME_LIMIT_MAX,
  DEBUG_MAX_ATTEMPTS_MIN,
  DEBUG_MAX_ATTEMPTS_MAX,
} from '@/constants/debug'

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
const debugStore = useDebugStore()

// デバッグモード対応データかどうか（クイズデータの settings.debug）
const isDebugData = computed(() => gameStore.quizData?.settings.debug === true)

// デバッグセクションの表示条件（Task 29-4）
const isDebugSectionVisible = computed(() => isDebugData.value && debugStore.isMenuVisible)

const handleDebugMenuToggle = () => {
  debugStore.setMenuVisible(!debugStore.isMenuVisible)
}

// 上書きコントロールは常に実効値（上書き > データ値）を表示する。
// 変更で上書き設定、リセットでデータ値表示に戻る。
// 数値は確定（change = blur/Enter）時のみ反映し、タイピング途中に clamp で丸めない
const effectiveAnswerTimeLimit = computed(
  () => debugStore.answerTimeLimitOverride ?? gameStore.quizData?.settings.answerTimeLimit ?? null,
)
const effectiveMaxAttempts = computed(
  () => debugStore.maxAttemptsOverride ?? gameStore.quizData?.settings.maxAttempts ?? null,
)

const handleAnswerTimeLimitOverrideChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  // 空欄で確定した場合は上書き解除（データ値表示に戻す）
  debugStore.setAnswerTimeLimitOverride(input.value === '' ? null : input.valueAsNumber)
  input.value = effectiveAnswerTimeLimit.value?.toString() ?? ''
}

const handleMaxAttemptsOverrideChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  debugStore.setMaxAttemptsOverride(input.value === '' ? null : input.valueAsNumber)
  input.value = effectiveMaxAttempts.value?.toString() ?? ''
}

// boolean 上書き: トグルスイッチ（クイズ画面右下と同型）。表示は実効値、タップで上書き設定
const effectiveJumpToRevealPeriod = computed(
  () =>
    debugStore.jumpToRevealPeriodOverride ??
    gameStore.quizData?.settings.jumpToRevealPeriod ??
    false,
)
const effectiveHideVideoPlayerDuringAnswer = computed(
  () =>
    debugStore.hideVideoPlayerDuringAnswerOverride ??
    gameStore.quizData?.settings.hideVideoPlayerDuringAnswer ??
    false,
)

const handleJumpToRevealPeriodOverrideToggle = () => {
  debugStore.setJumpToRevealPeriodOverride(!effectiveJumpToRevealPeriod.value)
}

const handleHideVideoPlayerDuringAnswerOverrideToggle = () => {
  debugStore.setHideVideoPlayerDuringAnswerOverride(!effectiveHideVideoPlayerDuringAnswer.value)
}

const handleResetOverrides = () => {
  debugStore.resetOverrides()
}

// シーク許可の実効値（ユーザー上書き > クイズデータの設定。Task 19-3）
const isSeekAllowed = computed(
  () =>
    !(settingsStore.disableSeekbarOverride ?? gameStore.quizData?.settings.disableSeekbar ?? true),
)

// トグル操作でユーザー上書きを設定（許可 = disableSeekbar false）
const handleSeekToggle = () => {
  settingsStore.setDisableSeekbarOverride(isSeekAllowed.value)
}

const handleButtonCheckToggle = () => {
  settingsStore.setButtonCheckEnabled(!gameStore.isButtonCheckEnabled)
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
              <div class="setting-row">
                <span class="setting-label">効果音の音量を調整する</span>
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
              <p class="seek-description">早押しボタンと正誤判定の効果音に適用されます。</p>
            </section>

            <!-- Seek Settings -->
            <section class="settings-section">
              <div class="setting-row">
                <span class="setting-label">シークバーでの動画移動を許可する</span>
                <button
                  type="button"
                  class="ui-switch"
                  role="switch"
                  :aria-checked="isSeekAllowed"
                  aria-label="シークバーでの動画移動を許可する"
                  @click="handleSeekToggle"
                >
                  <span class="ui-switch-track" :class="{ on: isSeekAllowed }">
                    <span class="ui-switch-state">{{ isSeekAllowed ? 'ON' : 'OFF' }}</span>
                    <span class="ui-switch-knob"></span>
                  </span>
                </button>
              </div>
              <p class="seek-description">
                許可すると、シークで飛ばした問題は不参加（スキップ）扱いになります。
              </p>
            </section>

            <!-- Button Check Settings -->
            <section class="settings-section">
              <div class="setting-row">
                <span class="setting-label">ゲーム開始前のボタンチェック演出を行う</span>
                <button
                  type="button"
                  class="ui-switch"
                  role="switch"
                  :aria-checked="gameStore.isButtonCheckEnabled"
                  aria-label="ゲーム開始前のボタンチェック演出を行う"
                  @click="handleButtonCheckToggle"
                >
                  <span class="ui-switch-track" :class="{ on: gameStore.isButtonCheckEnabled }">
                    <span class="ui-switch-state">{{
                      gameStore.isButtonCheckEnabled ? 'ON' : 'OFF'
                    }}</span>
                    <span class="ui-switch-knob"></span>
                  </span>
                </button>
              </div>
              <p class="seek-description">
                OFF にすると、開始ボタンは効果音なしの再生ボタンとして動作します。
              </p>
            </section>

            <!-- Debug Settings（Task 29: debug データかつメニュー表示ONの時のみ） -->
            <section v-if="isDebugSectionVisible" class="settings-section">
              <h3 class="section-title debug-section-title">デバッグ</h3>
              <p class="seek-description">クイズ設定を一時的に上書きします（リロードで解除）</p>

              <div class="debug-row">
                <span class="seek-label">解答制限時間（秒）</span>
                <input
                  type="number"
                  class="debug-input"
                  :min="DEBUG_ANSWER_TIME_LIMIT_MIN"
                  :max="DEBUG_ANSWER_TIME_LIMIT_MAX"
                  :value="effectiveAnswerTimeLimit ?? ''"
                  @change="handleAnswerTimeLimitOverrideChange"
                />
              </div>

              <div class="debug-row">
                <span class="seek-label">解答回数</span>
                <input
                  type="number"
                  class="debug-input"
                  :min="DEBUG_MAX_ATTEMPTS_MIN"
                  :max="DEBUG_MAX_ATTEMPTS_MAX"
                  :value="effectiveMaxAttempts ?? ''"
                  @change="handleMaxAttemptsOverrideChange"
                />
              </div>

              <div class="debug-row">
                <span class="seek-label">正解発表ジャンプ</span>
                <button
                  type="button"
                  class="debug-toggle"
                  role="switch"
                  :aria-checked="effectiveJumpToRevealPeriod"
                  aria-label="正解発表ジャンプ"
                  @click="handleJumpToRevealPeriodOverrideToggle"
                >
                  <span class="debug-toggle-track" :class="{ on: effectiveJumpToRevealPeriod }">
                    <span class="debug-toggle-state">{{
                      effectiveJumpToRevealPeriod ? 'ON' : 'OFF'
                    }}</span>
                    <span class="debug-toggle-knob"></span>
                  </span>
                </button>
              </div>

              <div class="debug-row">
                <span class="seek-label">解答中の動画非表示</span>
                <button
                  type="button"
                  class="debug-toggle"
                  role="switch"
                  :aria-checked="effectiveHideVideoPlayerDuringAnswer"
                  aria-label="解答中の動画非表示"
                  @click="handleHideVideoPlayerDuringAnswerOverrideToggle"
                >
                  <span
                    class="debug-toggle-track"
                    :class="{ on: effectiveHideVideoPlayerDuringAnswer }"
                  >
                    <span class="debug-toggle-state">{{
                      effectiveHideVideoPlayerDuringAnswer ? 'ON' : 'OFF'
                    }}</span>
                    <span class="debug-toggle-knob"></span>
                  </span>
                </button>
              </div>

              <button type="button" class="debug-reset-button" @click="handleResetOverrides">
                すべてリセット
              </button>
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

/* Debug Menu Toggle（ヘッダー左・× ボタンの反対側。Task 29-4） */
.debug-menu-toggle {
  position: absolute;
  left: 8px;
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

/* タッチデバイスの :hover 残留で --active の色が隠れないよう、ホバー可能環境に限定 */
@media (hover: hover) {
  .debug-menu-toggle:hover {
    color: var(--color-text-main);
  }
}

.debug-menu-toggle--active,
.debug-menu-toggle--active:hover {
  color: var(--color-gold-400);
}

.debug-menu-icon {
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

/* 設定行（1段目: 見出しを兼ねるラベル + 右揃えの操作 UI） */
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 44px;
}

.setting-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-main);
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

/* トグルスイッチ（ゲーム画面のボタンチェックトグルと同型・青系） */
.ui-switch {
  display: flex;
  align-items: center;
  min-height: 44px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.ui-switch-track {
  position: relative;
  width: 56px;
  height: 26px;
  border-radius: 999px;
  background: var(--color-stage-700);
  border: 1px solid var(--color-line);
  flex-shrink: 0;
  transition:
    background var(--duration-base),
    border-color var(--duration-base);
}

.ui-switch-track.on {
  background: rgba(79, 140, 255, 0.22);
  border-color: var(--color-info-400);
}

.ui-switch-state {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  font-size: 10px;
  line-height: 1;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--color-text-dim);
  /* OFF: ノブが左なので文言は右側 */
  right: 7px;
}

.ui-switch-track.on .ui-switch-state {
  color: var(--color-info-400);
  /* ON: ノブが右なので文言は左側 */
  right: auto;
  left: 7px;
}

.ui-switch-knob {
  position: absolute;
  top: 50%;
  left: 3px;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-text-dim);
  transition:
    left var(--duration-base) var(--ease-brand),
    background var(--duration-base);
}

.ui-switch-track.on .ui-switch-knob {
  left: calc(100% - 20px - 3px);
  background: var(--color-info-400);
}

.volume-slider {
  display: flex;
  align-items: center;
  gap: 12px;
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
  width: 110px;
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

/* Debug Section（Task 29-4） */
.debug-section-title {
  color: var(--color-gold-400);
}

.debug-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  /* 行高を統一（数値入力 30px / トグル 44px の差で間隔がばらつかないように） */
  min-height: 44px;
}

.debug-input {
  width: 56px;
  height: 30px;
  padding: 0 8px;
  font-size: 14px;
  color: var(--color-text-main);
  background: var(--color-stage-900);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  text-align: right;
}

.debug-input:disabled {
  opacity: 0.45;
}

/* トグルスイッチ（クイズ画面右下の BUTTON CHECK トグルと同型・px 版） */
.debug-toggle {
  display: flex;
  align-items: center;
  min-height: 44px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.debug-toggle-track {
  position: relative;
  width: 56px;
  height: 26px;
  border-radius: 999px;
  background: var(--color-stage-700);
  border: 1px solid var(--color-line);
  transition:
    background var(--duration-base),
    border-color var(--duration-base);
}

.debug-toggle-track.on {
  background: rgba(255, 197, 61, 0.22);
  border-color: var(--color-gold-400);
}

.debug-toggle-state {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  font-size: 10px;
  line-height: 1;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--color-text-dim);
  /* OFF: ノブが左なので文言は右側 */
  right: 7px;
}

.debug-toggle-track.on .debug-toggle-state {
  color: var(--color-gold-400);
  /* ON: ノブが右なので文言は左側 */
  right: auto;
  left: 7px;
}

.debug-toggle-knob {
  position: absolute;
  top: 50%;
  left: 3px;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-text-dim);
  transition:
    left var(--duration-base) var(--ease-brand),
    background var(--duration-base);
}

.debug-toggle-track.on .debug-toggle-knob {
  left: calc(100% - 20px - 3px);
  background: var(--color-gold-400);
}

.debug-reset-button {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 16px;
  line-height: 1;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-main);
  background: var(--color-stage-900);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color 0.2s;
}

.debug-reset-button:hover {
  border-color: var(--color-gold-400);
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
