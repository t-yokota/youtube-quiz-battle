# Phase 4 実行spec: 品質・リリース（22 / 23 / 27 優先、25 / 26 は後回し）

> 作成: 2026-07-03（Fable 5 による事前設計）。ユーザー決定: **実行順は 22 → 23 → 27**（スマホで確認できる状態を最速で作る）。Firebase Analytics（25）と E2E（26）は後回し。ホスティングは**暫定で GitHub Pages**。
> 共通完了条件: `npm run test` / `type-check` / `lint` / `build` パス + 1 タスク 1 コミット。

## 裁定サマリ（Fable による事前決定）

| # | 論点 | 裁定 |
|---|---|---|
| P1 | GitHub Pages のパス | プロジェクトページ（`https://t-yokota.github.io/youtube-quiz-battle/`）前提。`vite.config.ts` に `base: '/youtube-quiz-battle/'` を設定。**`/data/...` と `/assets/sounds/...` の絶対パス fetch が 404 になるため `import.meta.env.BASE_URL` 前置が必須**（対象 2 箇所: quizDataLoader.ts L45, constants/audio.ts L17。他は rg で全数確認） |
| P2 | デプロイ方式 | GitHub Actions（`actions/deploy-pages`）。main への push で自動デプロイ。**リポジトリが private の場合 Pages は有料プランが必要 — 着手時に public 化の可否をユーザーへ確認**（唯一の要確認点） |
| P3 | ソフトキーボード対応の方式 | **ユーザー裁定（2026-07-03）: タッチデバイス × ANSWERING で動画プレイヤーとボタン領域を非表示にし、解答エリアを画面上部に出す**（ボタンは ANSWERING 中押せないため隠れて問題ない）。visualViewport 追従・--vvh・scrollIntoView は不採用（複雑さに見合わない） |
| P4 | タイマーとキーボードの共存 | ANSWERING でキーボードが出た状態でも、解答エリア（タイマーリング・入力欄・送信）が可視であることを最優先。動画は非表示、ボタンはキーボード下で不可視・機能影響なし |
| P5 | PC キーボードナビ | Tab 順は DOM 順（ヘッダー歯車 → チップページャ → 入力欄 → 送信 → 早押しボタン）で十分。追加の tabindex 制御は行わない。スペースキー早押しは実装済み（`keyboardHandler.ts`）のため、Enter での解答送信（入力欄フォーカス時）だけ確認・不足なら追加 |
| P6 | バンドル予算 | 現状 JS 113.8kB / CSS 33.8kB（gzip 41.5/6.4kB）で十分小さい。分析は `rollup-plugin-visualizer` を devDependency で入れ `npm run analyze` を追加。**予算: JS gzip < 100kB**（現状の 2.4 倍。超えたら分割検討でよい） |
| P7 | 22 の実機確認 | iOS Safari + Android Chrome。27 の Pages デプロイ後に実機 URL で行うのが効率的なので、**22 のコード実装 → 27 デプロイ → 22/23 の実機・手動確認**の順で締める |

---

## Task 22: モバイル最適化

### 22-1. ソフトキーボード対応（2026-07-03 ユーザー裁定で方式変更）

> 当初案（visualViewport でコンテナ高さ追従）は**不採用**。ANSWERING 中のボタンは押せない状態
> （isButtonEnabled=false）なのでキーボードに隠れても問題なく、必要なのは「解答エリアが
> キーボードの上に見えること」だけ。上部の空間を空ける方式で達成する。

1. **タッチデバイス × ANSWERING のとき、VideoPlayer とボタン領域（QuizButton コンテナ）を非表示**にする:
   - タッチ判定は `matchMedia('(pointer: coarse)')`（useOrientationGuard と同じ基準）。App.vue の setup で 1 回評価し `isTouchDevice` 定数化でよい（動的変化は考慮不要）
   - 条件 computed: `isTouchDevice && gameStore.currentState === GameState.ANSWERING`
   - VideoPlayer: 既存の `.player-hidden`（visibility）ではなく **v-show（display:none）で高さごと畳む**（空間を空けるのが目的。iframe は破棄されないのでプレイヤー状態は保持）。既存の FINISHED 用 v-show と条件を合成する
   - QuizButton: 同条件で v-show 非表示（隠れても機能上は問題ないが、非表示にして解答エリアに集中させる）
   - 結果: ヘッダー + スコアボード + 解答エリアのみが残り、解答エリアが画面上部に来るためキーボードと確実に共存する
2. ANSWERING 終了（WAITING/REVEALING 等への遷移）で自動復帰（computed なので追加処理不要）
3. 20-4 の `hideVideoPlayerDuringAnswer`（visibility 方式・高さ保持）とは**別条件の別機構**として共存させる（20-4 は「データ設定による演出」、本件は「モバイル UX」。両方 true の場合は v-show が勝ち高さごと消える — 問題なし）
4. キーボードを閉じても ANSWERING 中は非表示のまま（許容。タイマーが進んでいるため解答に集中する状態は変わらない）
5. テスト: App.vue のロジックは computed 1 個のため単体テストは不要（Task 26 の E2E で担保）。手動確認は 22-3 で実施

### 22-2. タッチ応答の仕上げ

- 早押しボタン・送信ボタンに `touch-action: manipulation`（ダブルタップズームの 300ms 遅延と誤ズーム防止。全 interactive 要素に一括適用でもよい: `button, input { touch-action: manipulation }` を main.css へ）
- `-webkit-tap-highlight-color: transparent` を quiz-button に（タップ時の灰色ハイライトが物理ボタン演出を壊すため）
- 長押しでのコンテキストメニュー/選択が早押しボタンで発生しないこと: `user-select: none`（ボタンラベル）
- index.html の viewport meta に `viewport-fit=cover` を追加し、main.css に `padding: env(safe-area-inset-*)` を .app-container へ（ノッチ対応。縦積み UI なので左右 + 下のみで可）

