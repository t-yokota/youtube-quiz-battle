<script setup lang="ts">
// ThemeSwitcher コンポーネント
// マルチタスク画面風のUI着せ替えスイッチャー。
// - useTheme() が検出した全テーマを2列グリッドのカードとして表示（自動追加）
// - カードは ThemePreview の実DOMを [data-theme] スコープで縮小描画（画像不要）
// - タップでカード位置から全画面へズームしながらテーマを適用
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { useTheme, type ThemeInfo } from '@/composables/useTheme'
import { calculateCardGeometry, calculateHeadingPlacement } from './themeSwitcherLayout'
import ThemePreview from './ThemePreview.vue'

const props = defineProps<{ isOpen: boolean }>()

const emit = defineEmits<{
  close: []
}>()

const { themes, currentThemeId, setTheme } = useTheme()

const overlayRef = ref<HTMLElement | null>(null)
const railRef = ref<HTMLElement | null>(null)
const headingRef = ref<HTMLElement | null>(null)
const safeAreaProbeRef = ref<HTMLElement | null>(null)
const headingTop = ref(0)
const isHeadingVisible = ref(false)

const HEADING_CARD_GAP = 12
const HEADING_SAFE_PADDING = 8
const CARD_BORDER_RADIUS = 10
const cardWidth = ref(148)
const cardHeight = ref(329)
const cardPreviewScale = ref(148 / 315)
const previewWidth = ref(315)
const previewHeight = ref(700)
let activeVisualViewport: VisualViewport | null = null
let hasViewportListeners = false

// ズーム演出レイヤーの状態
const zoomThemeId = ref<string | null>(null)
const zoomStyle = ref<Record<string, string>>({})
let zoomTimer: number | null = null

function updateCardGeometry() {
  const overlayRect = overlayRef.value?.getBoundingClientRect()
  const geometry = calculateCardGeometry({
    viewportWidth:
      overlayRect && overlayRect.width > 0
        ? overlayRect.width
        : (window.visualViewport?.width ?? window.innerWidth),
    viewportHeight:
      overlayRect && overlayRect.height > 0
        ? overlayRect.height
        : (window.visualViewport?.height ?? window.innerHeight),
  })
  cardWidth.value = geometry.width
  cardHeight.value = geometry.height
  previewWidth.value = geometry.previewWidth
  previewHeight.value = geometry.previewHeight
  cardPreviewScale.value = geometry.previewScale
}

function updateHeadingPosition() {
  if (!props.isOpen) return

  const overlay = overlayRef.value
  const heading = headingRef.value
  const safeAreaProbe = safeAreaProbeRef.value
  const rail = railRef.value
  const card = rail?.querySelector<HTMLElement>('.card-shell')
  if (!overlay || !heading || !safeAreaProbe || !rail || !card) return

  const overlayTop = overlay.getBoundingClientRect().top
  // 縦スクロールしても見出し位置が動かないよう、先頭行の未スクロール位置を使う。
  const cardTop = card.getBoundingClientRect().top - overlayTop + rail.scrollTop
  const headingHeight = heading.getBoundingClientRect().height
  const safeAreaTop = safeAreaProbe.getBoundingClientRect().height
  const viewportTop = Math.max(0, (window.visualViewport?.offsetTop ?? 0) - overlayTop)
  const placement = calculateHeadingPlacement({
    viewportTop,
    cardTop,
    headingHeight,
    safeAreaTop,
    viewportPadding: HEADING_SAFE_PADDING,
    cardGap: HEADING_CARD_GAP,
  })

  headingTop.value = placement.top
  isHeadingVisible.value = placement.visible
}

function handleViewportResize() {
  updateCardGeometry()
  void nextTick(updateHeadingPosition)
}

function addViewportListeners() {
  if (hasViewportListeners) return
  hasViewportListeners = true
  activeVisualViewport = window.visualViewport
  window.addEventListener('resize', handleViewportResize)
  activeVisualViewport?.addEventListener('resize', handleViewportResize)
}

