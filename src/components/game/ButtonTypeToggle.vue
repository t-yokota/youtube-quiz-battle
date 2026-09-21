<script setup lang="ts">
import type { ButtonModelId } from '@/constants/button'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelId: ButtonModelId
    disabled?: boolean
    decorative?: boolean
    displaySize?: number
  }>(),
  { displaySize: 32 },
)
const emit = defineEmits<{ toggle: [] }>()
const rotor = ref<HTMLElement>()
const displayedBox = ref(props.modelId === 'waseda-style-v1')
const rotating = ref(false)
const preparing = ref(false)
let frame = 0
let generation = 0
let finishTimer: ReturnType<typeof setTimeout> | undefined
function finishRotation() {
  clearTimeout(finishTimer)
  rotating.value = false
  preparing.value = false
}
watch(
  () => props.modelId,
  async (id) => {
    const current = ++generation
    clearTimeout(finishTimer)
    cancelAnimationFrame(frame)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      displayedBox.value = id === 'waseda-style-v1'
      finishRotation()
      return
    }
    if (rotating.value && !preparing.value) {
      displayedBox.value = id === 'waseda-style-v1'
      finishTimer = setTimeout(finishRotation, 750)
      return
    }
    // 静止→3D復帰自体はアニメーションさせない。開始姿勢を1フレーム描いてから
    // 目標角度へ遷移し、noneからの補間や早すぎるtransitionendを防ぐ。
    preparing.value = true
    rotating.value = true
    await nextTick()
    if (current !== generation) return
    void rotor.value?.offsetWidth
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (current !== generation) return
        preparing.value = false
        displayedBox.value = id === 'waseda-style-v1'
        finishTimer = setTimeout(finishRotation, 750)
      })
    })
  },
)
onBeforeUnmount(() => {
  generation++
  clearTimeout(finishTimer)
  cancelAnimationFrame(frame)
})

// 提供素材を基に各モデルの投影輪郭を描き、直交する2面を回転させる。
// 丸型の仰角。横径は固定し、奥行きはsin、垂直方向はcosで投影する。
const roundElevation = (55 * Math.PI) / 180
const roundDepth = Math.sin(roundElevation)
const roundHeight = Math.cos(roundElevation) / Math.sqrt(1 - (13 / 24) ** 2)
const roundBaseY = 43
const roundBaseRy = 24 * roundDepth
const roundBaseThickness = 6 * roundHeight
const roundCapY = roundBaseY - 13 * roundHeight
const roundCapRy = 17 * roundDepth
const roundViewBoxY =
  (roundCapY - roundCapRy + roundBaseY + roundBaseRy + roundBaseThickness) / 2 - 32

const faces = computed(() =>
  [false, true].map((box) => {
    // 箱型の1.1倍拡大を含め、表示上の0.5pxをSVG座標へ換算する。
    const boxSideGrowth = (64 * 0.5) / props.displaySize / 1.1
    const point = (angle: number) => {
      const c = Math.cos(angle),
        s = Math.sin(angle)
      return box
        ? [
            32 + 18 * Math.sign(c) * Math.abs(c) ** 0.3,
            40 - boxSideGrowth + 14 * Math.sign(s) * Math.abs(s) ** 0.3,
          ]
        : [32 + 24 * c, roundBaseY + roundBaseRy * s]
    }
    const contour = Array.from({ length: 64 }, (_, i) => point((i * Math.PI) / 32))
    const front = Array.from({ length: 33 }, (_, i) => point((i * Math.PI) / 32))
    // 箱型の上面だけを上げ、側面を同量伸ばすことで底面の座標を維持する。
    const lower = front
      .map(([x, y]) => [x!, y! + (box ? 7 + boxSideGrowth : roundBaseThickness)])
      .reverse()
    const cy = box ? 13 : roundCapY,
      rx = box ? 11 : 17,
      // 台座と押し面を同じ角度で投影し、側面の厚さも連動させる。
      ry = box ? 4 : roundCapRy,
      h = box ? 19 : 6 * roundHeight
    return {
      box,
      cy,
      rx,
      ry,
      base:
        'M' +
        front.map((p) => p.join(' ')).join(' L') +
        ' L' +
        lower.map((p) => p.join(' ')).join(' L') +
        ' Z',
      contour: contour.map((p) => p.join(',')).join(' '),
      cap: `M ${32 - rx} ${cy} V ${cy + h} A ${rx} ${ry} 0 0 0 ${32 + rx} ${cy + h} V ${cy} Z`,
      ribs: [1, 2, 3].map(
        (i) =>
          `M ${32 - rx} ${cy + (h * i) / 4} A ${rx} ${ry} 0 0 0 ${32 + rx} ${cy + (h * i) / 4}`,
      ),
    }
  }),
)
</script>

