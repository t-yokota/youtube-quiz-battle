<script setup lang="ts">
// ThemePreview コンポーネント
// スイッチャーのカードに表示する「問題中（早押し可）」画面の代表イメージ。
// 実ストア・実プレイヤーに依存しない静的マークアップで、
// スタイルはすべてテーマトークン参照 → 親の [data-theme] だけで任意テーマの見た目になる。
// 新テーマ追加時にこのファイルの変更は不要。
import SettingsIcon from '@/components/common/SettingsIcon.vue'

interface Props {
  previewWidth?: number
  previewHeight?: number
}

withDefaults(defineProps<Props>(), {
  previewWidth: 315,
  previewHeight: 700,
})
</script>

<template>
  <div
    class="preview"
    :style="{ width: `${previewWidth}px`, height: `${previewHeight}px` }"
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
    <div class="p-scoreboard">
      <span class="p-progress"><span class="p-q">Q</span>03<span class="p-total"> / 05</span></span>
      <span class="p-chips">
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
        <svg viewBox="0 0 16 16" class="p-chip"><circle cx="8" cy="8" r="7.25" class="ring" /></svg>
        <svg viewBox="0 0 16 16" class="p-chip"><circle cx="8" cy="8" r="7.25" class="ring" /></svg>
      </span>
    </div>

    <!-- ゲームUI -->
    <div class="p-game">
      <!-- 解答パネル（入力はまだ無効） -->
      <div class="p-panel">
        <div class="p-meta">残り 3回<span class="p-dim"> / 3</span></div>
        <div class="p-input-row">
          <span class="p-input">解答を入力</span>
          <span class="p-submit">送信</span>
        </div>
      </div>

      <!-- 早押しボタン領域（実画面と同じくトグルを内包） -->
      <div class="p-button-container">
        <div class="p-button-area">
          <span class="p-pedestal"></span>
          <span class="p-quiz-button">PUSH</span>
        </div>

        <!-- BUTTON CHECK トグル -->
        <div class="p-toggle-row">
          <span class="p-toggle-label">BUTTON CHECK</span>
          <span class="p-toggle"
            ><span class="p-toggle-state">ON</span><span class="p-toggle-knob"></span
          ></span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  height: 6.875rem;
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
  height: max(44px, 2.75rem);
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
  height: max(44px, 2.75rem);
  min-width: max(44px, 2.75rem);
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
  flex: 1;
  min-height: 13.5rem;
  display: flex;
  flex-direction: column;
  position: relative;
}

.p-button-area {
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  position: relative;
}

.p-pedestal {
  grid-area: 1 / 1;
  width: 12.25rem;
  height: 12.25rem;
  border-radius: 50%;
  background: var(--pedestal-bg);
  border: var(--pedestal-border);
  box-shadow: var(--pedestal-shadow);
}

.p-quiz-button {
  grid-area: 1 / 1;
  width: 9.375rem;
  height: 9.375rem;
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
  box-shadow: var(--toggle-track-shadow);
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
</style>
