# デザイン修正提案（未適用）

本ドキュメントは、`.kiro/specs/youtube-quiz-battle/design.md`への追記・置換に相当する提案です。
各項目は「コンテキスト（対象箇所）」「意図（理由）」「最小の差分（または追記）」で構成されています。承認後に原本へ反映します。

---

## 1) テストツール: Vue向けコンポーネントテスト

- コンテキスト: 「Testing Tools」
- 意図: 本プロジェクトはVueを採用しているため、ツール名は`@testing-library/vue`が適切。

```diff
- **Component Tests**: React Testing Library
+ **Component Tests**: @testing-library/vue
```

---

## 2) 状態の閾値と一回性トリガ

- コンテキスト: 「State Transition Conditions」（`shouldTransition`の直後）
- 意図: 同一閾値での重複遷移を防止し、時刻境界の包含規則を明確化する。

以下を追記：

### 遷移境界ルール（包含規則）

- QUESTIONING 開始: `current >= startTime`（`startTime`で包含）
- REVEALING 開始: `current >= revealTime`（`revealTime`で包含）
- REVEALING 終了: `current >= endTime` 到達で次状態へ
- 1ティックで複数閾値を跨いだ場合は、時間順にすべて処理する

### 一回性トリガ（Single‑Shot Guard）

採用: 問題単位で「start/reveal/end」を各1回だけ処理するフラグ管理を行う（巻き戻しや任意シークがあっても安全）。
実装例は下の「問題単位の一回性フラグ（例）」を参照。

### 1ティック内の複数閾値走査

`setInterval`の遅延等で閾値を飛び越える可能性に備え、`(prev, curr]`の窓内を走査して順に処理する：

```ts
function processTimeWindow(prev: number, curr: number, q: QuizQuestion) {
  const thresholds = [q.startTime, q.revealTime, q.endTime]
    .filter((t) => t > prev && t <= curr)
    .sort((a, b) => a - b)
  for (const t of thresholds) transitionAt(t)
}
```

#### 問題単位の一回性フラグ（例）

絶対秒でも十分だが、巻き戻しや特殊ケースにより堅牢性を高めたい場合は問題ごとにフラグを持つ。

```ts
// 問題ごとの一回性フラグ（start/reveal/end を各1回だけ処理）
const consumed: Record<number, { start: boolean; reveal: boolean; end: boolean }> = {}

function applyThresholds(prev: number, curr: number, q: QuizQuestion) {
  const c = consumed[q.index] ?? (consumed[q.index] = { start: false, reveal: false, end: false })
  if (!c.start && prev < q.startTime && curr >= q.startTime) { c.start = true; onStart(q) }
  if (!c.reveal && prev < q.revealTime && curr >= q.revealTime) { c.reveal = true; onReveal(q) }
  if (!c.end && prev < q.endTime && curr >= q.endTime) { c.end = true; onEnd(q) }
}
```

---
### 絶対秒ベースの前提と考慮事項

- すべての時刻は「動画全体の絶対秒」で定義する（相対秒は使用しない）
- データ検証: 各問題で `start < reveal < end`、かつ問題間でQUIZ区間が重複しない
- 一回性ガード: 問題単位のフラグ（`consumed[i].start/reveal/end`）で管理する（推奨）
- 取りこぼし防止: `(prev, curr]` 窓走査で複数閾値を時間順に適用（上記コード）
- 比較の包含規則: 境界時は包含（`current >= threshold`）とする（浮動小数の丸め誤差に頑健）
- 正解後のジャンプ: `jumpToRevealPeriod` はすでに `current >= revealTime` の場合はシークしない

---

## 3) シーク検出のヒステリシス（許容幅）

- コンテキスト: 「Seek Detection via watchedVideoTime」
- 意図: 更新間隔ちょうどを閾値にすると誤検出・見逃しが起きやすい。許容幅を設ける。

以下を追記：
### 推奨の許容幅（命名と値の意図）

```ts
// 0.1秒間隔でチェックし、0.2秒以上の非連続をシークとみなす
const TIME_UPDATE_INTERVAL_SEC = 0.1
const SEEK_TOLERANCE_SEC = TIME_UPDATE_INTERVAL_SEC * 2 // ジッタやタイマ遅延を許容

function isSeekDetected(newTime: number, watched: number): boolean {
  return Math.abs(newTime - watched) > SEEK_TOLERANCE_SEC
}
```

説明:

