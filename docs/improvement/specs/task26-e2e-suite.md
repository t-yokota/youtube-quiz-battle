# Task 26 実行spec: E2E テストスイート（Playwright）

> 作成: 2026-07-05（Fable 5 による設計）。旧 23-2（クロスブラウザ）を吸収。
> 完了条件: `npm run test:e2e` が chromium で全パス + `npm run test` / `type-check` / `lint` / `build` パス。

## 概要

Playwright で通しプレイ・External Pause 復帰・シーク 2 モード・リプレイ・視覚回帰を自動化する。
**最大の設計論点だった YouTube のモック方針は「`window.YT` のフェイク実装を addInitScript で注入」に確定**する（実動画は不安定・低速・広告変動があるため不採用）。アプリ側コードは無改修でよい: `loadYouTubeIframeAPI()` は `window.YT && window.YT.Player` が既に存在すれば即 resolve するため、注入だけで全経路がフェイクに乗る。

## 26-1. 導入

- `npm install -D @playwright/test`
- `npx playwright install chromium webkit firefox`（システム依存は 2026-06-11 に install-deps 済み。
  ※過去メモの「headless shell 1217 を executablePath 指定」は npx キャッシュの MCP 用の話であり、
  プロジェクト devDependency として入れる場合は通常の `playwright install` でバージョン整合する）
- `playwright.config.ts`（リポジトリルート）:
  - `webServer: { command: 'npm run preview', port: 4173, reuseExistingServer: true }`（本番ビルドを対象にする。CI では事前に `npm run build`）
  - `use: { baseURL: 'http://localhost:4173/youtube-quiz-battle/' }`（vite base に合わせる）
  - projects: `chromium`（既定・モバイルビューポート 390x844）+ `webkit` / `firefox`（同設定。ローカルでは `--project=chromium` を常用）
- npm scripts: `"test:e2e": "playwright build 済み前提で playwright test"`、`"test:e2e:ui": "playwright test --ui"`（正確なコマンドは実装時に整える。unit テストの `npm run test` に E2E が混ざらないこと）
- `e2e/` ディレクトリをルートに新設（unit の `__tests__/` co-locate 規約とは独立）。tsconfig への include 追加と ESLint 対象化を行う

## 26-2. YouTube フェイク（`e2e/support/fakeYouTube.ts`）

`page.addInitScript` で注入する自己完結スクリプト。実装要件:

```ts
// window.YT を定義する。PlayerState 定数は実 API と同値（UNSTARTED:-1, ENDED:0, PLAYING:1, PAUSED:2, BUFFERING:3, CUED:5）
class FakePlayer {
  // constructor(elementId, { videoId, playerVars, events })
  // - 生成後 setTimeout(0) で events.onReady を発火
  // - DOM には黒背景の div を挿入（見た目のプレースホルダ。視覚回帰の安定化のため単色）
  playVideo()   // state=PLAYING にし onStateChange 発火。250ms 刻みの内部タイマーで currentTime を進める
  pauseVideo()  // state=PAUSED にし onStateChange 発火。タイマー停止
  getCurrentTime() / getDuration()  // duration はクイズデータより十分長い固定値（例 120）
  getPlayerState() / destroy()
  loadVideoById(id)  // 現行フローでは未使用（manager.loadVideo の呼び出し元なし）だが、
                     // マネージャの実装が参照するため no-op で用意しておく
  seekTo(t, allowSeekAhead)  // ※実マネージャは第 2 引数付きで呼ぶ（seekTo(time, true)）
  // 終端: currentTime >= duration で ENDED を発火
}
// テストから直接制御するためのグローバルフック
window.__ytFake = {
  get player(),            // 最後に生成された FakePlayer
  setTime(t: number),      // currentTime を直接設定（シーク相当ではなく時間ワープ。onStateChange は発火しない）
  fireState(state: number) // 任意の onStateChange を強制発火（ENDED や spurious PLAYING の再現用）
}
```

