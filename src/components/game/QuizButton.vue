<script setup lang="ts">
// QuizButton コンポーネント
// 早押しボタン（物理ボタン: 真上視点の円形キャップ + 同心円台座 + LED リング）
import { computed, ref, watch } from 'vue'
import Button3DView from './button3d/Button3DView.vue'
import DimensionIcon from './DimensionIcon.vue'
import { ButtonState, GameState } from '@/types'
import { useGameStore } from '@/stores/gameStore'
import { useSettingsStore } from '@/stores/settingsStore'

interface Props {
  interactionBlocked?: boolean
  buttonState?: ButtonState
  buttonText?: string
}

const props = withDefaults(defineProps<Props>(), {
  interactionBlocked: false,
  buttonState: ButtonState.STANDBY,
  buttonText: undefined,
})

const gameStore = useGameStore()
const settingsStore = useSettingsStore()
const threeReady = ref(false)
const threeFailed = ref(false)
const useThree = computed(() => settingsStore.button.renderMode === '3d' && !threeFailed.value)
watch(
  () => [settingsStore.button.renderMode, settingsStore.button.modelId],
  () => {
    threeFailed.value = false
    if (settingsStore.button.renderMode === '2d') threeReady.value = false
  },
)
function fallbackToTwo() {
  threeReady.value = false
  threeFailed.value = true
}

// イベント定義
const emit = defineEmits<{
  press: []
}>()

// ボタンチェック演出 OFF の READY: 単なる再生ボタンとして白い三角形を表示（Task 19-4）
const isPlayMode = computed(
  () =>
    props.buttonState === ButtonState.STANDBY &&
    gameStore.currentState === GameState.READY &&
    !gameStore.isButtonCheckEnabled,
)

// CSSクラス名用（standby / pushed / released / disabled）
const buttonStateClass = computed(() => props.buttonState.toLowerCase())

// ボタンチェック中（READY で押下〜点灯の間）は 2 行の BUTTON CHECK 表示
const isButtonChecking = computed(
  () =>
    gameStore.currentState === GameState.READY &&
    (props.buttonState === ButtonState.PUSHED || props.buttonState === ButtonState.RELEASED),
)

// ボタンラベル（wireframe: PUSH / ON! / WAIT）。props で明示指定があれば優先
const buttonLabel = computed(() => {
  if (props.buttonText !== undefined) return props.buttonText
  switch (props.buttonState) {
    case ButtonState.RELEASED:
      return 'ON!'
    case ButtonState.DISABLED:
      return 'WAIT'
    default:
      // STANDBY / PUSHED
      return 'PUSH'
  }
})

// スポットライト点灯: 押せる状態（READY / QUESTIONING の STANDBY）
const isLit = computed(
  () =>
    (gameStore.currentState === GameState.READY ||
      gameStore.currentState === GameState.QUESTIONING) &&
    props.buttonState === ButtonState.STANDBY,
)

// 外周パルスリング: 早押し可能区間（QUESTIONING）のみ
const isPulsing = computed(() => gameStore.currentState === GameState.QUESTIONING)

const handlePress = () => {
  if (
    !props.interactionBlocked &&
    props.buttonState !== ButtonState.DISABLED &&
    (!useThree.value || gameStore.isButtonEnabled)
  ) {
    emit('press')
  }
}

const displayModeLabel = computed(() =>
  useThree.value ? '現在3D表示。2Dに切り替え' : '現在2D表示。3Dに切り替え',
)
function toggleDisplayMode() {
  if (props.interactionBlocked) return
  const nextMode = useThree.value ? '2d' : '3d'
  threeFailed.value = false
  settingsStore.setButtonMode(nextMode)
}

// ボタンチェック演出のトグル（設定画面と同じ settingsStore を切り替える）
const handleButtonCheckToggle = () => {
  settingsStore.setButtonCheckEnabled(!gameStore.isButtonCheckEnabled)
}
</script>