- 「0.1秒ごとの測定で、0.2秒以上のジャンプならシーク」と読み取れる命名に変更（EPSILONより可読性を重視）。
- 許容幅は更新間隔の2倍を初期値とし、環境に応じて調整可。

---

## 4) YouTube プレイヤー状態の列挙

- コンテキスト: 「YouTube Player Manager」
- 意図: `YouTubePlayerState`の値域を明示し、型安全性と可読性を向上させる。

インターフェース定義の直後に以下を追記：

```ts
// YouTube IFrame API states
export enum YouTubePlayerState {
  UNSTARTED = -1,
  ENDED = 0,
  PLAYING = 1,
  PAUSED = 2,
  BUFFERING = 3,
  CUED = 5,
}
```

---

## 5) othersAnsweringPeriods の優先順位とルール

- コンテキスト: 「Time Management」/ `othersAnsweringPeriods`
- 意図: QUESTIONING/REVEALINGと重なった場合の優先度を明確化する。

以下を追記：
### 区間優先順位

同一問題内の時刻`t`に対して：

1. `revealTime <= t < endTime` → REVEALING
2. それ以外で `othersAnsweringPeriods` のいずれかに含まれる → WAITING
3. `startTime <= t < revealTime` → QUESTIONING
4. 上記以外 → TALKING

othersAnsweringPeriods は QUESTIONING に対する排他的な下位区間として扱う。

### 定義とバリデーション（完全包含の条件）

各 `othersAnsweringPeriods` は、その問題の QUESTIONING 区間（`[startTime, revealTime)`）に完全に収まることを必須条件とする。

```ts
// 必須条件（全期間について満たす）
q.startTime <= p.startTime < p.endTime <= q.revealTime

// 追加条件：相互に重ならない（昇順に整列）
p[i].endTime <= p[i + 1].startTime
```

この条件に違反するデータはバリデーションエラーとし、読み込み時に拒否する。

---

## 6) jumpToRevealPeriod の挙動定義

- コンテキスト: `QuizSettings.jumpToRevealPeriod`
- 意図: 正解/解答回数尽きのときの遷移と、シーク量の取り扱いを明確化する。

以下を追記：
`jumpToRevealPeriod = true` のとき：

- 正解、または不正解で残り解答回数が 0 の場合、`currentVideoTime < revealTime` であれば `seekTo(revealTime)` を行う。
- 余計なオフセットは加えず、`seekTo(revealTime)` をそのまま適用する（API丸めにより僅かに後ろへ着地しても、そのままREVEALINGとして扱う）。
- `disableSeekbar = true` でも、このプログラム起因のシークは許可する。


---

## 7) hideVideoPlayerDuringAnswer のタイミング

- コンテキスト: `QuizSettings.hideVideoPlayerDuringAnswer`
- 意図: ボタン演出と同期させ、視覚的なチラつきを抑える。

以下を追記：
ANSWERING への遷移時：

- 直ちに動画を一時停止する。
- `hideVideoPlayerDuringAnswer = true` の場合は、同時に動画プレイヤーを即時に非表示にする（演出の100msは待たない）。
- ANSWERING を抜ける際は、再描画前に動画の可視状態を元へ戻す。


---

## 8) ANSWERING 中のカウントダウンのライフサイクル

- コンテキスト: 「Answer Area」の挙動
- 意図: タイマーの単一責務化とリーク防止。

以下を追記：
カウントダウンは ANSWERING 突入時に開始し、以下のいずれかで必ず停止する：

- 解答送信（正解/不正解）
- 時間切れ
- ANSWERING からの状態遷移（いかなる理由でも）

タイマーインスタンスの所有者は GameManager とし、UI コンポーネント側で追加のタイマーを開始しない。


---

## 9) スペースキー操作（PC）の扱い

- コンテキスト: 「Control Methods」および入力挙動
- 意図: テキスト入力中の誤操作防止と、ページスクロールの抑止。

以下を追記：

```ts
document.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement | null
  const typing =
    !!target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      (target as any).isContentEditable)
  if (typing) return
  if (e.code === 'Space' && (state === 'READY' || state === 'QUESTIONING')) {
    e.preventDefault()
    handleButtonPress()
  }
})
```

---

## 10) シーク検出による WAITING 固定と解除（disableSeekbar = false）

- コンテキスト: 「Seek Detection Behavior」
- 意図: 次のQUIZ開始時に遷移を再開する条件を明確化する。

以下を追記：