function removeViewportListeners() {
  if (!hasViewportListeners) return
  hasViewportListeners = false
  window.removeEventListener('resize', handleViewportResize)
  activeVisualViewport?.removeEventListener('resize', handleViewportResize)
  activeVisualViewport = null
}

// 開いたとき、現在テーマの行を先頭行の基準位置へ合わせて見出し位置を実測する
watch(
  () => props.isOpen,
  async (open) => {
    isHeadingVisible.value = false
    if (!open) {
      removeViewportListeners()
      return
    }
    updateCardGeometry()
    await nextTick()
    if (!props.isOpen) return
    updateCardGeometry()
    await nextTick()
    if (!props.isOpen) return
    const rail = railRef.value
    const firstCard = rail?.querySelector<HTMLElement>('.card')
    const currentCard = rail?.querySelector<HTMLElement>(`[data-card='${currentThemeId.value}']`)
    if (rail && firstCard && currentCard) {
      rail.scrollTop = Math.max(0, currentCard.offsetTop - firstCard.offsetTop)
    }
    updateHeadingPosition()
    addViewportListeners()
  },
  { immediate: true },
)

onUnmounted(() => {
  removeViewportListeners()
})

function pick(theme: ThemeInfo, event: MouseEvent) {
  const shell = (event.currentTarget as HTMLElement).querySelector<HTMLElement>('.card-shell')
  if (!shell || zoomThemeId.value !== null) return

  const rect = shell.getBoundingClientRect()
  const overlayRect = overlayRef.value?.getBoundingClientRect()
  const viewportLeft = overlayRect?.left ?? 0
  const viewportTop = overlayRect?.top ?? 0
  const initialScale = rect.width / previewWidth.value
  // 1) レイヤーをカード位置・カードサイズに縮めて出現させる
  zoomThemeId.value = theme.id
  zoomStyle.value = {
    transformOrigin: 'top left',
    transform: `translate(${rect.left - viewportLeft}px, ${rect.top - viewportTop}px) scale(${initialScale})`,
    borderRadius: `${CARD_BORDER_RADIUS / initialScale}px`,
    transition: 'none',
  }

  // 2) 次フレームで等倍へ遷移 → カードが画面全体に迫る
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      zoomStyle.value = {
        ...zoomStyle.value,
        transform: 'translate(0px, 0px) scale(1)',
        borderRadius: '0px',
        transition:
          'transform 450ms cubic-bezier(0.22, 1, 0.36, 1), border-radius 450ms cubic-bezier(0.22, 1, 0.36, 1)',
      }
    })
  })

  // 3) 遷移完了後に実テーマを適用してスイッチャーを閉じ、レイヤーを剥がす
  if (zoomTimer !== null) window.clearTimeout(zoomTimer)
  zoomTimer = window.setTimeout(() => {
    setTheme(theme.id)
    emit('close')
    window.setTimeout(() => {
      zoomThemeId.value = null
    }, 80)
    zoomTimer = null
  }, 470)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="switcher-fade">
      <div
        v-if="isOpen"
        ref="overlayRef"
        class="switcher-overlay"
        :style="{ '--card-width': cardWidth + 'px' }"
        @click="emit('close')"
      >
        <span ref="safeAreaProbeRef" class="safe-area-probe" aria-hidden="true"></span>
        <div
          ref="headingRef"
          class="switcher-heading"
          :style="{ top: headingTop + 'px', visibility: isHeadingVisible ? 'visible' : 'hidden' }"
        >
          <p class="switcher-title">UIをえらぶ</p>
          <p class="switcher-hint">上下にスクロール · タップで適用</p>
        </div>

        <div ref="railRef" class="rail">
          <button
            v-for="t in themes"
            :key="t.id"
            :data-card="t.id"
            type="button"
            class="card"
            :class="{ current: t.id === currentThemeId }"
            @click.stop="pick(t, $event)"
          >
            <span
              class="card-shell"
              :data-theme="t.id"
              :style="{
                width: cardWidth + 'px',
                height: cardHeight + 'px',
                borderRadius: CARD_BORDER_RADIUS + 'px',
              }"
            >
              <span
                class="card-scale"
                :style="{
                  width: previewWidth + 'px',
                  height: previewHeight + 'px',
                  '--card-preview-scale': cardPreviewScale,
                }"
              >
                <ThemePreview :preview-width="previewWidth" :preview-height="previewHeight" />
              </span>
            </span>
            <span class="card-label">{{ t.label }}</span>
          </button>
        </div>

        <p class="switcher-dismiss">背景タップで閉じる</p>
      </div>
    </Transition>
  </Teleport>

  <!-- ズーム演出レイヤー（選択カード → 全画面） -->
  <Teleport to="body">
    <div v-if="zoomThemeId" class="zoom-layer" :data-theme="zoomThemeId" :style="zoomStyle">
      <div class="zoom-fit" :style="{ width: previewWidth + 'px', height: previewHeight + 'px' }">
        <ThemePreview :preview-width="previewWidth" :preview-height="previewHeight" />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.switcher-overlay {
  position: fixed;
  inset: 0;
  z-index: 2500;
  background: rgba(6, 8, 16, 0.6);
  backdrop-filter: blur(14px);
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  /* 絶対配置へ移した見出しの旧フロー領域を保ち、カードの縦位置を維持する */
  padding-top: 3.5625rem;
}

