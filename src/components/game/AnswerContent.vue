<script setup lang="ts">
// AnswerContent コンポーネント
// 解答入力エリア（QUESTIONING/ANSWERING/WAITING/REVEALING状態）
// タイマーは conic-gradient リング（12時起点・時計回り減少・残り3秒以下で赤 + 脈動）

import { ref, computed, watch, nextTick, onBeforeUnmount, onMounted } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { TIMER_URGENT_THRESHOLD_SEC } from '@/constants/timing'
import {
  calculateTimerLabelWidthCh,
  calculateTimerProgress,
  resolveTimerLabelWidthState,
  type TimerLabelWidthState,
} from './answerTimerLayout'

const props = defineProps<{ desktop?: boolean; compact?: boolean; focusBlocked?: boolean }>()
const gameStore = useGameStore()
let focusTimer: ReturnType<typeof setTimeout> | undefined
let focusGeneration = 0
function cancelFocus() {
  focusGeneration++
  clearTimeout(focusTimer)
  focusTimer = undefined
}
function focusInput() {
  if (gameStore.isInputDisabled || props.focusBlocked) return
  if (props.desktop) inputRef.value?.focus({ preventScroll: true })
  else inputRef.value?.focus()
}
onBeforeUnmount(cancelFocus)

// イベント定義（解答送信は GameManager 経由必須のため emit を維持）
const emit = defineEmits<{
  submit: [answer: string]
  compactWidth: [width: number]
}>()

// 縮小カードの横幅を実際の文字幅に合わせる。数値幅を渡して展開アニメーションを維持する。
const attemptsLabel = ref<HTMLElement>()
const resultSlot = ref<HTMLElement>()
const answerMeta = ref<HTMLElement>()
const summaryWidth = ref(0)
const timerWidth = ref(0)
let labelObserver: ResizeObserver | undefined
function measureCompactLabel() {
  if (props.desktop && attemptsLabel.value) {
    const resultWidth = resultSlot.value?.getBoundingClientRect().width ?? 0
    summaryWidth.value = attemptsLabel.value.getBoundingClientRect().width + resultWidth
    timerWidth.value =
      answerMeta.value?.querySelector('.answer-timer')?.getBoundingClientRect().width ?? 0
    // 縮小後の幅を拡大中から用意し、縮小開始後の計測で目標幅を更新しない。
    const gap = resultWidth ? parseFloat(getComputedStyle(document.documentElement).fontSize) : 0
    emit('compactWidth', summaryWidth.value + gap)
  }
}
onMounted(() => {
  measureCompactLabel()
  if (typeof ResizeObserver === 'undefined') return
  labelObserver = new ResizeObserver(measureCompactLabel)
  if (attemptsLabel.value) labelObserver.observe(attemptsLabel.value)
  if (resultSlot.value) labelObserver.observe(resultSlot.value)
  if (answerMeta.value) labelObserver.observe(answerMeta.value)
})
watch([() => props.desktop, () => gameStore.isInputDisabled], measureCompactLabel, {
  flush: 'post',
})
onBeforeUnmount(() => labelObserver?.disconnect())

// 入力欄の参照（オートフォーカス用）
const inputRef = ref<HTMLInputElement | null>(null)

// 送信ボタンの無効状態（入力欄が無効 or 入力が空）
const isSubmitDisabled = () => gameStore.isInputDisabled || gameStore.answerInput.trim() === ''

// タイマーリング進捗（1 → 0。分母は設定の制限時間）
const answerTimeLimit = computed(() => gameStore.effectiveSettings?.answerTimeLimit ?? 10)
const timerLabelWidthState = ref<TimerLabelWidthState>()
watch(
  [() => gameStore.currentQuestionNumber, answerTimeLimit, () => gameStore.answerTimeRemaining],
  ([questionNumber, timeLimit, timeRemaining]) => {
    timerLabelWidthState.value = resolveTimerLabelWidthState(
      timerLabelWidthState.value,
      questionNumber,
      timeLimit,
      timeRemaining,
    )
  },
  { immediate: true },
)
const timerLabelWidth = computed(
  () =>
    `${timerLabelWidthState.value?.widthCh ?? calculateTimerLabelWidthCh(answerTimeLimit.value)}ch`,
)
const timerProgress = computed(() =>
  calculateTimerProgress(gameStore.answerTimeRemaining, answerTimeLimit.value),
)

