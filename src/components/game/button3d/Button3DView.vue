<script setup lang="ts">
import { ref, shallowRef, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
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
  fitInitialRotation?: boolean
  panelExpanded?: boolean
}>()
const emit = defineEmits<{
  press: []
  ready: []
  failed: []
  visualWidth: [width: number]
  rotationChange: [rotated: boolean]
}>()
const host = ref<HTMLElement>()
const fitRegion = ref<HTMLElement>()
const gameArea = shallowRef<HTMLElement>()
// サイズ調整時だけtrueにして計測窓を再表示する。通常時は計測処理も停止する。
const showSizeReadout = false
const referenceSize = shallowRef<{
  width: number
  height: number
  areaWidth: number
  initialAreaWidth: number
}>()
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
    gameArea.value = host.value?.closest<HTMLElement>('.game-ui') ?? undefined
    await nextTick()
    const { createButtonView } = await import('./view')
    if (!mounted || !host.value) return
    view = createButtonView(host.value, {
      modelId: props.modelId,
      fitInitialRotation: props.fitInitialRotation,
      fitContainer: fitRegion.value,
      onError: fail,
      onVisualWidth: (width) => emit('visualWidth', width),
      onRotationChange: (rotated) => emit('rotationChange', rotated),
      onReferenceSize: showSizeReadout
        ? (size) => {
            referenceSize.value = size
          }
        : undefined,
      onTarget: (rect) => {
        target.value = rect
      },
    })
    if (failed) {
      view.dispose()
      return
    }
    view.setState(props.buttonState)
    if (props.panelExpanded) view.captureLayoutRotation()
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
  () => props.panelExpanded,
  (expanded) => {
    if (expanded) view?.captureLayoutRotation()
  },
  { flush: 'sync' },
)
watch(
  () => props.fitInitialRotation,
  (enabled) => view?.setFitInitialRotation(enabled ?? false),
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
  if (e.detail === 0 || (pointer && !cancelled && view?.acceptsPoint(e.clientX, e.clientY))) {
    activate()
  }
  pointer = undefined
}
function activate() {
  if (props.enabled && !props.blocked && props.buttonState === ButtonState.STANDBY) {
    if (props.playMode) view?.playStartPress()
    emit('press')
  }
}
function resetView() {
  if (ready.value && !props.blocked) view?.resetView()
}
defineExpose({ activate, resetView })
</script>
<template>
  <div class="button-3d-controls" :inert="blocked || !ready || undefined">
    <div ref="fitRegion" class="button-3d" :class="{ 'is-round': modelId === 'simple-round-v1' }">
      <Teleport :to="gameArea ?? 'body'" :disabled="!fitInitialRotation || !gameArea">
        <div
          class="button-3d-surface"
          :class="{ 'is-game-canvas': fitInitialRotation && gameArea }"
          :inert="blocked || !ready || undefined"
        >
          <div ref="host" class="button-canvas" />
          <output
            v-if="showSizeReadout && fitInitialRotation && referenceSize"
            class="model-size-readout"
          >
            {{ modelId === 'simple-round-v1' ? '丸型' : '箱型' }}・初期角度の基準サイズ<br />
            幅 {{ Math.round(referenceSize.width) }} × 高さ
            {{ Math.round(referenceSize.height) }} px <br />game-ui幅
            {{ referenceSize.areaWidth }} px ／ 占有率
            {{ ((referenceSize.width / referenceSize.areaWidth) * 100).toFixed(1) }}%
            <br />上限：初期幅 {{ Math.round(referenceSize.initialAreaWidth) }} pxの{{
              modelId === 'simple-round-v1' ? 30 : 25
            }}% （{{
              Math.round(
                referenceSize.initialAreaWidth * (modelId === 'simple-round-v1' ? 0.3 : 0.25),
              )
            }}
            px）
          </output>
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
      </Teleport>
    </div>
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
.button-3d-surface {
  position: absolute;
  inset: 0;
}
.button-3d-surface.is-game-canvas {
  z-index: 0;
}
/* 最大サイズを決めるための一時計測表示。レイアウトやクリック判定には参加させない。 */
.model-size-readout {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 6px 8px;
  border-radius: 4px;
  background: rgb(0 0 0 / 75%);
  color: white;
  font:
    12px/1.5 system-ui,
    sans-serif;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
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
.button-hit:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 3px;
}
.button-hit.keyboard-only {
  left: 50% !important;
  top: 50% !important;
  pointer-events: none;
}
</style>
