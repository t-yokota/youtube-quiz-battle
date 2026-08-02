<script setup lang="ts">
// ThemeSwitcher コンポーネント
// マルチタスク画面風のUI着せ替えスイッチャー。
// - useTheme() が検出した全テーマを横スクロールのカードとして表示（自動追加）
// - カードは ThemePreview の実DOMを [data-theme] スコープで縮小描画（画像不要）
// - タップでカード位置から全画面へズームしながらテーマを適用
import { nextTick, ref, watch } from 'vue'
import { useTheme, type ThemeInfo } from '@/composables/useTheme'
import ThemePreview from './ThemePreview.vue'

const props = defineProps<{ isOpen: boolean }>()

const emit = defineEmits<{
  close: []
}>()

const { themes, currentThemeId, setTheme } = useTheme()

const railRef = ref<HTMLElement | null>(null)

// ズーム演出レイヤーの状態
const zoomThemeId = ref<string | null>(null)
const zoomStyle = ref<Record<string, string>>({})
let zoomTimer: number | null = null

// プレビューの設計スペース（ThemePreview と一致させる）
const PREVIEW_W = 315
const PREVIEW_H = 700
// カード幅（px）。スケールは CSS 側で --card-scale として参照
const CARD_W = 148
const CARD_H = Math.round((PREVIEW_H * CARD_W) / PREVIEW_W)

// 開いたとき、現在テーマのカードを中央に寄せる
watch(
  () => props.isOpen,
  async (open) => {
    if (!open) return
    await nextTick()
    const rail = railRef.value
    const cur = rail?.querySelector<HTMLElement>(`[data-card='${currentThemeId.value}']`)
    if (rail && cur) {
      rail.scrollLeft = cur.offsetLeft - (rail.clientWidth - cur.offsetWidth) / 2
    }
  },
)

function pick(theme: ThemeInfo, event: MouseEvent) {
  const shell = (event.currentTarget as HTMLElement).querySelector<HTMLElement>('.card-shell')
  if (!shell || zoomThemeId.value !== null) return

  const rect = shell.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  // 全画面レイヤー内のプレビューを画面いっぱいに敷くカバースケール
  const coverScale = Math.max(vw / PREVIEW_W, vh / PREVIEW_H)

  // 1) レイヤーをカード位置・カードサイズに縮めて出現させる
  zoomThemeId.value = theme.id
  zoomStyle.value = {
    '--cover-scale': String(coverScale),
    transformOrigin: 'top left',
    transform: `translate(${rect.left}px, ${rect.top}px) scale(${rect.width / vw})`,
    borderRadius: '16px',
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
      <div v-if="isOpen" class="switcher-overlay" @click.self="emit('close')">
        <p class="switcher-title">UIをえらぶ</p>
        <p class="switcher-hint">横にスクロール · タップで適用</p>

        <div ref="railRef" class="rail">
          <button
            v-for="t in themes"
            :key="t.id"
            :data-card="t.id"
            type="button"
            class="card"
            :class="{ current: t.id === currentThemeId }"
            @click="pick(t, $event)"
          >
            <span
              class="card-shell"
              :data-theme="t.id"
              :style="{ width: CARD_W + 'px', height: CARD_H + 'px', '--card-scale': CARD_W / PREVIEW_W }"
            >
              <span class="card-scale"><ThemePreview /></span>
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
      <div class="zoom-fit"><ThemePreview /></div>
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
}

.switcher-title {
  margin: 1.5rem 0 0;
  color: rgba(255, 255, 255, 0.92);
  font-size: 0.8125rem;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.switcher-hint {
  margin: 0.25rem 0 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
}

/* カードカルーセル（中央スナップ） */
.rail {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 1.125rem;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  padding: 0 calc(50vw - 74px);
  scrollbar-width: none;
}

.rail::-webkit-scrollbar {
  display: none;
}

.card {
  scroll-snap-align: center;
  flex-shrink: 0;
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
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 0.875rem 2.125rem rgba(0, 0, 0, 0.55);
  outline: 2px solid rgba(255, 255, 255, 0.15);
  background: #000;
}

.card.current .card-shell {
  outline: 2.5px solid rgba(255, 255, 255, 0.9);
}

/* プレビュー実DOM（315×700）をカードサイズへ縮小 */
.card-scale {
  display: block;
  width: 315px;
  height: 700px;
  transform: scale(var(--card-scale));
  transform-origin: top left;
}

.card-label {
  font-size: 0.6875rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.04em;
}

.switcher-dismiss {
  margin: 0 0 1.375rem;
  padding: 0.375rem 0.875rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.625rem;
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
  left: 50%;
  top: 50%;
  width: 315px;
  height: 700px;
  transform: translate(-50%, -50%) scale(var(--cover-scale, 1));
}
</style>