// 残り3秒以下で赤 + 脈動
const isUrgent = computed(() => gameStore.answerTimeRemaining <= TIMER_URGENT_THRESHOLD_SEC)

const isComposing = ref(false)

const handleEnter = (event: KeyboardEvent) => {
  if (isComposing.value || event.isComposing || event.keyCode === 229) return
  handleSubmit()
}

const handleSubmit = () => {
  if (isSubmitDisabled()) return
  emit('submit', gameStore.answerInput)
}

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  gameStore.updateAnswerInput(target.value)
}

// ANSWERING遷移時にオートフォーカス
watch(
  () => gameStore.isInputDisabled,
  (disabled) => {
    cancelFocus()
    if (disabled) {
      // disabled属性の反映前に明示的にblurし、送信・時間切れでも
      // キーボード終了時のviewport先行復元（focusout）を確実に開始する。
      if (document.activeElement === inputRef.value) inputRef.value?.blur()
    } else {
      const generation = focusGeneration
      nextTick(() => {
        if (generation !== focusGeneration) return
        // PCはカード移動中のスクロールや入力フォーカスの先行を避ける。
        // スマホ（特にiOS）と動きを減らす設定では従来どおり即時フォーカスする。
        if (props.desktop && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
          focusTimer = setTimeout(() => {
            focusTimer = undefined
            focusInput()
          }, 560)
        } else focusInput()
      })
    }
  },
  { flush: 'sync' },
)

// 誤答リトライ時のフォーカス復帰（ANSWERING維持のまま answerResult が 'incorrect' に変わる場合）
watch(
  () => gameStore.answerResult,
  (result) => {
    if (result === 'incorrect' && !gameStore.isInputDisabled) {
      nextTick(() => {
        if (!focusTimer) focusInput()
      })
    }
  },
)
</script>

<template>
  <div class="answer-content">
    <!-- Answer Meta Information -->
    <div
      ref="answerMeta"
      class="answer-meta"
      :style="
        desktop
          ? {
              '--summary-content-width': `${summaryWidth}px`,
              '--summary-timer-width': `${timerWidth}px`,
            }
          : undefined
      "
    >
      <div class="answer-summary">
        <span class="attempts-counter"
          ><span ref="attemptsLabel" class="attempts-label"
            >{{ desktop ? '解答残り' : '残り' }} {{ gameStore.remainingAttempts }}回<span
              class="dim"
            >
              / {{ gameStore.effectiveSettings?.maxAttempts ?? gameStore.remainingAttempts }}</span
            ></span
          ></span
        >
        <!-- 結果の高さもレイアウトに含め、入力欄との間隔を確保する。 -->
        <div ref="resultSlot" class="answer-result-slot" aria-live="polite">
          <span v-if="gameStore.answerResult" :class="['answer-result', gameStore.answerResult]">
            {{ gameStore.answerResult === 'correct' ? '正解！' : '不正解' }}
          </span>
        </div>
      </div>
      <span
        v-if="!gameStore.isInputDisabled"
        class="answer-timer"
        :class="{ urgent: isUrgent }"
        :style="{
          '--timer-progress': timerProgress,
          '--timer-label-width': timerLabelWidth,
        }"
      >
        <span class="timer-ring"></span>
        <span class="sec">{{ gameStore.answerTimeRemaining }}s</span>
      </span>
    </div>

    <!-- Answer Input -->
    <div class="answer-input-container">
      <input
        ref="inputRef"
        type="text"
        class="answer-input"
        placeholder="解答を入力"
        maxlength="100"
        :value="gameStore.answerInput"
        :disabled="gameStore.isInputDisabled"
        @input="handleInput"
        @compositionstart="isComposing = true"
        @compositionend="isComposing = false"
        @keydown.enter="handleEnter"
      />
      <button
        type="button"
        class="submit-button"
        :disabled="isSubmitDisabled()"
        @click="handleSubmit"
      >
        送信
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Answer Content */
.answer-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.5rem;
}

/* Answer Meta Information */
.answer-summary {
  /* スマホでは従来の3列グリッド配置を維持する。 */
  display: contents;
}

.answer-meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  min-height: 1.625rem;
  gap: 0.375rem;
  /* 両端の残り回数・タイマーを枠から数 px 内側に寄せる */
  padding: 0 0.25rem;
  font-size: calc(0.75 * var(--ui-font-unit));
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.attempts-counter {
  color: var(--color-info);
  font-weight: 700;
  font-size: calc(0.8 * var(--ui-font-unit));
}

