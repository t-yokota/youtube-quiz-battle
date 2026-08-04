<script setup lang="ts">
// ResultChip コンポーネント
// 1問分の戦績を外周円＋マークの一体 SVG で描画する（フォント非依存）
// 種別: 正解(○) / 不正解(×) / スキップ(−) / 無解答(・) / 未実施(空) / 現在(点灯枠)

export type ChipVariant = 'correct' | 'incorrect' | 'skipped' | 'noanswer' | 'empty' | 'current'

defineProps<{
  variant: ChipVariant
  /** 現在の問題カーソル（結果色またはアクセントのリング + グロー）。variant と併用できる */
  current?: boolean
}>()
</script>

<template>
  <svg class="chip" :class="[variant, { current }]" viewBox="0 0 16 16" aria-hidden="true">
    <circle class="ring" cx="8" cy="8" r="7.25" />
    <!-- ○（正解） -->
    <circle v-if="variant === 'correct'" class="mark" cx="8" cy="8" r="3.4" fill="none" />
    <!-- ×（不正解） -->
    <path
      v-else-if="variant === 'incorrect'"
      class="mark"
      d="M5.3 5.3 L10.7 10.7 M10.7 5.3 L5.3 10.7"
      fill="none"
      stroke-linecap="round"
    />
    <!-- −（スキップ） -->
    <path
      v-else-if="variant === 'skipped'"
      class="mark"
      d="M5.4 8 H10.6"
      fill="none"
      stroke-linecap="round"
    />
    <!-- ・（無解答） -->
    <circle v-else-if="variant === 'noanswer'" class="mark-fill" cx="8" cy="8" r="1.7" />
  </svg>
</template>

<style scoped>
/* ローカル変数（--_ 接頭辞）にテーマトークンを束ね、variant で差し替える */
.chip {
  width: 1rem;
  height: 1rem;
  display: block;
  color: var(--color-text-dim);
  --_chip-bg: var(--chip-bg);
  --_chip-line: var(--color-line);
  --_chip-current-glow: var(--chip-current-glow);
}

.chip.correct {
  color: var(--color-answer-correct);
  --_chip-bg: var(--chip-correct-bg);
  --_chip-line: var(--color-answer-correct);
  --_chip-current-glow: var(--chip-current-correct-glow);
}

.chip.incorrect {
  color: var(--color-answer-wrong);
  --_chip-bg: var(--chip-wrong-bg);
  --_chip-line: var(--color-answer-wrong);
  --_chip-current-glow: var(--chip-current-wrong-glow);
}

/* 現在の問題カーソル: 正誤確定時は各結果色、それ以外はアクセントのグローを重ねる */
.chip.current {
  border-radius: 50%;
  box-shadow: var(--_chip-current-glow);
}

/* 未確定（empty）の現在問題のみ枠線もアクセントにする */
.chip.empty.current {
  --_chip-line: var(--color-accent);
}

.ring {
  fill: var(--_chip-bg);
  stroke: var(--_chip-line);
}

.mark {
  stroke: currentColor;
  stroke-width: 1.4;
}

.mark-fill {
  fill: currentColor;
}
</style>
