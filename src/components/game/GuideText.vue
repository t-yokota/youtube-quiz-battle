<script setup lang="ts">
// GuideText コンポーネント
// ガイドテキスト表示（LOADING/READY/TALKING状態）
// READY ではボタンへ視線誘導する矢印モーションを表示する

import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { GameState } from '@/types'

const gameStore = useGameStore()
const props = defineProps<{ hideDownCue?: boolean; measureWidth?: boolean; message?: string }>()
const emit = defineEmits<{ contentWidth: [width: number] }>()
const messageElement = ref<HTMLElement>()
let observer: ResizeObserver | undefined
function measure() {
  if (props.measureWidth && messageElement.value) {
    emit('contentWidth', messageElement.value.getBoundingClientRect().width)
  }
}
onMounted(() => {
  measure()
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(measure)
  if (messageElement.value) observer.observe(messageElement.value)
})
watch([() => gameStore.guideText, () => props.message, () => props.measureWidth], measure, {
  flush: 'post',
})
onBeforeUnmount(() => observer?.disconnect())

// READY時のみボタンへの視線誘導矢印を表示
const showDownCue = computed(() => !props.hideDownCue && gameStore.currentState === GameState.READY)
</script>

<template>
  <div class="guide-text">
    <span ref="messageElement" class="guide-message">{{
      props.message ?? gameStore.guideText
    }}</span>
    <span v-if="showDownCue" class="down-cue" aria-hidden="true">▼</span>
  </div>
</template>

<style scoped>
/* Guide Text */
.guide-text {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: calc(0.875 * var(--ui-font-unit));
  color: var(--color-text-dim);
  line-height: 1.5;
}

.guide-message {
  margin: 0;
}

/* READY時: ボタンへの視線誘導（絶対配置で本文の上下センターを崩さない） */
.down-cue {
  position: absolute;
  left: 50%;
  top: calc(50% + 1rem);
  transform: translateX(-50%);
  font-size: calc(0.875 * var(--ui-font-unit));
  color: var(--color-accent);
  animation: bob 1.2s ease-in-out infinite;
}

@keyframes bob {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(0.25rem);
  }
}
</style>