```ts
// シーク検出後、遷移を停止している間：
if (transitionsPaused) {
  const next = questions.find((q) => q.startTime > currentVideoTime)
  if (next && currentVideoTime >= next.startTime && watchedVideoTime >= next.startTime) {
    transitionsPaused = false
  }
}
```

---

## 11) 1ティックで複数閾値を跨ぐ場合の順次処理

- コンテキスト: タイマ遅延対策
- 意図: `setInterval`のラグで複数の区切りを一度に跨いでも取りこぼさない。

項目 2「1ティック内の複数閾値走査」を参照し、`(prev, curr]`に存在するすべての閾値を時間順に適用する旨を明文化。

---

## 12) ローカル開発用のサンプルデータ同梱

- コンテキスト: 「Sample Quiz Data」およびデータ取得フロー
- 意図: Phase 2 立ち上げ時の 404 回避。

以下を追記：
ローカル開発では、少なくとも 1 本のサンプル（例: `E5200yjbvj8`）を `public/data/{videoId}/data.json` に同梱し、手動設定なしで読み込めるようにする。


---

## 13) 追加の単体テストチェックリスト

- コンテキスト: 「Testing Strategy」
- 意図: 境界・シーク関連の挙動を自動テストで担保する。

以下を「Unit Tests」に追記：

- `startTime/revealTime/endTime`での包含規則
- シーク許容幅（`SEEK_TOLERANCE_SEC`）の前後での検出可否
- 同一時刻での重複遷移を防ぐ Single‑Shot Guard の確認
- othersAnsweringPeriods が QUESTIONING より優先されること
- jumpToRevealPeriod のシーク挙動（disableSeekbar の有無を含む）

---

## 14) 外部要因による再生中断対応（広告/バックグラウンド/スタール）

- コンテキスト: YouTubeプレイヤーの状態変化、可視性変化、時間管理/カウントダウン/シーク検出との整合
- 意図: 広告（非Premium想定）やバックグラウンド遷移、ネットワーク不安定等で動画進行が停止する状況でも、ゲーム状態・タイマー・UIを一貫して扱う。

### 用語と理由の分類

`externalPausedReason: 'visibility' | 'stall' | 'user' | 'ad' | null`

- visibility: タブ/アプリ切替、最小化、画面ロック、PWAバックグラウンド等（`document.hidden`）
- stall: 再生意図はあるが進行が止まる停滞（バッファリング/ネットワーク不調/YouTube側一時停止等）
- user: ユーザー操作起因の一時停止（プレイヤーの一時停止ボタン、メディアキー、BTヘッドセット等）
- ad: 広告再生。IFrame APIで識別困難なため、実装上は `stall` と同等に扱う（分類だけ保持）

### 監視ポイント（検出）

1. 可視性変化

```ts
document.addEventListener('visibilitychange', () => {
  if (document.hidden) gm.pauseExternal('visibility')
  else gm.resumeExternal()
})

window.addEventListener('pagehide', () => gm.pauseExternal('visibility'))
window.addEventListener('pageshow', () => gm.resumeExternal())
```

2. YouTubeプレイヤー状態

```ts
player.onStateChange((s) => {
  // 内部で実行した pauseVideo/playVideo は internalAction を立てて区別
  if (s === YouTubePlayerState.PAUSED && !gm.internalAction) gm.pauseExternal('user')
  if (s === YouTubePlayerState.PLAYING && gm.externalPaused) gm.resumeExternal()
})
```

3. スタール判定（TimeUpdate内／任意でウォッチドッグ）

最小構成として、TimeUpdate（動画時刻の定期ポーリング処理）の中で壁時計と動画時間の進みを比較してスタールを検出できる。

```ts
const STALL_WALL_MS = 1200
const STALL_VIDEO_DELTA_SEC = 0.05
const STARTUP_GRACE_MS = 1000

let startedAt = performance.now()
let lastWallMs = startedAt
let lastVideoTime = player.getCurrentTime()

function timeUpdateTick() {
  const now = performance.now()
  const ps = player.getPlayerState()
  const current = player.getCurrentTime()
  if (now - startedAt < STARTUP_GRACE_MS) {
    // ウォームアップ猶予: 再生直後の誤検出を回避
    lastWallMs = now
    lastVideoTime = current
    return
  }
  const wallΔ = now - lastWallMs
  const videoΔ = current - lastVideoTime

  const playbackIntended = ps === YouTubePlayerState.PLAYING || ps === YouTubePlayerState.BUFFERING
  if (!gm.externalPaused && playbackIntended && wallΔ >= STALL_WALL_MS && videoΔ < STALL_VIDEO_DELTA_SEC) {
    gm.pauseExternal('stall')
  }
  if (gm.externalPaused && gm.externalPausedReason === 'stall' && videoΔ >= STALL_VIDEO_DELTA_SEC) {
    gm.resumeExternal()
  }

  lastWallMs = now
  lastVideoTime = current
}
```

