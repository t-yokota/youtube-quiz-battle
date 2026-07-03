# Phase 4 実行spec: 品質・リリース（22 / 23 / 27 優先、25 / 26 は後回し）

> 作成: 2026-07-03（Fable 5 による事前設計）。ユーザー決定: **実行順は 22 → 23 → 27**（スマホで確認できる状態を最速で作る）。Firebase Analytics（25）と E2E（26）は後回し。ホスティングは**暫定で GitHub Pages**。
> 共通完了条件: `npm run test` / `type-check` / `lint` / `build` パス + 1 タスク 1 コミット。

## 裁定サマリ（Fable による事前決定）

| # | 論点 | 裁定 |
|---|---|---|
| P1 | GitHub Pages のパス | プロジェクトページ（`https://t-yokota.github.io/youtube-quiz-battle/`）前提。`vite.config.ts` に `base: '/youtube-quiz-battle/'` を設定。**`/data/...` と `/assets/sounds/...` の絶対パス fetch が 404 になるため `import.meta.env.BASE_URL` 前置が必須**（対象 2 箇所: quizDataLoader.ts L45, constants/audio.ts L17。他は rg で全数確認） |
| P2 | デプロイ方式 | GitHub Actions（`actions/deploy-pages`）。main への push で自動デプロイ。**リポジトリが private の場合 Pages は有料プランが必要 — 着手時に public 化の可否をユーザーへ確認**（唯一の要確認点） |
| P3 | ソフトキーボード対応の方式 | `visualViewport` の `resize` を監視する composable `useVisualViewport` を新設し、キーボード表示中は App コンテナの高さを `visualViewport.height` に追従させる（`--vvh` カスタムプロパティ）。ANSWERING 時に入力欄が隠れる問題は「コンテナ縮小 + 解答エリアへの scrollIntoView」で対処。iOS Safari の `100vh` 問題も同時に解消（既存の `100dvh` スケール式は `100dvh` のままでよい — dvh はキーボードでは変化しないため、キーボード分は --vvh で別途縮める） |
| P4 | タイマーとキーボードの共存 | ANSWERING でキーボードが出た状態でも、解答エリア（タイマーリング・入力欄・送信）が可視であることを最優先。動画・スコアボードは隠れてよい（visualViewport 縮小時は上部が画面外にスクロールアウトする形を許容） |
| P5 | PC キーボードナビ | Tab 順は DOM 順（ヘッダー歯車 → チップページャ → 入力欄 → 送信 → 早押しボタン）で十分。追加の tabindex 制御は行わない。スペースキー早押しは実装済み（`keyboardHandler.ts`）のため、Enter での解答送信（入力欄フォーカス時）だけ確認・不足なら追加 |
| P6 | バンドル予算 | 現状 JS 113.8kB / CSS 33.8kB（gzip 41.5/6.4kB）で十分小さい。分析は `rollup-plugin-visualizer` を devDependency で入れ `npm run analyze` を追加。**予算: JS gzip < 100kB**（現状の 2.4 倍。超えたら分割検討でよい） |
| P7 | 22 の実機確認 | iOS Safari + Android Chrome。27 の Pages デプロイ後に実機 URL で行うのが効率的なので、**22 のコード実装 → 27 デプロイ → 22/23 の実機・手動確認**の順で締める |

---

## Task 22: モバイル最適化

### 22-1. ソフトキーボード対応（本丸）

1. 新規 composable `src/composables/useVisualViewport.ts`:
   ```ts
   /** visualViewport の高さを CSS 変数 --vvh (px) として documentElement に反映する。
       未対応環境（visualViewport 無し）では何もしない（--vvh 未設定時のフォールバックは CSS 側の 100dvh） */
   export function useVisualViewport(): { stop(): void }
   ```
   - **起動パターンは useOrientationGuard と同じ即時開始型**（呼び出しと同時にリスナー登録 + 現在値を反映。`.start()` は設けない）
   - `window.visualViewport?.addEventListener('resize', ...)` で `document.documentElement.style.setProperty('--vvh', `${height}px`)`
   - `stop()` でリスナー解除 + `--vvh` プロパティを削除（removeProperty）。App.vue の setup で呼び、**onUnmounted では stopOrientationGuard() の直後**に stop を呼ぶ
2. `src/App.vue`: `.app-container` の `height: 100vh`（**App.vue の scoped style 内。main.css には無い**）を `height: var(--vvh, 100dvh)` に変更（main.css の rem スケール式の `100dvh` は**変更しない** — UI 比率はレイアウトビューポート基準を維持し、キーボード分はコンテナ縮小のみで吸収）
   - main.css の `html, body { height: 100% }` は**変更しない**。キーボード表示中は body より container が短くなるが、露出する body 背景が白くならないよう `body { background: var(--color-stage-900) }` を main.css に追加しておく
3. ANSWERING 遷移時のオートフォーカス watch（AnswerContent の **isInputDisabled を監視している方**。answerResult 監視の方は触らない）に `inputRef.value?.scrollIntoView({ block: 'nearest' })` を focus() の直後に追加
4. テスト: useVisualViewport の単体テスト。**jsdom に visualViewport は無いため**、`Object.defineProperty(window, 'visualViewport', { value: mockVV, configurable: true })` で addEventListener/removeEventListener/height を持つモックを注入する方式（afterEach で削除）。検証: resize で --vvh 反映 / visualViewport 未定義環境で no-op / stop 後に反映されない + プロパティ削除

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

## 実行順とコミット

27-1（base 対応）→ 22-1 → 22-2 → 23 → 27-2（デプロイ）→ 27-3 → 実機確認（22-3 + 27-4）。
コミットは `Task 27-1:` のようにサブタスク単位。tasks.md のチェック更新を同コミットに含める。
