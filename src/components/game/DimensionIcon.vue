<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{ solid: boolean }>()
const progress = ref(props.solid ? 1 : 0)
let frame = 0

watch(
  () => props.solid,
  (solid) => {
    cancelAnimationFrame(frame)
    frame = 0
    const target = solid ? 1 : 0
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      progress.value = target
      return
    }
    const from = progress.value
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / 420))
      progress.value = from + (target - from) * t * t * (3 - 2 * t)
      frame = t < 1 ? requestAnimationFrame(tick) : 0
    }
    frame = requestAnimationFrame(tick)
  },
)
onBeforeUnmount(() => cancelAnimationFrame(frame))

// cube-dimension-toggleの等角投影と文字の面変換を移植。
type Point = readonly [number, number]
const points = (list: Point[]) => list.map((point) => point.join(',')).join(' ')
const shape = computed(() => {
  const t = progress.value
  const yaw = (t * Math.PI) / 4
  const pitch = t * Math.atan(1 / Math.sqrt(2))
  // 最初の縮小前の中心を固定し、2Dだけ一辺32へ縮小する。
  const size = 32 + (36 * 0.67 - 32) * t
  const u: Point = [size * Math.cos(yaw), size * Math.sin(yaw) * Math.sin(pitch)]
  const v: Point = [0, size * Math.cos(pitch)]
  const w: Point = [size * t * Math.sin(yaw), -size * t * Math.cos(yaw) * Math.sin(pitch)]
  // 一辺36だったときの中心(18, 46)を、2D・3Dともに維持する。
  const center: Point = [18, 46]
  const a: Point = [center[0] - (u[0] + v[0] + w[0]) / 2, center[1] - (u[1] + v[1] + w[1]) / 2]
  const f: [Point, Point, Point, Point] = [
    a,
    [a[0] + u[0], a[1] + u[1]],
    [a[0] + u[0] + v[0], a[1] + u[1] + v[1]],
    [a[0] + v[0], a[1] + v[1]],
  ]
  const back = (point: Point): Point => [point[0] + w[0], point[1] + w[1]]
  return {
    face: points(f),
    flatTextSize: (16 * 36) / size,
    top: points([f[0], back(f[0]), back(f[1]), f[1]]),
    side: points([f[1], back(f[1]), back(f[2]), f[2]]),
    textTransform: `matrix(${[u[0] / 36, u[1] / 36, v[0] / 36, v[1] / 36, a[0], a[1]].join(' ')})`,
  }
})
</script>

<template>
  <svg class="dimension-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <polygon class="dimension-top" :points="shape.top" :opacity="progress" />
    <polygon class="dimension-side" :points="shape.side" :opacity="progress" />
    <polygon class="dimension-face" :points="shape.face" />
    <g :transform="shape.textTransform" class="dimension-text">
      <text
        x="18"
        y="18"
        dy="0.31em"
        dominant-baseline="alphabetic"
        :font-size="shape.flatTextSize"
        :opacity="Math.max(0, 1 - progress * 2.5)"
      >
        2D
      </text>
      <text
        class="dimension-text-3d"
        x="18"
        y="18"
        dy="0.35em"
        dominant-baseline="alphabetic"
        :opacity="Math.max(0, (progress - 0.6) * 2.5)"
      >
        3D
      </text>
    </g>
  </svg>
</template>

<style scoped>
.dimension-icon {
  overflow: visible;
  pointer-events: none;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.dimension-top {
  fill: currentColor;
  fill-opacity: 0.06;
}
.dimension-side {
  fill: currentColor;
  fill-opacity: 0.12;
}
.dimension-text {
  fill: currentColor;
  stroke: none;
  font-family: system-ui, sans-serif;
  font-size: 16px;
  font-weight: 500;
  text-anchor: middle;
}
.dimension-text-3d {
  font-size: 18px;
}
</style>
