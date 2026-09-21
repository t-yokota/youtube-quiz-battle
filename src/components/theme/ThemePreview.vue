<script setup lang="ts">
// ThemePreview コンポーネント
// スイッチャーのカードに表示する「問題中（早押し可）」画面の代表イメージ。
// 見た目の設定をpropsで受け取り、実ストア・実プレイヤーに依存せず描画する。
// 3D画像は実モデルから生成し、同じ寸法のカード間で共有する。
// スタイルはすべてテーマトークン参照 → 親の [data-theme] だけで任意テーマの見た目になる。
// 新テーマ追加時にこのファイルの変更は不要。
import { ref } from 'vue'
import { defaultButton, type ButtonSettings } from '@/constants/button'
import DimensionIcon from '@/components/game/DimensionIcon.vue'
import { useButtonPreviewImage } from './useButtonPreviewImage'
import SettingsIcon from '@/components/common/SettingsIcon.vue'
import ScoreCounts from '@/components/game/ScoreCounts.vue'
import ButtonTypeToggle from '@/components/game/ButtonTypeToggle.vue'

interface Props {
  desktop?: boolean
  previewWidth?: number
  previewHeight?: number
  buttonSettings?: ButtonSettings
  buttonCheckEnabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  previewWidth: 315,
  previewHeight: 700,
  buttonSettings: () => ({ ...defaultButton }),
  buttonCheckEnabled: true,
})
const threeHost = ref<HTMLElement>()
const buttonImage = useButtonPreviewImage(
  threeHost,
  () => props.buttonSettings,
  () => !!props.desktop,
)
</script>

<template>
  <div
    class="preview"
    :class="{
      'preview-desktop': desktop,
      'preview-desktop-narrow': desktop && previewWidth < 1200,
    }"
    :style="{
      width: `${previewWidth}px`,
      height: `${previewHeight}px`,
      '--preview-height': `${previewHeight}px`,
    }"
    aria-hidden="true"
  >
    <!-- ヘッダー -->
    <div class="p-header">
      <span class="p-wordmark">YouTube <span class="p-accent">Quiz Battle</span></span>
      <span class="p-settings-button"><SettingsIcon class="p-gear" /></span>
    </div>

    <!-- 動画プレイヤー（プレースホルダ） -->
    <div class="p-video">
      <span class="p-play">▶</span>
    </div>

    <!-- スコアボード -->
    <div class="p-sidebar">
      <div class="p-scoreboard">
        <h2 v-if="desktop">QUESTION</h2>
        <span class="p-progress"
          ><span class="p-q">Q</span>03<span class="p-total"> / 05</span></span
        >
        <template v-if="desktop">
          <h2>SCORE</h2>
          <ScoreCounts :correct="1" :incorrect="1" />
        </template>
        <span v-else class="p-chips">
          <svg viewBox="0 0 16 16" class="p-chip ok">
            <circle cx="8" cy="8" r="7.25" class="ring" />
            <circle cx="8" cy="8" r="3.4" fill="none" class="mk" />
          </svg>
          <svg viewBox="0 0 16 16" class="p-chip ng">
            <circle cx="8" cy="8" r="7.25" class="ring" />
            <path
              d="M5.3 5.3 L10.7 10.7 M10.7 5.3 L5.3 10.7"
              fill="none"
              stroke-linecap="round"
              class="mk"
            />
          </svg>
          <svg viewBox="0 0 16 16" class="p-chip cur">
            <circle cx="8" cy="8" r="7.25" class="ring" />
          </svg>
          <svg viewBox="0 0 16 16" class="p-chip">
            <circle cx="8" cy="8" r="7.25" class="ring" />
          </svg>
          <svg viewBox="0 0 16 16" class="p-chip">
            <circle cx="8" cy="8" r="7.25" class="ring" />
          </svg>
        </span>
      </div>
      <div v-if="desktop" class="p-results">
        <h2>RESULTS</h2>
        <div class="p-result-row">
          <span class="p-result-correct">○</span
          ><span>正解例 1<br /><small>あなた: 正解例 1</small></span
          ><small>Q1</small>
        </div>
        <div class="p-result-row">
          <span class="p-result-wrong">×</span
          ><span>正解例 2<br /><small>あなた: 誤答例</small></span
          ><small>Q2</small>
        </div>
        <div class="p-result-row">
          <span class="p-q">○</span><span>出題中</span><small>Q3</small>
        </div>
      </div>
    </div>

    <!-- ゲームUI -->
    <div class="p-game">
      <!-- 解答パネル（入力はまだ無効） -->
      <div class="p-panel">
        <div class="p-meta">
          {{ desktop ? '解答残り' : '残り' }} 3回<span class="p-dim"> / 3</span>
        </div>
        <div v-if="!desktop" class="p-input-row">
          <span class="p-input">解答を入力</span>
          <span class="p-submit">送信</span>
        </div>
      </div>

      <!-- 早押しボタン領域（実画面と同じくトグルを内包） -->
      <div class="p-button-container">
        <div class="p-button-area">
          <div
            ref="threeHost"
            class="p-three"
            :class="{ 'is-round': buttonSettings.modelId === 'simple-round-v1' }"
          >
            <img v-if="buttonImage" :src="buttonImage" alt="" class="p-three-image" />
          </div>
          <template v-if="!buttonImage">
            <span class="p-pedestal"></span>
            <span class="p-quiz-button">PUSH</span>
          </template>
        </div>

        <span class="p-view-controls">
          <ButtonTypeToggle
            v-if="buttonImage"
            :model-id="buttonSettings.modelId"
            :display-size="desktop ? 40 : 32"
            decorative
          />
          <span class="p-dimension">
            <DimensionIcon
              :key="buttonImage ? '3d' : '2d'"
              :solid="!!buttonImage"
              :display-size="desktop ? 56 : 44"
            />
          </span>
        </span>
        <!-- BUTTON CHECK トグル -->
        <span v-if="desktop" class="p-key-hint"><kbd>Space</kbd> でボタンを押す</span>
        <div class="p-toggle-row">
          <span class="p-toggle-label">BUTTON CHECK</span>
          <span class="p-toggle" :class="{ off: !buttonCheckEnabled }"
            ><span class="p-toggle-state">{{ buttonCheckEnabled ? 'ON' : 'OFF' }}</span
            ><span class="p-toggle-knob"></span
          ></span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.p-sidebar {
  display: contents;
}
/* 親から受けたviewport寸法で実画面と同様にレイアウトし、カード側で均等縮小する */
.preview {
  display: flex;
  flex-direction: column;
  background: var(--surface-app);
  color: var(--color-text-main);
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    sans-serif;
  overflow: hidden;
  user-select: none;
  pointer-events: none;
  text-align: left;
}