### 22-3. 実機確認チェックリスト（27 のデプロイ後に実施）

- [ ] iOS Safari / Android Chrome で通しプレイ
- [ ] ANSWERING でキーボードが出ても入力欄・送信・タイマーが見える
- [ ] キーボードを閉じたときレイアウトが復元される
- [ ] ボタン長押し・ダブルタップで選択/ズームが発生しない
- [ ] 横画面警告 → 縦復帰の再開（20-3 の実機確認を兼ねる）
- [ ] 効果音がミュートスイッチ・音量と正しく連動（iOS はサイレントスイッチで Web Audio が消音される仕様 — 仕様どおりでよい）

## Task 23: PC 対応の仕上げ

D-2 で hover / :focus-visible は網羅済みのため**確認 + 差分修正**のタスク。

1. キーボードナビ一巡の確認: Tab 順（歯車 → ページャ → 入力欄 → 送信 → 早押しボタン）で全 interactive 要素に focus リングが出るか。スクリーンショット or 手動確認でよい
2. Enter 送信: 入力欄フォーカス中の Enter で解答送信できるか確認。**現状 input は form 外なので Enter は無反応の可能性が高い** → `@keydown.enter="handleSubmit"` を AnswerContent の input に追加（isSubmitDisabled ガードは handleSubmit 内にあり）
3. スペースキー早押しの動作確認（実装済み。入力欄フォーカス中は発火しないことも含めて確認のみ）
4. ホイール/トラックパッドでリザルトのタイムラインがスクロールできることの確認
5. 修正が発生した場合のみテスト追加（Enter 送信は keyboardHandler 系のテストパターンに倣う）

## Task 27: パフォーマンス最適化とデプロイ準備（GitHub Pages）

### 27-1. ベースパス対応（先にやる — これをしないと Pages で動かない）

1. `vite.config.ts` に `base: '/youtube-quiz-battle/'` を追加
2. 絶対パス fetch の修正（`import.meta.env.BASE_URL` 前置）:
   - `src/services/quizDataLoader.ts` L45: **同一行の三項演算子両辺（sample 側と videoId 側）の 2 リテラル**を `` `${import.meta.env.BASE_URL}data/...` `` に（BASE_URL は末尾スラッシュ付きなので先頭 `/` を除く）
   - `src/constants/audio.ts` L17: 同様に `DEFAULT_AUDIO_SPRITE.src`
   - `rg -n "fetch\(|src: '/|'/data|'/assets" src/` で他に絶対パスが無いことを全数確認
3. ローカル検証: `npm run build && npm run preview` を base 付きで確認（`vite preview` は base を尊重する。`http://localhost:4173/youtube-quiz-battle/` で通しプレイ）
4. テストへの影響: quizDataLoader.test.ts は fetch を stubGlobal でモックし **URL を assert していない**（確認済み）ため修正不要。vitest では base 設定により import.meta.env.BASE_URL が '/youtube-quiz-battle/' になる可能性があるが、URL 非依存のため無害。万一落ちたら報告して止まる

### 27-2. GitHub Actions デプロイ

1. `.github/workflows/deploy.yml` 新規（現在 workflows なし）:
   - trigger: `push: branches: [main]` + `workflow_dispatch`
   - jobs: checkout → setup-node（.nvmrc なければ node 22）→ `npm ci` → `npm run test` → `npm run build` → `actions/upload-pages-artifact`（`dist/`）→ `actions/deploy-pages`
   - permissions: `pages: write, id-token: write`
2. リポジトリ設定（ユーザー作業）: Settings → Pages → Source を GitHub Actions に。**private リポジトリの場合は public 化が必要（要確認 P2）**
3. SPA ルーティングは不使用（クエリパラメータのみ）なので 404.html 対策は不要

### 27-3. ビルド検証・分析

1. `rollup-plugin-visualizer` を devDependency 追加、`npm run analyze`（`vite build --mode analyze` or 環境変数トグル）で stats.html 出力
2. 予算確認: JS gzip < 100kB（P6）。現状 41.5kB なので超過時のみ対策
3. 本番ビルドでの動作確認: preview で通しプレイ + コンソールエラーなし（logger は DEV のみ出力の想定を確認）

### 27-4. 完了条件

- [ ] `https://t-yokota.github.io/youtube-quiz-battle/` で通しプレイができる（スマホ実機含む）
- [ ] main への push で自動デプロイされる
- [ ] 22-3 の実機チェックリストをこの URL で消化

## Task 25（Firebase Analytics）/ Task 26（E2E）— 後回し・未設計

- 25: PrivacyInfo の文言と送信内容の整合（D-15）を含む。着手時に spec を書く（Designer 手順）
- 26: **YouTube iframe のモック方針**（YouTubePlayerManager の注入口 or 実動画）が最大の設計論点。着手時に spec を書く（Designer 手順）。WSL では Playwright headless shell の executablePath 直接指定が必要（環境メモ参照）
- 既知の制約（2026-07-04）: YouTube プレイヤーの操作 UI（シークバー等）はクロスオリジン iframe 内部のため、表示/非表示をスクリプトから制御・タップ模擬できない。一時停止中に UI が表示され続けるのは YouTube 側仕様。消したい場合の唯一の手段は controls=0（シークバーも消える）

## 実行順とコミット

27-1（base 対応）→ 22-1 → 22-2 → 23 → 27-2（デプロイ）→ 27-3 → 実機確認（22-3 + 27-4）。
コミットは `Task 27-1:` のようにサブタスク単位。tasks.md のチェック更新を同コミットに含める。
