<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useSettingsStore } from '@/stores/settingsStore'
defineProps<{ volumeLevel: number }>()
const emit = defineEmits<{ updateVolume: [level: number]; openThemeSwitcher: [] }>()
const gameStore = useGameStore()
const settingsStore = useSettingsStore()
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
    <p class="seek-description">早押しボタンと正誤判定の効果音に適用されます。</p>
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
    <p class="seek-description">
      許可すると、シークで飛ばした問題は不参加（スキップ）扱いになります。
    </p>
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
    <p class="seek-description">
      クイズを始める（動画の再生を開始する）前にボタンチェックの演出を行います。
    </p>
  </section>

  <!-- UI Theme -->
  <section class="settings-section">
    <div class="setting-row">
      <span class="setting-label">UIテーマ</span>
      <button type="button" class="theme-button" @click="emit('openThemeSwitcher')">えらぶ</button>
    </div>
    <p class="seek-description">アプリ全体の見た目を切り替えます。</p>
  </section>
</template>
