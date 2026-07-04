<script setup lang="ts">
// QuizButton コンポーネント
// 早押しボタン（物理ボタン: 真上視点の円形キャップ + 同心円台座 + LED リング）
import { computed, ref, watch, onUnmounted } from 'vue'
import { ButtonState, GameState } from '@/types'
import { BUTTON_CHECK_LABEL_HOLD_MS } from '@/constants/timing'
import { useGameStore } from '@/stores/gameStore'
import { useSettingsStore } from '@/stores/settingsStore'

interface Props {
  buttonState?: ButtonState
  buttonText?: string
}

const props = withDefaults(defineProps<Props>(), {
  buttonState: ButtonState.STANDBY,
  buttonText: undefined,
})

const gameStore = useGameStore()
const settingsStore = useSettingsStore()

// イベント定義
const emit = defineEmits<{
  press: []
}>()

// ボタンチェック演出 OFF の READY: 単なる再生ボタンとして白い三角形を表示（Task 19-4）
const isPlayMode = computed(
  () => gameStore.currentState === GameState.READY && !settingsStore.buttonCheckEnabled,
)

// CSSクラス名用（standby / pushed / released / disabled）
const buttonStateClass = computed(() => props.buttonState.toLowerCase())

// ボタンチェック中（READY で押下〜点灯の間）は 2 行の BUTTON CHECK 表示
const isButtonChecking = computed(
  () =>
    gameStore.currentState === GameState.READY &&
    (props.buttonState === ButtonState.PUSHED || props.buttonState === ButtonState.RELEASED),
)

// チェック終了直後は正解音が鳴っている間の違和感を避けるため、
// WAIT 表示への切り替えを少し遅らせてラベルだけ保持する（表示層のみの遅延）
const holdCheckLabel = ref(false)
let holdTimer: number | null = null

watch(isButtonChecking, (now, was) => {
  if (was && !now && props.buttonState === ButtonState.DISABLED) {
    holdCheckLabel.value = true
    if (holdTimer !== null) window.clearTimeout(holdTimer)
    holdTimer = window.setTimeout(() => {
      holdCheckLabel.value = false
      holdTimer = null
    }, BUTTON_CHECK_LABEL_HOLD_MS)
  } else if (now) {
    // 再チェック開始時は保持状態をリセット
    holdCheckLabel.value = false
  }
})

onUnmounted(() => {
  if (holdTimer !== null) window.clearTimeout(holdTimer)
})

const showCheckLabel = computed(() => isButtonChecking.value || holdCheckLabel.value)

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
  if (props.buttonState !== ButtonState.DISABLED) {
    emit('press')
  }
}

// ボタンチェック演出のトグル（設定画面と同じ settingsStore を切り替える）
const handleButtonCheckToggle = () => {
  settingsStore.setButtonCheckEnabled(!settingsStore.buttonCheckEnabled)
}
</script>

<template>
  <section class="quiz-button-container" :class="{ lit: isLit }">
    <div class="button-stage">
      <div class="button-rig">
        <div class="pulse-ring" :class="{ active: isPulsing }"></div>
        <button
          :class="['quiz-button', buttonStateClass]"
          :disabled="buttonState === ButtonState.DISABLED"
          :aria-label="isPlayMode ? '動画を再生' : undefined"
          @click="handlePress"
        >
          <svg v-if="isPlayMode" class="play-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.5 L18.5 12 L8 18.5 Z" fill="#fff" />
          </svg>
          <span v-else-if="showCheckLabel" class="check-label">BUTTON<br />CHECK</span>
          <template v-else>{{ buttonLabel }}</template>
        </button>
      </div>
    </div>

    <!-- ボタンチェック演出のトグル（画面右下） -->
    <button
      type="button"
      class="check-toggle"
      role="switch"
      :aria-checked="settingsStore.buttonCheckEnabled"
      aria-label="ボタンチェック演出"
      @click="handleButtonCheckToggle"
    >
      <span class="check-toggle-label">BUTTON CHECK</span>
      <span class="check-toggle-track" :class="{ on: settingsStore.buttonCheckEnabled }">
        <span class="check-toggle-state">{{
          settingsStore.buttonCheckEnabled ? 'ON' : 'OFF'
        }}</span>
        <span class="check-toggle-knob"></span>
      </span>
    </button>
  </section>
</template>

<style scoped>
/* ボタンチェック演出のトグル（フロー配置・右寄せ。ボタンはこの上の残り空間で中央配置される） */
.check-toggle {
  align-self: flex-end;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.check-toggle-label {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--color-text-dim);
}