.attempts-counter .dim {
  color: var(--color-text-dim);
  font-weight: 500;
}

/* タイマー: conic-gradient リング + 残秒数（12時から時計回りに減る） */
.answer-timer {
  grid-column: 3;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.375rem;
  width: calc(1.375rem + 0.375rem + var(--timer-label-width, 3ch));
  margin-left: auto;
  flex-shrink: 0;
  font-size: calc(0.8 * var(--ui-font-unit));
  font-weight: 800;
  color: var(--color-text-main);
  /* 1秒刻みの進捗更新を線形補間して連続的に見せる（@property 登録は main.css） */
  transition: --timer-progress 1s linear;
}

/* 制限時間の最大桁幅で固定し、桁が減ったら数字とsの左右に余白を作る */
.answer-timer .sec {
  width: var(--timer-label-width, 3ch);
  flex-shrink: 0;
  text-align: center;
  white-space: nowrap;
}

.timer-ring {
  width: 1.375rem;
  height: 1.375rem;
  flex-shrink: 0;
  border-radius: 50%;
  /* 内円を別要素で配置せず、同じ描画領域・中心で重ねる。
     remが小数pxになっても別々のレイアウト丸めで中心がずれない。 */
  background:
    radial-gradient(
      circle at 50% 50%,
      var(--timer-hole) calc(0.4375rem - 0.25px),
      transparent calc(0.4375rem + 0.25px)
    ),
    conic-gradient(
      at 50% 50%,
      var(--timer-track) calc((1 - var(--timer-progress)) * 360deg),
      var(--timer-fill, var(--color-accent)) 0deg
    );
}

.answer-timer.urgent {
  color: var(--color-urgent);
  animation: throb 0.5s ease-in-out infinite;
}

.answer-timer.urgent .timer-ring {
  --timer-fill: var(--color-urgent);
}

@keyframes throb {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

/* 結果バナーも通常フローに含め、縦に短い画面で入力欄へ重ならないようにする。 */
.answer-result-slot {
  grid-column: 2;
  margin-inline: auto;
}
.answer-result-slot:empty {
  display: none;
}
.answer-result {
  display: block;
  font-size: calc(0.875 * var(--ui-font-unit));
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 0.1875rem 0.875rem;
  border-radius: 62.4375rem;
  white-space: nowrap;
  animation: pop var(--duration-base) var(--ease-brand);
}

@keyframes pop {
  from {
    transform: scale(0.7);
    opacity: 0;
  }
}

.answer-result.correct {
  background: var(--banner-correct-bg);
  color: var(--color-answer-correct);
  border: 1px solid var(--color-answer-correct);
}

.answer-result.incorrect {
  background: var(--banner-wrong-bg);
  color: var(--color-answer-wrong);
  border: 1px solid var(--color-answer-wrong);
}

/* Answer Input Container */
.answer-input-container {
  display: flex;
  gap: 0.5rem;
}

.answer-input {
  flex: 1;
  min-width: 0;
  height: max(36px, 2.5rem);
  padding: 0 0.875rem;
  font-size: max(16px, var(--ui-font-unit)); /* iOSズーム防止（実 px 16 を下回らない） */
  color: var(--color-text-main);
  background: var(--input-bg);
  border: 2px solid var(--input-border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--input-shadow);
  outline: none;
  transition:
    border-color var(--duration-fast),
    box-shadow var(--duration-fast);
}

.answer-input::placeholder {
  color: var(--color-placeholder);
}

.answer-input:focus-visible {
  border-color: var(--input-focus-border-color);
  box-shadow: var(--input-focus-shadow);
}

.answer-input:disabled {
  opacity: 0.45;
}

.submit-button {
  height: max(36px, 2.5rem);
  min-width: max(36px, 2.5rem);
  padding: 0 1rem;
  font-size: calc(0.9375 * var(--ui-font-unit));
  font-weight: 800;
  color: var(--btn-primary-text);
  background: var(--btn-primary-bg);
  border: none;
  border-radius: var(--radius-md);
  box-shadow: var(--btn-primary-shadow);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    transform var(--duration-fast),
    background var(--duration-fast);
}

.submit-button:hover:not(:disabled) {
  background: var(--btn-primary-bg-hover);
}

.submit-button:active:not(:disabled) {
  transform: translateY(1px);
}

.submit-button:disabled {
  background: var(--surface-raised);
  color: var(--color-text-dim);
  box-shadow: none;
  cursor: not-allowed;
}
</style>