任意で別スレッド（`setInterval`）のウォッチドッグを設ける利点は、TimeUpdateループが環境によって強くスロットリングされた場合でも壁時計基準で検出できる点。ただし本設計では「ページの可視性変化（Page Visibility API: `document.hidden`）で明示的に一時停止」するため、TimeUpdate内検出のみでも十分に運用可能。ここでいう可視性はタブ/アプリの非表示状態を指し、ANSWERING中に動画をUI上で非表示にすることとは無関係。
（起動間隔の目安: `setInterval(timeUpdateTick, 100〜200)`ms）

### 制御（外部一時停止中の挙動）

- `externalPaused: boolean` を GameManager に導入し、以下をゲートする：
  - 時間遷移判定（`shouldTransition` / `processTimeWindow`）を停止
  - `TimeManager.updateVideoTime()` 内で `watchedVideoTime` 更新と `isSeekDetected` を停止
  - ANSWERING のカウントダウンを必ず停止（再開時に再開）
  - UI に「動画が一時停止中」オーバーレイを表示（再開ボタンを提供）。ただし ANSWERING 中は表示しない（解答カウントダウン停止のみ）

```ts
function updateVideoTime(newTime: number) {
  if (gm.externalPaused) {
    lastCurrentVideoTime = newTime // 参照用に保持のみ、判定は行わない
    return false // isSeekDetected を返さない
  }
  // 通常処理：watchedVideoTime 更新、シーク検出、遷移判定…
}
```

### 再開処理（グレース＆取りこぼし防止）

- `RESUME_GRACE_MS = 300`（推奨）期間は、シーク検出を無効化し時間遷移判定も1ティック遅延
- 再開時に `watchedVideoTime = currentVideoTime` へ同期し、直後のシーク誤検出を防止
- 次ティックで `(prev, curr]` の窓走査（項目 2 参照）を行い、境界跨ぎを時系列で適用

```ts
function resumeExternal() {
  gm.externalPaused = false
  gm.lastResumeAt = performance.now()
  time.watchedVideoTime = player.getCurrentTime()
}

function timeTick() {
  if (performance.now() - gm.lastResumeAt < RESUME_GRACE_MS) return
  // ここから通常の遷移判定＆窓走査
}
```

### UI/UX（オーバーレイ）

- 画面中央にコンパクトなオーバーレイ（例: 「動画が一時停止しています（理由: 可視性/スタール/ユーザー操作）」）
- ただし ANSWERING 中は、動画はもともと停止しているためオーバーレイは表示しない。「解答時間のカウントダウン停止」のみを行い、UIは現状を維持する。
- 「再開」ボタン: `player.playVideo()` と `gm.resumeExternal()` を同期呼び出し
- アクセシビリティ: フォーカス移動、ESCで閉じる、読み上げ用のライブリージョン

### 追加設定

ユーザー設定（既存に追加）：

```ts
interface UserSettings {
  pauseOnVisibilityHidden: boolean // 既定: true（可視性が隠れたら一時停止）
  pauseCountdownOnPlayerPause: boolean // 既定: true（プレイヤー停止時はカウントダウン停止）
}
```

開発者設定（デバッグ用の推奨追加）：

```ts
interface DevSettings {
  resumeGraceMs: number // 既定: 300
  stallWatchdogWallMs: number // 既定: 1200
  stallVideoDeltaSec: number // 既定: 0.05
}
```

### テレメトリ（任意）

- `external_pause`（reason, playerState, currentTime, wallSinceLast, videoΔ）
- `external_resume`（reason, pausedDurationMs, thresholdsCrossedOnResume）

### テスト追加

- ANSWERING中、`externalPaused=true` でカウントダウンが停止し、解除で再開する
- 可視性隠蔽→復帰で、シーク検出が直後に発火しない（`watchedVideoTime` 同期とグレースで回避）
- スタール検出のしきい値（`stallWatchdogWallMs`/`stallVideoDeltaSec`）を跨いだ時のみ発火
- 復帰直後に `(prev, curr]` の窓走査で取りこぼしがない

