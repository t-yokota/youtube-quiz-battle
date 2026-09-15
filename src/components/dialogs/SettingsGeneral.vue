<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useSettingsStore } from '@/stores/settingsStore'
defineProps<{ volumeLevel: number }>()
const emit = defineEmits<{ updateVolume: [level: number]; openThemeSwitcher: [] }>()
const gameStore = useGameStore()
const settingsStore = useSettingsStore()
function changeMode(event: Event) {
  settingsStore.setButtonMode((event.target as HTMLSelectElement).value)
}
function changeModel(event: Event) {
  settingsStore.setButtonModel((event.target as HTMLSelectElement).value)
}
function handleVolumeChange(level: number) {
  emit('updateVolume', level)
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
</script>
<template>
  <!-- Audio Settings -->
  <section class="settings-section">
    <div class="setting-row">
      <span class="setting-label">効果音の音量</span>
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
          aria-label="効果音の音量"
          min="0"
          max="4"
          :value="volumeLevel"
          :style="{
            background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${(volumeLevel / 4) * 100}%, var(--slider-track) ${(volumeLevel / 4) * 100}%, var(--slider-track) 100%)`,
          }"
          class="slider"
          @input="handleVolumeChange(($event.target as HTMLInputElement).valueAsNumber)"
        />
      </div>
    </div>
    <p class="seek-description">早押しボタンと正誤判定の効果音に適用されます</p>
  </section>

  <!-- Seek Settings -->
  <section class="settings-section">
    <div class="setting-row">
      <span class="setting-label">シークバーの操作を許可する</span>
      <button
        type="button"
        class="ui-switch"
        role="switch"
        :aria-checked="isSeekAllowed"
        aria-label="シークバーの操作を許可する"
        @click="handleSeekToggle"
      >
        <span class="ui-switch-track" :class="{ on: isSeekAllowed }">
          <span class="ui-switch-knob"></span>
        </span>
      </button>
    </div>
    <p class="seek-description">シークで飛ばした問題はスキップ扱いになります</p>
  </section>

  <!-- Button Check Settings -->
  <section class="settings-section">
    <div class="setting-row">
      <span class="setting-label">ボタンチェック演出を行う</span>
      <button
        type="button"
        class="ui-switch"
        role="switch"
        :aria-checked="gameStore.isButtonCheckEnabled"
        aria-label="ボタンチェック演出を行う"
        @click="handleButtonCheckToggle"
      >
        <span class="ui-switch-track" :class="{ on: gameStore.isButtonCheckEnabled }">
          <span class="ui-switch-knob"></span>
        </span>
      </button>
    </div>
    <p class="seek-description">動画再生の前にボタンチェックの演出を行います</p>
  </section>

  <section class="settings-section">
    <div class="setting-row">
      <label for="button-mode" class="setting-label">ボタンの表示方式</label>
      <span class="settings-select-wrap">
        <span class="settings-select-size" aria-hidden="true">{{
          settingsStore.button.renderMode.toUpperCase()
        }}</span>
        <select
          class="settings-select"
          id="button-mode"
          :value="settingsStore.button.renderMode"
          @change="changeMode"
        >
          <option value="2d">2D</option>
          <option value="3d">3D</option>
        </select>
      </span>
    </div>
    <div v-if="settingsStore.button.renderMode === '3d'" class="setting-row button-model-row">
      <label for="button-model" class="setting-label">ボタンタイプ</label>
      <span class="settings-select-wrap">
        <span class="settings-select-size" aria-hidden="true">{{
          settingsStore.button.modelId === 'simple-round-v1' ? '丸型' : '箱型（大ランプ）'
        }}</span>
        <select
          class="settings-select"
          id="button-model"
          :value="settingsStore.button.modelId"
          @change="changeModel"
        >
          <option value="simple-round-v1">丸型</option>
          <option value="waseda-style-v1">箱型（大ランプ）</option>
        </select>
      </span>
    </div>
    <p class="seek-description">早押しボタンの見た目を切り替えます</p>
  </section>

  <!-- UI Theme -->
  <section class="settings-section">
    <div class="setting-row">
      <span class="setting-label">UIテーマ</span>
      <button type="button" class="theme-button" @click="emit('openThemeSwitcher')">えらぶ</button>
    </div>
    <p class="seek-description">アプリ全体の見た目を切り替えます</p>
  </section>
</template>

<style scoped>
.settings-select-wrap {
  position: relative;
  max-width: 55%;
  min-width: 0;
  font-size: var(--settings-font-unit);
  font-weight: 700;
  line-height: 1.4;
}
.settings-select-size {
  display: block;
  visibility: hidden;
  white-space: nowrap;
  overflow: hidden;
  min-height: var(--settings-control-height);
  padding: calc(0.375 * var(--settings-layout-unit)) calc(2 * var(--settings-layout-unit))
    calc(0.375 * var(--settings-layout-unit)) calc(0.625 * var(--settings-layout-unit));
  border: 1px solid transparent;
}
select {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: var(--settings-control-height);
  padding: calc(0.375 * var(--settings-layout-unit)) calc(0.625 * var(--settings-layout-unit));
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-md);
  background: var(--input-bg);
  color: var(--color-text-main);
  font-family: inherit;
  font-size: var(--settings-font-unit);
  font-weight: 700;
  line-height: 1.4;
  cursor: pointer;
}
select:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
option {
  color: var(--color-text-main);
  background: var(--input-bg);
}
</style>