.safe-area-probe {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: env(safe-area-inset-top, 0px);
  visibility: hidden;
  pointer-events: none;
}

.switcher-heading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1;
  text-align: center;
  pointer-events: none;
}

.switcher-title {
  margin: 0;
  color: rgba(255, 255, 255, 0.92);
  font-size: max(15px, calc(0.8125 * var(--ui-font-unit)));
  font-weight: 800;
  letter-spacing: 0.12em;
}

.switcher-hint {
  margin: 0.25rem 0 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: max(12px, calc(0.6875 * var(--ui-font-unit)));
  letter-spacing: 0.04em;
}

/* 2列のカードグリッド（一覧部分だけを縦スクロール） */
.rail {
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, var(--card-width));
  grid-auto-rows: max-content;
  justify-content: center;
  align-content: start;
  gap: 1.125rem;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  box-sizing: border-box;
  padding: 6rem 1rem 1rem;
  scrollbar-width: none;
}

.rail::-webkit-scrollbar {
  display: none;
}

.card {
  width: var(--card-width);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.625rem;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.card-shell {
  display: block;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0.875rem 2.125rem rgba(0, 0, 0, 0.55);
  outline: 2px solid rgba(255, 255, 255, 0.15);
  background: #000;
}

.card.current .card-shell {
  outline: 2.5px solid rgba(255, 255, 255, 0.9);
}

/* viewport寸法で再レイアウトしたプレビューをカードサイズへ均等縮小 */
.card-scale {
  position: absolute;
  left: 0;
  top: 0;
  display: block;
  transform: scale(var(--card-preview-scale));
  transform-origin: top left;
}

.card-label {
  font-size: calc(0.6875 * var(--ui-font-unit));
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.04em;
}

.switcher-dismiss {
  margin: 0.75rem 0 1.375rem;
  padding: 0.375rem 0.875rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.6);
  font-size: calc(0.625 * var(--ui-font-unit));
  letter-spacing: 0.06em;
}

.switcher-fade-enter-active,
.switcher-fade-leave-active {
  transition: opacity 0.3s;
}

.switcher-fade-enter-from,
.switcher-fade-leave-to {
  opacity: 0;
}

/* ズーム演出レイヤー */
.zoom-layer {
  position: fixed;
  inset: 0;
  z-index: 3000;
  overflow: hidden;
  background: var(--surface-app);
  will-change: transform;
}

.zoom-fit {
  position: absolute;
  left: 0;
  top: 0;
}
</style>