.check-toggle-track {
  position: relative;
  width: 2.875rem;
  height: 1.25rem;
  border-radius: 62.4375rem;
  background: var(--color-stage-700);
  border: 1px solid var(--color-line);
  transition:
    background var(--duration-base),
    border-color var(--duration-base);
}

.check-toggle-track.on {
  background: rgba(255, 197, 61, 0.22);
  border-color: var(--color-gold-400);
}

.check-toggle-state {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  font-size: 0.5rem;
  line-height: 1;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--color-text-dim);
  /* OFF: ノブが左なので文言は右側 */
  right: 0.3125rem;
}

.check-toggle-track.on .check-toggle-state {
  color: var(--color-gold-400);
  /* ON: ノブが右なので文言は左側 */
  right: auto;
  left: 0.3125rem;
}

.check-toggle-knob {
  position: absolute;
  top: 50%;
  left: 0.125rem;
  transform: translateY(-50%);
  width: 0.9375rem;
  height: 0.9375rem;
  border-radius: 50%;
  background: var(--color-text-dim);
  transition:
    left var(--duration-base) var(--ease-brand),
    background var(--duration-base);
}

.check-toggle-track.on .check-toggle-knob {
  left: calc(100% - 0.9375rem - 0.125rem);
  background: var(--color-gold-400);
}

/* ボタンチェック中の 2 行ラベル */
.check-label {
  display: block;
  font-size: 0.9375rem;
  line-height: 1.35;
  letter-spacing: 0.14em;
}

/* 再生ボタンモードの三角形（Task 19-4） */
.play-icon {
  width: 4.5rem;
  height: 4.5rem;
  display: block;
  margin: 0 auto;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
}

/* ボタンエリア（縦スタック: 中央のボタン領域 + 右下のトグル） */
.quiz-button-container {
  flex: 1;
  min-height: 15rem;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* ボタン本体の領域（残り空間の中央にボタンを置く） */
.button-stage {
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
  background: radial-gradient(60% 55% at 50% 58%, rgba(255, 197, 61, 0.14) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 400ms;
  pointer-events: none;
}

.quiz-button-container.lit::before {
  opacity: 1;
}

.button-rig {
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
  width: 12.25rem;
  height: 12.25rem;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(circle, #0e1428 58%, var(--color-stage-700) 78%, #0b1020 100%);
  border: 1px solid var(--color-line);
  z-index: 0;
}

/* QUESTIONING時のパルスリング */
.pulse-ring {
  position: absolute;
  width: 10rem;
  height: 10rem;
  border-radius: 50%;
  border: 2px solid var(--color-gold-400);
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

/* 真上から見たドーム型キャップ。沈み込みは縮小＋内側影＋減光で表現 */
.quiz-button {
  position: relative;
  z-index: 2;
  /* タップハイライト・長押し選択が物理ボタン演出を壊さないように（Task 22-2） */
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  -webkit-user-select: none;
  width: 9.375rem;
  height: 9.375rem;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  font-size: 1.1875rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  background:
    radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.3) 0%, transparent 50%),
    radial-gradient(
      circle,
      var(--color-signal-500) 55%,
      var(--color-signal-600) 80%,
      var(--color-signal-700) 100%
    );
  box-shadow:
    0 0 0 0.3125rem rgba(0, 0, 0, 0.35),
    /* ソケットの隙間 */ 0 0.5rem 1.375rem rgba(0, 0, 0, 0.55); /* 浮き上がりの柔らかい影 */
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
  box-shadow:
    0 0 0 0.3125rem rgba(0, 0, 0, 0.35),
    0 2px 0.375rem rgba(0, 0, 0, 0.4),
    inset 0 0 1.375rem rgba(0, 0, 0, 0.45);
}

/* RELEASED: LEDグロー点灯（解答権取得）。太い実線リングは付けずグローのみ */
.quiz-button.released {
  transform: scale(0.96);
  box-shadow:
    0 0 0 0.3125rem rgba(0, 0, 0, 0.35),
    0 0.1875rem 0.625rem rgba(0, 0, 0, 0.45),
    inset 0 0 0.875rem rgba(0, 0, 0, 0.3),
    0 0 1.75rem 0.625rem rgba(230, 64, 46, 0.55);
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

/* DISABLED: 暗転して沈んだまま */
.quiz-button.disabled,
.quiz-button:disabled {
  cursor: not-allowed;
  transform: scale(0.93);
  filter: grayscale(0.85) brightness(0.55);
  box-shadow:
    0 0 0 0.3125rem rgba(0, 0, 0, 0.35),
    inset 0 0 1.375rem rgba(0, 0, 0, 0.5);
}
</style>