/* ヘッダー */
.p-header {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.625rem 0.75rem 0.5rem;
  border-bottom: 1px solid var(--color-line);
  background: var(--header-bg);
}

.p-wordmark {
  font-weight: 800;
  font-size: calc(0.8125 * var(--ui-font-unit));
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.p-accent {
  color: var(--color-accent);
}

.p-settings-button {
  width: max(44px, 2.75rem);
  height: max(44px, 2.75rem);
  margin: -0.625rem calc((max(44px, 2.75rem) - 1.5rem) / -2) -0.625rem 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.p-gear {
  width: 1.5rem;
  height: 1.5rem;
  color: var(--color-text-dim);
}

/* 動画プレースホルダ（全テーマ共通で黒。実プレイヤーの代役） */
.p-video {
  flex-shrink: 0;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-bottom: 1px solid var(--color-line);
  background: repeating-linear-gradient(45deg, #0f0f15 0 12px, #14141b 12px 24px);
  display: grid;
  place-items: center;
}

.p-play {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.75);
  font-size: 14px;
  padding-left: 3px;
}

/* スコアボード */
.p-scoreboard {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.625rem 0.875rem;
  background: var(--surface-panel);
  border-bottom: 1px solid var(--color-line);
}

.p-progress {
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  font-size: calc(1.0625 * var(--ui-font-unit));
  letter-spacing: 0.04em;
}

.p-q {
  font-size: calc(0.9375 * var(--ui-font-unit));
  color: var(--color-accent);
  letter-spacing: 0.2em;
  margin-right: 0.2rem;
}

.p-total {
  color: var(--color-text-dim);
  font-size: calc(0.75 * var(--ui-font-unit));
  font-weight: 600;
}

.p-chips {
  --preview-chip-unit: var(--ui-width-unit);
  display: flex;
  align-items: center;
  gap: calc(0.3125 * var(--preview-chip-unit));
}

.p-chip {
  width: var(--preview-chip-unit);
  height: var(--preview-chip-unit);
  display: block;
}

.p-chip .ring {
  fill: var(--chip-bg);
  stroke: var(--color-line);
}

.p-chip.ok .ring {
  fill: var(--chip-correct-bg);
  stroke: var(--color-answer-correct);
}

.p-chip.ok .mk {
  stroke: var(--color-answer-correct);
  stroke-width: 1.4;
}

.p-chip.ng .ring {
  fill: var(--chip-wrong-bg);
  stroke: var(--color-answer-wrong);
}

.p-chip.ng .mk {
  stroke: var(--color-answer-wrong);
  stroke-width: 1.4;
}

.p-chip.cur .ring {
  stroke: var(--color-accent);
}

/* ゲームUI */
.p-game {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 0.875rem 0.75rem;
  min-height: 0;
  position: relative;
}

.p-game::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--spotlight-glow);
  pointer-events: none;
}

