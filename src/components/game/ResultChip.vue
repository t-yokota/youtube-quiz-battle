<script setup lang="ts">
// ResultChip コンポーネント
// 1問分の戦績を外周円＋マークの一体 SVG で描画する（フォント非依存）
// 種別: 正解(○) / 不正解(×) / スキップ(−) / 無解答(・) / 未実施(空) / 現在(点灯枠)

export type ChipVariant = 'correct' | 'incorrect' | 'skipped' | 'noanswer' | 'empty' | 'current'

defineProps<{
  variant: ChipVariant
}>()
</script>

<template>
  <svg class="chip" :class="variant" viewBox="0 0 16 16" aria-hidden="true">
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
.chip {
  width: 1rem;
  height: 1rem;
  display: block;
  color: var(--color-text-dim);
  --chip-bg: var(--color-stage-700);
  --chip-line: var(--color-line);
}

.chip.correct {
  color: var(--color-ok-400);
  --chip-bg: rgba(61, 220, 132, 0.16);
  --chip-line: var(--color-ok-400);
}

.chip.incorrect {
  color: var(--color-signal-500);
  --chip-bg: rgba(230, 64, 46, 0.14);
  --chip-line: var(--color-signal-500);
}

.chip.current {
  --chip-line: var(--color-gold-400);
  border-radius: 50%;
  box-shadow: 0 0 0.375rem rgba(255, 197, 61, 0.5);
}

.ring {
  fill: var(--chip-bg);
  stroke: var(--chip-line);
}

.mark {
  stroke: currentColor;
  stroke-width: 1.4;
}

.mark-fill {
  fill: currentColor;
}
</style>