<template>
  <component
    :is="decorative ? 'span' : 'button'"
    type="button"
    class="button-type-toggle"
    :disabled="disabled"
    :aria-label="modelId === 'simple-round-v1' ? '箱型（大ランプ）に切り替え' : '丸型に切り替え'"
    @click.stop="emit('toggle')"
  >
    <span class="type-artwork" :class="{ 'is-static': !rotating }" aria-hidden="true">
      <span
        ref="rotor"
        class="type-rotor"
        :class="{ box: displayedBox, preparing }"
        @transitionend.self="!preparing && finishRotation()"
      >
        <span
          v-for="face in faces"
          :key="String(face.box)"
          class="type-face"
          :class="{ box: face.box }"
        >
          <!-- 丸型は投影後の上下端を中央へ合わせる。
               箱型は底面と従来のviewBoxを維持し、台座の側面を上へ0.5px厚くする。 -->
          <svg
            :viewBox="face.box ? '0 0.4 64 64' : `0 ${roundViewBoxY} 64 64`"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <g :transform="face.box ? 'translate(32 61) scale(1.1) translate(-32 -61)' : undefined">
              <path :d="face.base" :stroke-width="face.box ? 1.98 : undefined" />
              <polygon :points="face.contour" :stroke-width="face.box ? 1.98 : undefined" />
              <path :d="face.cap" :stroke="face.box ? 'none' : undefined" />
              <template v-if="face.box">
                <!-- 箱型は台座・ランプ・小ボタンを含め、元の線幅から10%細くする。 -->
                <path
                  :d="`M${32 - face.rx} ${face.cy} V32 M${32 + face.rx} ${face.cy} V32`"
                  fill="none"
                  stroke-width="1.98"
                />
                <path
                  :d="`M${32 - face.rx} 32 A${face.rx} 4 0 0 0 ${32 + face.rx} 32`"
                  fill="none"
                  stroke-width="1.98"
                />
              </template>
              <ellipse
                cx="32"
                :cy="face.cy"
                :rx="face.rx"
                :ry="face.ry"
                :stroke-width="face.box ? 1.98 : undefined"
              />
              <template v-if="face.box">
                <path
                  v-for="rib in face.ribs"
                  :key="rib"
                  :d="rib"
                  fill="none"
                  stroke-width="1.44"
                />
                <path d="M28.3 42 V46 A3.7 1.8 0 0 0 35.7 46 V42 Z" stroke="none" />
                <path d="M28.3 42 V46 M35.7 42 V46" fill="none" stroke-width="1.98" />
                <path d="M28.3 46 A3.7 1.8 0 0 0 35.7 46" fill="none" stroke-width="1.98" />
                <ellipse cx="32" cy="42" rx="3.7" ry="1.8" stroke-width="1.98" />
              </template>
            </g>
          </svg>
        </span>
      </span>
    </span>
  </component>
</template>

<style scoped>
.button-type-toggle {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-text-dim);
  cursor: pointer;
}
.button-type-toggle:disabled {
  cursor: default;
}
.button-type-toggle:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
.type-artwork {
  --type-icon-size: var(--button-type-icon-size, 32px);
  width: var(--type-icon-size);
  height: var(--type-icon-size);
  perspective: calc(var(--type-icon-size) * 5);
  position: relative;
}
.type-rotor {
  display: block;
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  transform: translateZ(calc(var(--type-icon-size) * -0.5)) rotateY(0deg);
  transition: transform 640ms ease-in-out;
}
.type-rotor.box {
  transform: translateZ(calc(var(--type-icon-size) * -0.5)) rotateY(-90deg);
}
.type-rotor.preparing {
  transition: none;
}
.type-face {
  position: absolute;
  inset: 0;
  display: block;
  background: var(--surface-app);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transform: translateZ(calc(var(--type-icon-size) * 0.5));
}
.type-face.box {
  transform: rotateY(90deg) translateZ(calc(var(--type-icon-size) * 0.5));
}
.type-face svg {
  width: 100%;
  height: 100%;
  display: block;
  fill: var(--surface-app);
}
.type-artwork.is-static {
  perspective: none;
}
.is-static .type-rotor {
  transform: none;
  transform-style: flat;
  transition: none;
}
.is-static .type-face {
  transform: none;
  backface-visibility: visible;
  -webkit-backface-visibility: visible;
}
.is-static .type-rotor:not(.box) .type-face.box,
.is-static .type-rotor.box .type-face:not(.box) {
  display: none;
}
@media (prefers-reduced-motion: reduce) {
  .type-rotor {
    transition: none;
  }
}
</style>