/* 解答パネル */
.p-panel {
  flex-shrink: 0;
  background: var(--surface-panel);
  border: var(--panel-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--panel-shadow);
  padding: 0.75rem 0.875rem;
  min-height: 6.875rem;
  gap: 0.5rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
}

.p-meta {
  font-size: calc(0.8 * var(--ui-font-unit));
  font-weight: 700;
  color: var(--color-info);
  padding: 0 0.25rem;
}

.p-dim {
  color: var(--color-text-dim);
  font-weight: 500;
}

.p-input-row {
  display: flex;
  gap: 0.5rem;
}

.p-input {
  flex: 1;
  min-width: 0;
  height: max(36px, 2.5rem);
  padding: 0 0.875rem;
  font-size: max(16px, var(--ui-font-unit));
  color: var(--color-placeholder);
  background: var(--input-bg);
  border: 2px solid var(--input-border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--input-shadow);
  display: flex;
  align-items: center;
  opacity: 0.45;
}

.p-submit {
  height: max(36px, 2.5rem);
  min-width: max(36px, 2.5rem);
  padding: 0 1rem;
  font-size: calc(0.9375 * var(--ui-font-unit));
  font-weight: 800;
  color: var(--color-text-dim);
  background: var(--surface-raised);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* 早押しボタン */
.p-button-container {
  --icon-hit-offset: 9.625px;
  flex: 1;
  min-height: 9rem;
  display: flex;
  flex-direction: column;
  position: relative;
}

.p-button-area {
  container-type: size;
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  position: relative;
}

.p-pedestal {
  --button-unit: min(1rem, calc(100cqh / 12.25), calc(100cqw / 12.25));
  grid-area: 1 / 1;
  width: calc(12.25 * var(--button-unit));
  height: calc(12.25 * var(--button-unit));
  border-radius: 50%;
  background: var(--pedestal-bg);
  border: var(--pedestal-border);
  box-shadow: var(--pedestal-shadow);
}

.p-quiz-button {
  --button-unit: min(1rem, calc(100cqh / 12.25), calc(100cqw / 12.25));
  grid-area: 1 / 1;
  width: calc(9.375 * var(--button-unit));
  height: calc(9.375 * var(--button-unit));
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: calc(1.1875 * var(--ui-font-unit));
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--quiz-btn-text);
  text-shadow: var(--quiz-btn-text-shadow);
  background: var(--quiz-btn-face);
  box-shadow: var(--quiz-btn-shadow);
  z-index: 1;
}

/* BUTTON CHECK トグル */
.p-toggle-row {
  --preview-toggle-unit: var(--ui-font-unit);
  flex-shrink: 0;
  align-self: flex-end;
  display: flex;
  align-items: center;
  gap: calc(0.4 * var(--preview-toggle-unit));
}

.p-toggle-label {
  font-size: calc(0.625 * var(--ui-font-unit));
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--color-text-dim);
}

.p-toggle {
  position: relative;
  width: calc(2.75 * var(--preview-toggle-unit));
  height: calc(1.25 * var(--preview-toggle-unit));
  border-radius: 999px;
  background: var(--toggle-on-track);
  border: 1px solid var(--toggle-on-border);
  box-shadow: var(--toggle-on-track-shadow, var(--toggle-track-shadow));
}

.p-toggle-state {
  position: absolute;
  left: calc(0.3125 * var(--preview-toggle-unit));
  top: 50%;
  transform: translateY(-50%);
  font-size: calc(0.5 * var(--ui-font-unit));
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--color-accent);
}

.p-toggle-knob {
  position: absolute;
  top: 50%;
  right: calc(0.125 * var(--preview-toggle-unit));
  transform: translateY(-50%);
  width: calc(0.9375 * var(--preview-toggle-unit));
  height: calc(0.9375 * var(--preview-toggle-unit));
  border-radius: 50%;
  background: var(--toggle-on-knob);
}

/* 実画面と同じく、短いviewportではボタン寸法ではなく周囲の余白を詰める */
@media (max-height: 640px) {
  .p-game {
    gap: 0.625rem;
    padding: 0.625rem 0.75rem;
  }
}

