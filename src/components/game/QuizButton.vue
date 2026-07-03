<script setup lang="ts">
// QuizButton コンポーネント
// 早押しボタン（物理ボタン: 真上視点の円形キャップ + 同心円台座 + LED リング）
import { computed } from 'vue'
import { ButtonState, GameState } from '@/types'
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
</script>

<template>
  <section class="quiz-button-container" :class="{ lit: isLit }">
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
        <span v-else-if="isButtonChecking" class="check-label">BUTTON<br />CHECK</span>
        <template v-else>{{ buttonLabel }}</template>
      </button>
    </div>
  </section>
</template>

<style scoped>
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

/* ボタンエリア */
.quiz-button-container {
  flex: 1;
  min-height: 15rem;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
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
