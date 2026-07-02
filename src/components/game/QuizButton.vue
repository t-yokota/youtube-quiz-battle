<script setup lang="ts">
// QuizButton コンポーネント
// 早押しボタンの表示と状態管理
import { computed } from 'vue'
import { ButtonState } from '@/types'

interface Props {
  buttonState?: ButtonState
  buttonText?: string
}

const props = withDefaults(defineProps<Props>(), {
  buttonState: ButtonState.STANDBY,
  buttonText: '早押しボタン',
})

// イベント定義
const emit = defineEmits<{
  press: []
}>()

// CSSクラス名用（standby / pushed / released / disabled）
const buttonStateClass = computed(() => props.buttonState.toLowerCase())

const handlePress = () => {
  if (props.buttonState !== ButtonState.DISABLED) {
    emit('press')
  }
}
</script>

<template>
  <section class="button-area">
    <button
      :class="['quiz-button', buttonStateClass]"
      :disabled="buttonState === ButtonState.DISABLED"
      @click="handlePress"
    >
      {{ buttonText }}
    </button>
  </section>
</template>

<style scoped>
/* Quiz Button Area */
.button-area {
  flex: 1;
  display: grid;
  place-items: center;
  min-height: 0;
  padding: 1rem;
  position: relative;
  overflow: hidden;
  container-type: size;
}

.quiz-button {
  /* ボタンサイズの計算: 3:4比率を厳密に維持 */
  /* gridとcontainer queriesを使用して、利用可能なスペースに収める */
  width: min(80cqw, calc(100cqh * 0.75), 300px);
  height: auto;
  aspect-ratio: 3 / 4;
  background-color: #ef4444;
  color: white;
  font-size: 1.5rem;
  font-weight: bold;
  border: none;
  border-radius: 1rem;
  cursor: pointer;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

/* STANDBY状態 - デフォルト（赤） */
.quiz-button.standby {
  background-color: #ef4444;
}

.quiz-button.standby:hover {
  background-color: #dc2626;
  transform: translateY(-2px);
  box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
}

.quiz-button.standby:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* PUSHED状態 - 押下中（暗い赤） */
.quiz-button.pushed {
  background-color: #b91c1c;
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* RELEASED状態 - 押下後（緑） */
.quiz-button.released {
  background-color: #22c55e;
  cursor: default;
}

.quiz-button.released:hover {
  background-color: #22c55e;
  transform: none;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

/* DISABLED状態 - 無効（グレー） */
.quiz-button.disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

.quiz-button:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

/* モバイル対応 */
@media (max-width: 640px) {
  .button-area {
    padding: 0.75rem;
  }

  .quiz-button {
    font-size: 1.25rem;
    width: min(85cqw, calc(100cqh * 0.75), 250px);
  }
}

/* 小さい画面での追加調整 */
@media (max-height: 700px) {
  .button-area {
    padding: 0.5rem;
  }

  .quiz-button {
    font-size: 1.125rem;
  }
}
</style>
