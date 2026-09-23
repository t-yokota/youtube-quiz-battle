<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
const emit = defineEmits<{ resize: [width: number] }>()
const host = ref<HTMLElement>()
const width = ref(840)
const maximum = ref(960)
const dragging = ref(false)
const gripTop = ref(0)
const minimum = ref(640)
let resizeFactor = 2
let observer: ResizeObserver | undefined
let drag: { pointerId: number; startX: number; startWidth: number; side: number } | undefined
function measure() {
  if (!host.value) return
  const bounds = host.value.getBoundingClientRect()
  width.value = bounds.width
  const lower = host.value.parentElement?.querySelector('.game-ui')?.getBoundingClientRect()
  gripTop.value = lower ? lower.top - bounds.top + lower.height / 2 : bounds.height / 2
  const availableWidth = host.value.parentElement?.clientWidth ?? 1440
  resizeFactor = availableWidth < 1200 ? 1 : 2
  const style = getComputedStyle(host.value.parentElement!)
  minimum.value = parseFloat(style.getPropertyValue('--desktop-min-video-width')) || 640
  maximum.value =
    parseFloat(style.getPropertyValue('--desktop-max-video-width')) ||
    Math.max(minimum.value, availableWidth - 240 * resizeFactor)
}
function resize(value: number) {
  const next = Math.min(maximum.value, Math.max(minimum.value, Math.round(value)))
  emit('resize', next)
}
function start(event: PointerEvent, side: number) {
  if (event.button !== 0 || dragging.value) return
  measure()
  drag = { pointerId: event.pointerId, startX: event.clientX, startWidth: width.value, side }
  dragging.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  event.preventDefault()
}
function move(event: PointerEvent) {
  if (!drag || drag.pointerId !== event.pointerId) return
  // 3列は左右を同量動かす。左サイドを畳んだ2列では右境界だけを動かす。
  resize(drag.startWidth + (event.clientX - drag.startX) * drag.side * resizeFactor)
}
function stop() {
  drag = undefined
  dragging.value = false
}
function keydown(event: KeyboardEvent, side: number) {
  measure()
  const delta = event.shiftKey ? 40 : 10
  if (event.key === 'ArrowRight') resize(width.value + delta * side * resizeFactor)
  else if (event.key === 'ArrowLeft') resize(width.value - delta * side * resizeFactor)
  else if (event.key === 'Home') resize(minimum.value)
  else if (event.key === 'End') resize(maximum.value)
  else return
  event.preventDefault()
}
onMounted(() => {
  measure()
  observer = new ResizeObserver(measure)
  observer.observe(host.value!)
  if (host.value?.parentElement) {
    observer.observe(host.value.parentElement)
    const lower = host.value.parentElement.querySelector('.game-ui')
    if (lower) observer.observe(lower)
  }
})
onBeforeUnmount(() => {
  observer?.disconnect()
  stop()
})
</script>
<template>
  <div
    ref="host"
    class="desktop-resize-handles"
    :class="{ dragging }"
    :style="{ '--grip-top': `${gripTop}px` }"
  >
    <div
      v-for="side in [-1, 1]"
      :key="side"
      class="desktop-resize-handle"
      :class="side === -1 ? 'left' : 'right'"
      role="separator"
      tabindex="0"
      aria-orientation="vertical"
      :aria-label="side === -1 ? '中央エリアの左境界' : '中央エリアの右境界'"
      :aria-valuemin="minimum"
      :aria-valuemax="maximum"
      :aria-valuenow="Math.round(width)"
      :aria-valuetext="`動画幅 ${Math.round(width)}ピクセル`"
      title="ドラッグまたは左右キーで中央エリアの幅を調整"
      @pointerdown="start($event, side)"
      @pointermove="move"
      @pointerup="stop"
      @pointercancel="stop"
      @lostpointercapture="stop"
      @keydown="keydown($event, side)"
    >
      <span class="resize-grip" aria-hidden="true"></span>
    </div>
  </div>
</template>
<style scoped>
.desktop-resize-handles {
  position: relative;
  min-height: 0;
  pointer-events: none;
  z-index: 3;
}
.desktop-resize-handles.dragging {
  pointer-events: auto;
  cursor: col-resize;
}
.desktop-resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 16px;
  pointer-events: auto;
  cursor: col-resize;
  touch-action: none;
  user-select: none;
}
.left {
  left: -8px;
}
.right {
  right: -8px;
}
.desktop-resize-handle::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 7px;
  width: 2px;
  background: var(--color-line);
  transition: background-color 120ms;
}
.desktop-resize-handle:hover::after,
.dragging .desktop-resize-handle::after {
  background: var(--color-accent);
}
.resize-grip {
  position: absolute;
  left: 50%;
  top: var(--grip-top);
  transform: translate(-50%, -50%);
  z-index: 1;
  width: 6px;
  height: 64px;
  display: grid;
  place-items: center;
  pointer-events: none;
  border: 1px solid var(--color-line);
  border-radius: 3px;
  background: var(--color-text-dim);
  color: var(--color-text-sub);
  box-shadow: var(--panel-shadow);
}
.desktop-resize-handle:hover .resize-grip,
.dragging .resize-grip {
  background: var(--color-accent);
  border-color: var(--color-accent);
}
.desktop-resize-handle:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: -2px;
}
.desktop-resize-handle:focus-visible::after {
  background: var(--color-focus);
}
.desktop-resize-handle:focus-visible .resize-grip {
  background: var(--color-focus);
  border-color: var(--color-focus);
}
</style>