.p-three {
  position: absolute;
  inset: 0 10%;
}
.p-three.is-round {
  inset-inline: 20%;
}
.p-three-image {
  display: block;
  width: 100%;
  height: 100%;
}
.p-view-controls {
  --view-control-step: 41px;
  position: absolute;
  left: 0;
  bottom: 0;
  width: 0;
  height: 0;
}
.p-view-controls .button-type-toggle {
  position: absolute;
  left: calc(-1 * var(--icon-hit-offset));
  bottom: calc(var(--view-control-step) - var(--icon-hit-offset));
}
.preview-desktop .p-view-controls .button-type-toggle {
  --button-type-icon-size: 40px;
}
.preview-desktop .p-view-controls {
  --view-control-step: 53px;
  left: 4px;
  bottom: 4px;
}
.p-dimension {
  position: absolute;
  left: calc(-1 * var(--icon-hit-offset));
  bottom: calc(-1 * var(--icon-hit-offset));
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  color: var(--color-text-dim);
}
.p-dimension :deep(svg) {
  transform: translate(var(--icon-hit-offset), calc(-1 * var(--icon-hit-offset)));
}
.preview-desktop .p-dimension :deep(svg) {
  --dimension-stroke-width: 1.5714286;
  width: 56px;
  height: 56px;
  transform: translate(
    calc(var(--icon-hit-offset) + 2.625px),
    calc(-1 * var(--icon-hit-offset) - 2.625px)
  );
}
.p-toggle.off {
  background: var(--toggle-track);
  border-color: var(--toggle-track-border);
  box-shadow: var(--toggle-track-shadow);
}
.p-toggle.off .p-toggle-state {
  left: auto;
  right: calc(0.3125 * var(--preview-toggle-unit));
  color: var(--color-text-dim);
}
.p-toggle.off .p-toggle-knob {
  right: auto;
  left: calc(0.125 * var(--preview-toggle-unit));
  background: var(--toggle-knob);
}
</style>

<style scoped>
/* カードの縮尺ではなく、元のviewportでPCの代表配置を描画する。 */
.preview-desktop {
  --preview-sidebar-space: 480px;
  --preview-video-width: clamp(
    640px,
    min(60%, calc((var(--preview-height) - 3.5rem) * 13 / 25 * 16 / 9)),
    calc(100% - var(--preview-sidebar-space))
  );
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--preview-video-width) minmax(0, 1fr);
  grid-template-rows: 3.5rem auto minmax(16rem, 1fr);
}
.preview-desktop-narrow {
  --preview-sidebar-space: 240px;
  grid-template-columns: 0 var(--preview-video-width) minmax(240px, 1fr);
}
.preview-desktop .p-header {
  grid-column: 1 / -1;
  grid-row: 1;
}
.preview-desktop .p-video {
  grid-column: 2;
  grid-row: 2;
}
.preview-desktop .p-game {
  grid-column: 2;
  grid-row: 3;
  border-inline: 1px solid var(--color-line);
  padding: 0.625rem 0.875rem;
}
.preview-desktop .p-sidebar {
  grid-column: 3;
  grid-row: 2 / 4;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 0.875rem;
  min-width: 0;
  overflow: hidden;
  border-left: 1px solid var(--color-line);
}
.preview-desktop h2 {
  margin: 0;
  font-size: 13px;
  letter-spacing: 0.16em;
  color: var(--color-text-dim);
}
.preview-desktop .p-scoreboard {
  flex-direction: column;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  border: var(--panel-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--panel-shadow);
}
.preview-desktop .p-progress {
  font-size: 40px;
}
.preview-desktop .p-chips {
  --preview-chip-unit: 24px;
  gap: 0.5rem;
}
.p-results {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.p-results h2 {
  margin: 0.5rem 0 0.375rem;
}
.p-result-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.75rem;
  background: var(--surface-panel);
  border: var(--panel-border);
  border-radius: var(--radius-md);
  font-size: 16px;
}
.p-result-row small {
  font-size: 12px;
  color: var(--color-text-dim);
}
.p-result-row > small {
  margin-left: auto;
}
.p-result-correct {
  color: var(--color-answer-correct);
}
.p-result-wrong {
  color: var(--color-answer-wrong);
}
.preview-desktop .p-panel {
  align-self: flex-end;
  min-height: 0;
  padding: 0.5rem 0.875rem;
  border-radius: var(--radius-sm);
  text-align: center;
}
.preview-desktop .p-meta {
  font-size: 16px;
}
.preview-desktop .p-quiz-button {
  font-size: calc(0.9375 * var(--button-unit));
}
.preview-desktop .p-three,
.preview-desktop .p-three.is-round {
  inset: 0;
}
.p-key-hint {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: var(--color-text-dim);
}
.p-key-hint kbd {
  font: inherit;
  padding: 2px 10px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--surface-panel);
}
.preview-desktop .p-toggle-label {
  font-size: 12px;
}
</style>