---

## 15) YouTube playerVars 推奨設定とプロファイル

- コンテキスト: IFrame Player API 初期化パラメータ `playerVars`
- 意図: 公正性（シーク抑止・フルスクリーン遷移防止）、モバイル最適化（iOS inline 再生）、UIノイズ低減、開発利便性の両立。

### 推奨プロファイル

1. Strict（デフォルト／本番想定）

```ts
const strictPlayerVars = {
  playsinline: 1, // iOS でのインライン再生（フルスクリーン強制回避）
  controls: 0, // コントロール非表示（シークバー抑止）
  disablekb: 1, // YouTube 側のキーボードショートカット無効化
  fs: 0, // フルスクリーンボタンを無効化
  modestbranding: 1, // ブランディングを最小化
  rel: 0, // 終了時の関連動画を同チャンネルに限定
  autoplay: 0, // 手動開始（ボタンチェック）
  cc_load_policy: 0, // 字幕は既定で非表示
  hl: 'ja', // UI 言語
  // iv_load_policy は現在非推奨のため設定しない
}
```

2. Debug（開発時／デバッグ向け）

```ts
const debugPlayerVars = {
  playsinline: 1,
  controls: 1, // デバッグ用途で操作可（本番の挙動確認のみ。実運用では切替しない）
  disablekb: 1, // 常にキーボード制御を無効化
  fs: 0, // 常にフルスクリーン禁止
  modestbranding: 1,
  rel: 0,
  autoplay: 0,
  cc_load_policy: 0,
  hl: 'ja',
}
```

補足:

- `enablejsapi` は IFrame API 経由の生成で自動有効。`origin` はセキュリティ上明示指定を推奨（`window.location.origin`）。
- `rel=0` は現在「同チャンネルの関連動画」に限定されるだけで非表示にはならない仕様。
- `controls=0` でも OS レベルのメディアキー等は無効化できないため、外部一時停止検出（項目 14）で補完する。
- プライバシー配慮が必要なら `host: 'https://www.youtube-nocookie.com'` を `YT.Player` 初期化オプションに付与（playerVars ではなく `host`）。

### 設定との連動

- playerVars は「初期化時に決定」し、実行中の切替は行わない（切替はプレイヤー再生成を伴いUXを損なうため）。
- 公平性と一貫性のため、`disablekb` は常に 1、`fs` は常に 0。
- `controls` は `disableSeekbar` のみで決定する（`true → 0`, `false → 1`）。

### 実装例

```ts
type PlayerVars = Record<string, string | number | boolean>

function buildPlayerVars(settings: QuizSettings): PlayerVars {
  return {
    playsinline: 1,
    controls: settings.disableSeekbar ? 0 : 1,
    disablekb: 1,
    fs: 0,
    modestbranding: 1,
    rel: 0,
    autoplay: 0,
    cc_load_policy: 0,
    hl: 'ja',
    origin: window.location.origin,
  }
}

const player = new YT.Player(el, {
  videoId,
  host: 'https://www.youtube-nocookie.com', // 任意（プライバシー優先時）
  playerVars: buildPlayerVars(quizSettings),
  events: { onReady, onStateChange },
})
```

【注意】playerVars（controls / fs / disablekb）は初期化時のみ有効で、実行中の切替はプレイヤー再生成が必要になるため対応しない。

### iframe の allow 属性（参考）

PIP の抑止や自動再生の許可を制御する場合に検討：

```html
<iframe allow="autoplay; encrypted-media" referrerpolicy="strict-origin-when-cross-origin"></iframe>
```

（PIP を不可にしたい場合は allow から `picture-in-picture` を外す。ただしブラウザ依存のため完全抑止は保証されない。）

### テスト追加

- iOS（Safari）でインライン再生が維持される（`playsinline=1`）
- `disableSeekbar=true` でコントロール非表示（`controls=0`）
- `disableSeekbar=false` でコントロール表示（`controls=1`）
- `disablekb=1` が常時設定されている
- `fs=0` が常時設定され、フルスクリーンへ遷移しない（`allowfullscreen` も未付与）

---

## 16) Answer Normalization Spec（解答正規化仕様）

