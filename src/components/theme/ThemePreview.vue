<script setup lang="ts">
// ThemePreview コンポーネント
// スイッチャーのカードに表示する「問題中（早押し可）」画面の代表イメージ。
// 実ストア・実プレイヤーに依存しない静的マークアップで、
// スタイルはすべてテーマトークン参照 → 親の [data-theme] だけで任意テーマの見た目になる。
// 新テーマ追加時にこのファイルの変更は不要。
//
// 設計スペース: 315×700 固定（px）。親側で transform: scale して使う。
</script>

<template>
  <div class="preview" aria-hidden="true">
    <!-- ヘッダー -->
    <div class="p-header">
      <span class="p-wordmark">YouTube <span class="p-accent">Quiz Battle</span></span>
      <svg class="p-gear" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="3" />
        <path
          d="M12 2.5v3M12 18.5v3M4.2 6.7l2.1 2.1M17.7 15.2l2.1 2.1M2.5 12h3M18.5 12h3M4.2 17.3l2.1-2.1M17.7 8.8l2.1-2.1"
          stroke-linecap="round"
        />
      </svg>
    </div>

    <!-- 動画プレイヤー（プレースホルダ） -->
    <div class="p-video">
      <span class="p-play">▶</span>
    </div>

    <!-- スコアボード -->
    <div class="p-scoreboard">
      <span class="p-progress"><span class="p-q">Q</span>03<span class="p-total"> / 05</span></span>
      <span class="p-chips">
        <svg viewBox="0 0 16 16" class="p-chip ok"><circle cx="8" cy="8" r="7.25" class="ring" /><circle cx="8" cy="8" r="3.4" fill="none" class="mk" /></svg>
        <svg viewBox="0 0 16 16" class="p-chip ng"><circle cx="8" cy="8" r="7.25" class="ring" /><path d="M5.3 5.3 L10.7 10.7 M10.7 5.3 L5.3 10.7" fill="none" stroke-linecap="round" class="mk" /></svg>
        <svg viewBox="0 0 16 16" class="p-chip cur"><circle cx="8" cy="8" r="7.25" class="ring" /></svg>
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

      <!-- 早押しボタン（押せる状態） -->
      <div class="p-button-area">
        <span class="p-pedestal"></span>
        <span class="p-quiz-button">PUSH</span>
      </div>

      <!-- BUTTON CHECK トグル -->
      <div class="p-toggle-row">
        <span class="p-toggle-label">BUTTON CHECK</span>
        <span class="p-toggle"><span class="p-toggle-state">ON</span><span class="p-toggle-knob"></span></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 315×700 の設計スペースに px で固定描画する（親が transform: scale で縮小） */
.preview {
  width: 315px;
  height: 700px;
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
}

/* ヘッダー */
.p-header {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px 8px;
  border-bottom: 1px solid var(--color-line);
  background: var(--header-bg);
}

.p-wordmark {
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.p-accent {
  color: var(--color-accent);
}

.p-gear {
  width: 24px;
  height: 24px;
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
  padding: 10px 14px;
  background: var(--surface-panel);
  border-bottom: 1px solid var(--color-line);
}

.p-progress {
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  font-size: 17px;
  letter-spacing: 0.04em;
}

.p-q {
  font-size: 15px;
  color: var(--color-accent);
  letter-spacing: 0.2em;
  margin-right: 3px;
}

.p-total {
  color: var(--color-text-dim);
  font-size: 12px;
  font-weight: 600;
}

.p-chips {
  display: flex;
  align-items: center;
  gap: 5px;
}

.p-chip {
  width: 16px;
  height: 16px;
  display: block;
}

.p-chip .ring {
  fill: var(--chip-bg);
  stroke: var(--color-line);
}

.p-chip.ok .ring {
  fill: var(--chip-ok-bg);
  stroke: var(--color-ok);
}

.p-chip.ok .mk {
  stroke: var(--color-ok);
  stroke-width: 1.4;
}

.p-chip.ng .ring {
  fill: var(--chip-ng-bg);
  stroke: var(--color-danger);
}

.p-chip.ng .mk {
  stroke: var(--color-danger);
  stroke-width: 1.4;
}

.p-chip.cur {
  border-radius: 50%;
  box-shadow: var(--chip-current-glow);
}

.p-chip.cur .ring {
  stroke: var(--color-accent);
}

/* ゲームUI */
.p-game {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px 12px;
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
  padding: 12px 14px;
  height: 110px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
}

.p-meta {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-info);
  padding: 0 4px;
}

.p-dim {
  color: var(--color-text-dim);
  font-weight: 500;
}

.p-input-row {
  display: flex;
  gap: 8px;
}

.p-input {
  flex: 1;
  min-width: 0;
  height: 44px;
  padding: 0 14px;
  font-size: 16px;
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
  height: 44px;
  padding: 0 16px;
  font-size: 15px;
  font-weight: 800;
  color: var(--color-text-dim);
  background: var(--surface-raised);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* 早押しボタン */
.p-button-area {
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  position: relative;
}

.p-pedestal {
  grid-area: 1 / 1;
  width: 196px;
  height: 196px;
  border-radius: 50%;
  background: var(--pedestal-bg);
  border: var(--pedestal-border);
  box-shadow: var(--pedestal-shadow);
}

.p-quiz-button {
  grid-area: 1 / 1;
  width: 150px;
  height: 150px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 19px;
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
  flex-shrink: 0;
  align-self: flex-end;
  display: flex;
  align-items: center;
  gap: 6px;
}

.p-toggle-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--color-text-dim);
}

.p-toggle {
  position: relative;
  width: 44px;
  height: 20px;
  border-radius: 999px;
  background: var(--toggle-on-track);
  border: 1px solid var(--toggle-on-border);
  box-shadow: var(--toggle-track-shadow);
}

.p-toggle-state {
  position: absolute;
  left: 7px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--color-accent);
}

.p-toggle-knob {
  position: absolute;
  top: 50%;
  right: 2px;
  transform: translateY(-50%);
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--toggle-on-knob);
}
</style>