<template>
  <section class="quiz-button-container" :class="{ lit: isLit }">
    <div class="button-stage">
      <Button3DView
        v-if="useThree"
        :button-state="buttonState"
        :enabled="gameStore.isButtonEnabled"
        :blocked="interactionBlocked"
        :model-id="settingsStore.button.modelId"
        :play-mode="isPlayMode"
        @press="handlePress"
        @ready="threeReady = true"
        @failed="fallbackToTwo"
      />
      <div v-show="!useThree || !threeReady" class="button-rig">
        <div class="pulse-ring" :class="{ active: isPulsing }"></div>
        <button
          :class="['quiz-button', buttonStateClass]"
          :disabled="buttonState === ButtonState.DISABLED"
          :aria-label="isPlayMode ? '動画を再生' : undefined"
          @click="handlePress"
        >
          <svg
            v-if="isPlayMode"
            key="play"
            class="play-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M8 5.5 L18.5 12 L8 18.5 Z" fill="#fff" />
          </svg>
          <span v-else-if="isButtonChecking" key="check" class="check-label"
            >BUTTON<br />CHECK</span
          >
          <span v-else key="label" class="button-label">{{ buttonLabel }}</span>
        </button>
      </div>
    </div>

    <button
      type="button"
      class="display-mode-toggle"
      :aria-label="displayModeLabel"
      :title="displayModeLabel"
      :disabled="interactionBlocked"
      @click.stop="toggleDisplayMode"
    >
      <DimensionIcon class="display-mode-artwork" :solid="useThree" />
    </button>
    <!-- ボタンチェック演出のトグル（画面右下） -->
    <button
      type="button"
      class="check-toggle"
      role="switch"
      :aria-checked="gameStore.isButtonCheckEnabled"
      aria-label="ボタンチェック演出"
      @click="handleButtonCheckToggle"
    >
      <span class="check-toggle-label">BUTTON CHECK</span>
      <span class="check-toggle-track" :class="{ on: gameStore.isButtonCheckEnabled }">
        <span class="check-toggle-state">{{ gameStore.isButtonCheckEnabled ? 'ON' : 'OFF' }}</span>
        <span class="check-toggle-knob"></span>
      </span>
    </button>
  </section>
</template>

<style scoped>
.display-mode-toggle {
  /* SVG内の輪郭中心(18, 46)に44pxの操作領域を合わせ、絵の位置は維持する。 */
  position: absolute;
  left: calc(-1 * var(--icon-hit-offset));
  bottom: calc(-1 * var(--icon-hit-offset));
  z-index: 1;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-dim);
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.display-mode-artwork {
  transform: translate(var(--icon-hit-offset), calc(-1 * var(--icon-hit-offset)));
}
.display-mode-toggle:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.display-mode-toggle:disabled {
  opacity: 0.5;
  cursor: default;
}
/* ボタンチェック演出のトグル */
.check-toggle {
  align-self: flex-end;
  --_check-toggle-unit: var(--ui-font-unit);
  --_check-toggle-knob-size: calc(0.9375 * var(--_check-toggle-unit));
  --_check-toggle-knob-inset: calc(0.125 * var(--_check-toggle-unit));
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: calc(0.4 * var(--_check-toggle-unit));
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.check-toggle-label {
  font-size: calc(0.625 * var(--ui-font-unit));
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--color-text-dim);
}

.check-toggle-track {
  position: relative;
  width: calc(2.75 * var(--_check-toggle-unit));
  height: calc(1.25 * var(--_check-toggle-unit));
  border-radius: 62.4375rem;
  background: var(--toggle-track);
  border: 1px solid var(--toggle-track-border);
  box-shadow: var(--toggle-track-shadow);
  transition:
    background var(--duration-base),
    border-color var(--duration-base),
    box-shadow var(--duration-base);
}

.check-toggle-track.on {
  background: var(--toggle-on-track);
  border-color: var(--toggle-on-border);
  box-shadow: var(--toggle-on-track-shadow, var(--toggle-track-shadow));
}

.check-toggle-state {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  font-size: calc(0.5 * var(--ui-font-unit));
  line-height: 1;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--color-text-dim);
  /* OFF: ノブが左なので文言は右側 */
  right: calc(0.3125 * var(--_check-toggle-unit));
}

.check-toggle-track.on .check-toggle-state {
  color: var(--color-accent);
  /* ON: ノブが右なので文言は左側 */
  right: auto;
  left: calc(0.3125 * var(--_check-toggle-unit));
}

.check-toggle-knob {
  position: absolute;
  top: 50%;
  left: var(--_check-toggle-knob-inset);
  transform: translateY(-50%);
  width: var(--_check-toggle-knob-size);
  height: var(--_check-toggle-knob-size);
  border-radius: 50%;
  background: var(--toggle-knob);
  transition:
    left var(--duration-base) var(--ease-brand),
    background var(--duration-base);
}

.check-toggle-track.on .check-toggle-knob {
  left: calc(100% - var(--_check-toggle-knob-size) - var(--_check-toggle-knob-inset));
  background: var(--toggle-on-knob);
}

