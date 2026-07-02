# Phase D 実行spec: D-1 デザイントークン基盤 / D-2 ケース1適用

> 作成: 2026-07-02（Fable 5 による事前設計）。正の参照元: `docs/assets/wireframe-v2-case1.html`（デモコントロールで全状態を確認できる）と `docs/improvement/05-design-review.md` 3章。
> 前提: R-7（コンポーネント整理）完了後を推奨（props 整理後の方がテンプレート変更が単純）。ただし D-1 は R-7 と独立に実行可。

## D-1: デザイントークン基盤の導入（見た目ほぼ不変）

### 手順

1. `src/assets/main.css` に Tailwind v4 `@theme` ブロックを追加し、wireframe-v2-case1.html の `:root` トークンを移植する。**変換表**:

| wireframe 変数 | @theme 変数（Tailwind v4 命名） | 生成されるユーティリティ例 |
|---|---|---|
| `--c-stage-900: #0b1020` | `--color-stage-900` | `bg-stage-900` |
| `--c-stage-800: #131a30` | `--color-stage-800` | `bg-stage-800` |
| `--c-stage-700: #1d2742` | `--color-stage-700` | `bg-stage-700` |
| `--c-line: #2a3654` | `--color-line` | `border-line` |
| `--c-text: #eef2fa` | `--color-text-main` | `text-text-main` |
| `--c-text-dim: #8fa0c2` | `--color-text-dim` | `text-text-dim` |
| `--c-red-500/600/700: #e6402e/#c5301f/#9c2317` | `--color-signal-500/600/700` | `bg-signal-500` |
| `--c-amber-400/600: #ffc53d/#d99a14` | `--color-gold-400/600` | `text-gold-400` |
| `--c-green-400: #3ddc84` | `--color-ok-400` | `text-ok-400` |
| `--c-blue-400: #4f8cff` | `--color-info-400` | `text-info-400` |
| `--radius-sm/md/lg: 8/12/18px` | `--radius-sm/md/lg`（Tailwind 既定を上書き） | `rounded-md` |
| `--dur-fast/base: 120/240ms` | `--duration-fast/base`（v4 duration トークン） | `duration-base` |
| `--ease-out: cubic-bezier(0.16,1,0.3,1)` | `--ease-brand` | `ease-brand` |

注: `--timer-progress` はトークンではなく D-2 のタイマー実装で使うランタイム変数。@theme に入れない。
命名裁定: `red`/`amber` 等の Tailwind 既定パレット名を上書きしない（`signal`/`gold`/`ok`/`info` を新設）。既定パレットとの衝突・混用事故を防ぐため。

2. 既存コンポーネントの 16 進直書きを走査し、**現行の見た目のまま**最も近い既存トークン or 現行値の CSS 変数参照へ置換する:
   - `rg -n '#[0-9a-fA-F]{3,8}' src/ --type vue --type css` で全箇所を列挙し、置換対応表を作ってから一括置換
   - 現行 `#2563eb`（blue-600、8 ファイル）等の「新テーマで消える色」は、この時点では `var(--color-info-400)` 等へ寄せず**現行値のまま暫定変数**（例: `--color-legacy-blue: #2563eb`）にまとめてよい。D-2 で正式トークンに置換して暫定変数を削除する
   - media query コピペ（`max-width: 640px` / `max-height: 700px` × 6 ファイル）はこの時点では触らない（D-2 でクラス整理と同時に対処）
3. 完了条件: `npm run build` 成功 + 目視で見た目が変わっていないこと（スクリーンショット比較推奨: dev サーバ + Playwright MCP で 375px 幅の各状態を撮影し前後比較）
4. コミット: `Task D-1: デザイントークン基盤の導入`

## D-2: ケース1デザインの適用

### 対象と適用内容（wireframe-v2-case1.html の該当セクションを正とする）

| コンポーネント | 適用内容 |
|---|---|
| App.vue / main.css | ステージ背景（stage-900 + ボタン背後の放射スポットライト） |
| AppHeader.vue | ステージ調ヘッダー（blue-600 廃止） |
| GameInfo.vue | スコアボード化: セグメント風「Q 03/05」+ ○×チップ列（直近5問スライディングウィンドウ + 三角ページャ、右端は現在の問題まで）。○/×/スキップ/無解答は**一体 SVG シンボル**で描画（wireframe 内の SVG をコピーして Vue コンポーネント化: `src/components/game/ResultChip.vue` 新設可） |
| QuizButton.vue | 物理ボタン化: 真上視点の円形キャップ + 同心円台座 + LED リング。押下: 縮小 + 内側影 + 減光。RELEASED: LED グロー。QUESTIONING: 外周パルスリング |
| AnswerContent.vue | タイマー表示（下記「未決事項」）+ 正解/不正解の縁取りフラッシュバナー + `aria-live="polite"` |
| GuideText.vue | 文言のみ上下中央（絵文字なし）。READY でボタンへの矢印モーション |
| FinalScore / ResultTable / ResultActions | フルスクリーンリザルトステージ（大型スコア + 問題別タイムライン + もう一度プレイ、細スクロールバー） |
| ダイアログ群 4 種 | ステージ調の配色・radius・ボーダーへ統一（構造変更なし） |

### 実装ルール

- 新テーマ適用時に**ユーティリティクラス（Tailwind）へ移行**する（scoped CSS の縮小。ただし複雑なアニメーション・疑似要素・SVG は scoped CSS / CSS モジュールで可。全面ユーティリティ化を強制しない — 可読性優先）
- `prefers-reduced-motion: reduce` で全アニメーション停止（wireframe 内に実装例あり。メディアクエリを main.css に共通定義）
- `:focus-visible` リングの統一（info-400、2px offset）
- 44px 未満のタッチターゲットを作らない
- **wireframe の CSS を読んで移植する**こと。独自解釈で再デザインしない。wireframe に無い状態（エッジケース）に遭遇したら最も近い既存状態の様式を踏襲し、判断に迷えばユーザーへ確認

### 未決事項（実装時にユーザーへ確認 — 事前決定しない）

1. **タイマー表示の 2 案選択**: ①conic-gradient リング / ②解答エリア枠メーター（wireframe のデモで切替可能。ユーザーが見て選ぶ）。どちらも 12 時起点・時計回り減少・≤3 秒で赤 + 脈動

### 検証（必須）

1. `npm run test` / `type-check` / `lint` パス（ロジック変更なしのためテスト無修正が原則）
2. Playwright MCP で 360 / 390 / 430px 幅 × 全ゲーム状態（READY/TALKING/QUESTIONING/ANSWERING/WAITING/REVEALING/FINISHED）のスクリーンショット確認: 横スクロールなし
3. mobile-ui-reviewer エージェントにレビューさせる。指示文テンプレ:
   > 現ブランチの diff（Phase D-2 のデザイン適用）をレビューしてください。対象: src/components/ 配下の変更。観点: (1) 360–430px で横スクロールが発生しないか (2) タッチターゲット 44px 以上 (3) prefers-reduced-motion 対応の漏れ (4) :focus-visible の統一 (5) aria-live の設定。参照デザイン: docs/assets/wireframe-v2-case1.html
4. 手動: 実機（スマホ縦）で通しプレイ 1 回
5. コミットは対象コンポーネント群単位で分割してよい（例: `Task D-2: スコアボード/ボタン/解答エリア/リザルト/ダイアログ` の 3〜5 コミット）

### 完了後

- docs/tasks.md の D-1/D-2 チェック更新
- 05-design-review.md 冒頭に「適用済み」注記を追加
- 暫定変数（--color-legacy-*）が残っていないことを確認: `rg -n 'legacy' src/`
