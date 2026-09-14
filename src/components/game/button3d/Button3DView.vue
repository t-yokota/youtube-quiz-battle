<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount, watch } from 'vue'
import { ButtonState } from '@/types'
import type { ButtonModelId } from '@/constants/button'
import type { ButtonView } from './view'
import type { TargetRect } from './contracts'
import { logger } from '@/utils/logger'
const props = defineProps<{
  buttonState: ButtonState
  enabled: boolean
  blocked: boolean
  modelId: ButtonModelId
  playMode: boolean
}>()
const emit = defineEmits<{ press: []; ready: []; failed: [] }>()
const host = ref<HTMLElement>()
const ready = ref(false)
const target = shallowRef<TargetRect>({ x: 0, y: 0, width: 44, height: 44, visible: false })
let view: ButtonView | undefined
let mounted = false
let failed = false
let pointer: { id: number; x: number; y: number; released: boolean } | undefined
let cancelled = false
function fail(error: unknown) {
  if (!mounted || failed) return
  failed = true
  view?.dispose()
  logger.warn('[Button3D] Switching to 2D:', error)
  emit('failed')
}
onMounted(async () => {
  mounted = true
  try {
    const { createButtonView } = await import('./view')
    if (!mounted || !host.value) return
    view = createButtonView(host.value, {
      modelId: props.modelId,
      onError: fail,
      onTarget: (rect) => {
        target.value = rect
      },
    })
    if (failed) {
      view.dispose()
      return
    }
    view.setState(props.buttonState)
    view.setInteractionEnabled(!props.blocked)
    ready.value = true
    emit('ready')
  } catch (error) {
    fail(error)
  }
})
onBeforeUnmount(() => {
  mounted = false
  view?.dispose()
})
watch(
  () => props.buttonState,
  (state) => view?.setState(state),
  { flush: 'sync' },
)
watch(
  () => props.modelId,
  (id) => view?.setModel(id),
  { flush: 'sync' },
)
watch(
  () => props.blocked,
  (blocked) => {
    view?.setInteractionEnabled(!blocked)
    if (blocked) cancelPointer()
  },
  { flush: 'sync' },
)
function pointerDown(e: PointerEvent) {
  cancelled = !e.isPrimary || e.button !== 0 || !view?.acceptsPoint(e.clientX, e.clientY)
  pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, released: false }
}
function cancelPointer() {
  cancelled = true
}
function pointerMove(e: PointerEvent) {
  if (pointer && Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) > 8) cancelled = true
}
function pointerUp(e: PointerEvent) {
  if (!pointer || pointer.id !== e.pointerId) return
  pointerMove(e)
  pointer = { ...pointer, released: true }
}
function pointerLeave() {
  // タッチの正常終了ではpointerup→pointerleave→clickの順になる。
  if (pointer && !pointer.released) cancelPointer()
}
function press(e: MouseEvent) {
  // Space/Enterによるネイティブclickも同じ経路。回転やドラッグは早押しに変えない。
  if (
    props.enabled &&
    !props.blocked &&
    props.buttonState === ButtonState.STANDBY &&
    (e.detail === 0 || (pointer && !cancelled && view?.acceptsPoint(e.clientX, e.clientY)))
  ) {
    if (props.playMode) view?.playStartPress()
    emit('press')
  }
  pointer = undefined
}
</script>
<template>
  <div class="button-3d-controls" :inert="blocked || !ready || undefined">
    <div class="button-3d" :class="{ 'is-round': modelId === 'simple-round-v1' }">
      <div ref="host" class="button-canvas" />
      <button
        v-show="ready"
        type="button"
        class="button-hit"
        :class="{ 'keyboard-only': !target.visible }"
        :style="{
          left: `${target.x}px`,
          top: `${target.y}px`,
          width: `${target.width}px`,
          height: `${target.height}px`,
        }"
        :disabled="!enabled || blocked"
        :aria-label="playMode ? '動画を再生' : '早押しボタン'"
        @pointerdown="pointerDown"
        @pointermove="pointerMove"
        @pointerup="pointerUp"
        @pointercancel="cancelPointer"
        @pointerleave="pointerLeave"
        @click.stop="press"
      />
    </div>
    <button
      type="button"
      class="button-reset"
      aria-label="ボタンの向きを戻す"
      @click="view?.resetView()"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" fill="none" stroke="currentColor" stroke-width="2" />
      </svg>
    </button>
  </div>
</template>
<style scoped>
.button-3d-controls {
  position: absolute;
  inset: 0;
}
.button-3d {
  position: absolute;
  inset: 0 10%;
}
.button-3d.is-round {
  inset-inline: 20%;
}
.button-canvas {
  width: 100%;
  height: 100%;
}
.button-hit {
  position: absolute;
  display: grid;
  place-items: center;
  transform: translate(-50%, -50%);
  border: 0;
  padding: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
}
.button-hit:disabled {
  cursor: default;
}
.button-hit:focus-visible,
.button-reset:focus-visible {
  outline: 3px solid var(--color-accent);
  outline-offset: 3px;
}
.button-hit.keyboard-only {
  left: 50% !important;
  top: 50% !important;
  pointer-events: none;
}

.button-reset {
  position: absolute;
  left: calc(-1 * var(--icon-hit-offset, 9.625px));
  bottom: 5px;
  width: 44px;
  height: 44px;
  display: grid;
  align-items: center;
  justify-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-dim);
  cursor: pointer;
}
.button-reset svg {
  width: 20px;
  height: 20px;
}
</style>