/* ボタンチェック中の 2 行ラベル */
.check-label {
  display: block;
  font-size: calc(0.9375 * var(--ui-font-unit));
  line-height: 1.35;
  letter-spacing: 0.14em;
}

/* 再生ボタンモードの三角形（Task 19-4） */
.play-icon {
  width: calc(4.5 * var(--button-unit));
  height: calc(4.5 * var(--button-unit));
  display: block;
  margin: 0 auto;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
}

/* ボタンエリア（縦スタック: 中央のボタン領域 + 右下のトグル） */
.quiz-button-container {
  --icon-hit-offset: 9.625px;
  flex: 1;
  /* iPhone Safari（下部バー表示時）で 1 画面に収まる高さ。トグル行を含む */
  min-height: 9rem;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* ボタン本体の領域（残り空間の中央にボタンを置く） */
.button-stage {
  container-type: size;
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* スポットライト: 押せる状態のときだけ点灯 */
.quiz-button-container::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--spotlight-glow);
  opacity: 0;
  transition: opacity 400ms;
  pointer-events: none;
}

.quiz-button-container.lit::before {
  opacity: 1;
}

.button-rig {
  --button-unit: min(1rem, calc(100cqh / 12.25), calc(100cqw / 12.25));
  position: relative;
  display: grid;
  place-items: center;
}

/* 台座（真上から見た同心円のベースプレート） */
.button-rig::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(12.25 * var(--button-unit));
  height: calc(12.25 * var(--button-unit));
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: var(--pedestal-bg);
  border: var(--pedestal-border);
  box-shadow: var(--pedestal-shadow);
  z-index: 0;
}

/* QUESTIONING時のパルスリング */
.pulse-ring {
  position: absolute;
  width: calc(10 * var(--button-unit));
  height: calc(10 * var(--button-unit));
  border-radius: 50%;
  border: 2px solid var(--pulse-color);
  opacity: 0;
  z-index: 1;
  pointer-events: none;
}

.pulse-ring.active {
  animation: pulse-out 1.4s ease-out infinite;
}

@keyframes pulse-out {
  0% {
    transform: scale(0.95);
    opacity: 0.7;
  }
  100% {
    transform: scale(1.35);
    opacity: 0;
  }
}

/* 真上から見たドーム型キャップ。沈み込みは縮小＋影トークン＋減光で表現 */
.quiz-button {
  position: relative;
  z-index: 2;
  /* タップハイライト・長押し選択が物理ボタン演出を壊さないように（Task 22-2） */
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  -webkit-user-select: none;
  width: calc(9.375 * var(--button-unit));
  height: calc(9.375 * var(--button-unit));
  border-radius: 50%;
  border: none;
  cursor: pointer;
  font-size: calc(1.1875 * var(--ui-font-unit));
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--quiz-btn-text);
  text-shadow: var(--quiz-btn-text-shadow);
  background: var(--quiz-btn-face);
  box-shadow: var(--quiz-btn-shadow);
  transition:
    transform var(--duration-fast),
    box-shadow var(--duration-fast),
    filter var(--duration-base);
}

.quiz-button.standby:hover {
  filter: brightness(1.08);
}

.quiz-button.standby:active,
.quiz-button.pushed {
  transform: scale(0.93);
  filter: brightness(0.88);
  box-shadow: var(--quiz-btn-shadow-pressed);
}

/* RELEASED: LEDグロー点灯（解答権取得）。太い実線リングは付けずグローのみ */
.quiz-button.released {
  transform: scale(0.96);
  box-shadow: var(--quiz-btn-shadow-released);
  animation: led-breathe 1.2s ease-in-out infinite;
}

@keyframes led-breathe {
  0%,
  100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.15);
  }
}

/* DISABLED: 沈み込んだまま消灯（減光量はテーマのフィルタトークンに従う） */
.quiz-button.disabled,
.quiz-button:disabled {
  cursor: not-allowed;
  transform: scale(0.93);
  filter: var(--quiz-btn-disabled-filter);
  box-shadow: var(--quiz-btn-shadow-disabled);
  /* テーマが disabled 専用の面・文字色を持つ場合は差し替え（未定義なら通常値）。
     filter だけでは「素材に沈むフラットな無効表示」（ニューモーフィズム等）を
     表現できないため */
  background: var(--quiz-btn-face-disabled, var(--quiz-btn-face));
  color: var(--quiz-btn-text-disabled, var(--quiz-btn-text));
  text-shadow: var(--quiz-btn-text-shadow-disabled, var(--quiz-btn-text-shadow));
}
</style>