- コンテキスト: 「Requirement 4（表記揺れ対応）」と AnswerValidator の段階導入
- 方針: MVP（Phase 2）は正規化なしの完全一致。Phase 3 で安全な「統一パイプライン」を全体適用。問題ごとのプロファイル指定は導入しない。

### Rollout Plan（導入計画）

- Phase 2: 正規化なし＋完全一致のみ（必要があれば内部ヘルパーに trim+NFKC を用意し既定OFF）
- Phase 3: 統一パイプラインをグローバル適用（下記）。
- After: 将来オプションを必要に応じて実装する。

### Phase 3 デフォルト正規化パイプライン（適用順）

1. Unicode 正規化
   - 方式: NFKC（互換分解/合成で記号・幅・互換文字を統一）
2. 文字種標準化
   - 英字: casefold（大文字小文字を同一視）
   - ダイアクリティクス: 触らない（将来オプション）
3. 空白処理（全空白種を対象）
   - 両端 trim
   - 内部: 保持（Phase 3では内部空白はそのまま）
4. 日本語が含まれる場合のみ（文字種検出でON）
   - 半角カナ→全角カナ
   - ひらがな/カタカナのどちらかへ統一（既定: カタカナ）
   - 小書きかなの標準化
   - 長音記号の同形異体統一（「ー/ｰ/―/－」→「ー」）
5. 数値正規化
   - 全角↔半角統一（既定: 半角）。桁区切り/先頭ゼロ/ローマ・漢数字変換は行わない
6. 仕上げ
   - ゼロ幅類や制御文字の除去

注: 句読点・記号の統一/除去は Phase 3 では実施しない（誤陽性リスク回避）。

#### 日本語含有の存在検出（ON/OFF判定）

日本語向け正規化を適用するかの簡易スイッチとして、対象文字列に日本語系文字が1文字でも含まれるかを正規表現で判定する。

```ts
// Unicode Property 対応環境（Node 20+ / 主要ブラウザ）
const RE_JP = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}\uFF66-\uFF9F\u3005\u303B\u309D-\u309E\u30FD-\u30FE]/u

function containsJapanese(s: string): boolean {
  const t = s.normalize('NFKC') // 幅の違い等を吸収してから判定
  return RE_JP.test(t)
}

// フォールバック（Property未対応）
const RE_JP_FALLBACK = /[\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF66-\uFF9F\u3005\u303B\u309D-\u309E\u30FD-\u30FE]/
```

### 将来オプション（Phase 3以降に実装）

- 長音の相互許容（候補生成: あり/なし）
- 句読点・記号の最小統一（アポストロフィ/ダッシュ類）
- ダイアクリティクス除去（café→cafe）
- 数値拡張: 3桁区切り・先頭ゼロ除去、ローマ数字→アラビア、漢数字→アラビア（basic/extended）
- 中点/括弧/句点の除去または空白化

### マッチ戦略（高速化と一貫性）

1. 正解データの事前展開
   - 各正解文字列をパイプラインで正規化し、Set に格納（重複排除）
2. 入力の単一正規化
   - 同じパイプラインで 1 回だけ正規化
3. 判定
   - 完全一致（文字列 ∈ 正解候補集合）を基本
   - 例外（包含判定/順不同トークン一致/数式等）が必要になった場合のみ、別途機能で追加

### 日本語特化の補足（Phase 3の範囲）

- 促音「っ」は保持（意味差が大きい）
- 中点「・」、句読点、括弧は保持（統一/除去は将来オプション）
- 反復記号「々」は保持（展開は将来オプション）
- 敬称/接尾辞（さん/くん/ちゃん等）は保持（除去は将来オプション）

### 代表エッジケース（Phase 3既定の結果）

- ' ABC　' → 'abc'（NFKC＋casefold＋trim）
- とうきょう / トウキョウ / ﾄｳｷｮｳ → トウキョウ（カナ統一＋半角→全角）
- トーキョー は トウキョウ と異なる（長音の有無は相互許容しない）
- １０００ / 1000 は一致（幅統一）。3,000（桁区切り）や ０３０００（先頭ゼロ）は今は別扱い
- café と cafe は異なる（ダイアクリティクス除去は将来）

### テスト観点

- Phase 2: 正規化なしでの完全一致境界（前後空白/全角記号混在など）
- Phase 3: 上記パイプラインのON/OFF条件（日本語含有判定）と各ステップの正規化結果
- 誤陽性抑制（長音・句読点を触らない設計での不一致確認）
- 正解集合の事前展開が入出力で一致する（順序や重複に依存しない）