- 時間の進行は実時間 250ms 刻み（アプリの時間更新ループが getCurrentTime ポーリングのため、実時間進行が最も忠実）。
  長い待ちを避けたいテストは `__ytFake.setTime()` でワープしてよい（アプリはシーク検知閾値 1 秒があるため、
  スキップ判定を試すテストではむしろワープが正攻法）

## 26-3. テスト用クイズデータ（`e2e/fixtures/quiz-data.json`）

- `page.route('**/data/sample/data.json', route => route.fulfill(fixture))` で差し替える
- 内容: 2 問・時間を短く（Q1 start=3 / reveal=6 / end=9、Q2 start=12 / reveal=15 / end=18）、
  `answerTimeLimit: 5, maxAttempts: 2, disableSeekbar: false, buttonCheckEnabled: true, debug: false`
- 解答は ASCII（例: "a"）にして IME 依存を避ける（fill() は composition を経ないため日本語でも動くが、安定側に倒す）

## 26-4. シナリオ（`e2e/*.spec.ts`）

共通セットアップ: addInitScript（フェイク注入）→ route 差し替え → goto → ゲートタップ（「タップしてはじめる」）。

1. **通しプレイ**（play-through.spec.ts）
   - ボタンチェック → 自動再生開始（VIDEO_START_DELAY_MS 経過を待つ）→ Q1 で早押し → 正解入力 → 正解バナー
   - Q2 は時間切れ（未解答）→ REVEALING → ENDED（`__ytFake.setTime(duration)` + fireState(ENDED)）→ リザルト画面表示・○×の内訳
2. **不正解と解答回数**: Q1 で誤答 ×2 → 解答権 0 → ×チップ即時反映
3. **シーク 2 モード**（seek.spec.ts）
   - 許可: `__ytFake.setTime()` で Q1 を跨いだ位置へワープ → Q1 がスキップ表示
   - 禁止（設定トグル OFF → ユーザー上書き）: プレイヤー操作相当の seek 後に元位置へ戻される（fireState + setTime で再現）
4. **External Pause 復帰**（external-pause.spec.ts）
   - 再生中に `fireState(PAUSED)`（ユーザー一時停止）→ ガイド文言 → `fireState(PLAYING)` で復帰
   - visibility: `page.evaluate` で document.hidden を偽装し visibilitychange を dispatch → 復帰
5. **リプレイ**（replay.spec.ts）: リザルト → もう一度プレイ → READY に戻る・チップリセット・（回転や spurious PLAYING で誤開始しない）
6. **視覚回帰**（visual.spec.ts）: 320 / 375 / 430 幅で READY・QUESTIONING・リザルトの `toHaveScreenshot()`。
   フェイクプレイヤーは単色なのでスクリーンショットが安定する。タイマー等の動的要素は `mask` で除外

## 26-5. クロスブラウザ（旧 23-2）

- 上記 1（通しプレイ）と 4（External Pause）を webkit / firefox でも実行（projects 設定で自動）
- 視覚回帰は chromium のみ（ブラウザ間のフォントレンダリング差でベースラインが割れるため）

## 26-6. CI（任意・後続）

- GitHub Actions に E2E ジョブを追加する場合: `npx playwright install --with-deps chromium` + chromium のみ実行。
  デプロイワークフローには**組み込まない**（Pages デプロイの所要時間を悪化させない）。本 spec の完了条件にも含めない

## 手動確認

- [ ] `npm run test:e2e -- --project=chromium` 全パス
- [ ] `--ui` モードでフェイクプレイヤーの挙動が目視で妥当
- [ ] 視覚回帰ベースラインの見た目が実機表示と乖離していない

## やらないこと

- 実 YouTube 動画での E2E（不安定・広告・レート制限のため）
- モバイル実機/エミュレータでの E2E（実機チェックリストで手動確認）
- Firebase Analytics イベントの E2E 検証（Task 25 の DebugView 手動確認で担保）
