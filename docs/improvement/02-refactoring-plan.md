# 02. コードリファクタリング計画（指示書）

> 対象: `src/` 全体。動作・仕様は変更しない（behavior-preserving）。仕様変更を伴うものは `04-task-replan.md` の機能タスク側に分離してある。
> 現状の安全網: テスト 150 件前後（services/stores/utils）。**各リファクタリングタスクの完了条件は共通して「`npm run test` 全件パス + `npm run type-check` パス + `npm run lint` パス」**。

## 実行原則

1. **R-0 を最初に実施**してから着手する（安全網の確認）
2. 1 タスク = 1 コミット（`Task R-X: <内容>` 形式。`.claude/skills/task-commit` 参照）。タスク間はユーザー承認を待たず自律的に連続実行してよい（2026-06-12 改定）
3. 挙動を変えてしまう発見（バグ等）があった場合: **仕様の判断が必要なもの**（設計と実装の矛盾で正解をユーザーが決めるべきもの）はユーザーに確認する。**明白な実装バグ**は自律的に修正してよいが、リファクタリングのコミットに混ぜず別コミットに分ける
4. 推奨実行順: R-0 → R-1 → R-2 → R-3 → R-4 → R-5 → R-6 → R-7 → R-8（後半ほど影響範囲が大きい。R-9 は任意時点で可）

---

## R-0: 安全網の確認とテスト基盤の整え【小】

- [ ] `npm run test` / `npm run type-check` / `npm run lint` が現状すべてパスすることを記録
- [ ] `vitest --coverage` でカバレッジの現状値を記録（`docs/improvement/coverage-baseline.md` に貼る）
- [ ] `src/services/__tests__/gameStore.test.ts` を `src/stores/__tests__/gameStore.test.ts` へ移動（co-location 規約の正位置へ）。`.claude/rules/pinia-store.md` の記述（「services/__tests__ の既存パターン」）も `stores/__tests__` に修正

## R-1: 残骸・未使用コードの削除【小】

| 対象 | 処置 | 根拠 |
|---|---|---|
| `src/stores/counter.ts` | 削除 | Vue scaffolding の残骸。参照ゼロ |
| `src/assets/base.css` | import 元を確認（`main.ts` / `main.css`）。未参照なら削除 | Vue テンプレートのテーマ残骸 |
| `src/assets/logo.svg` | 参照ゼロなら削除 | scaffolding 残骸 |
| `src/components/.gitkeep` ほか各 `.gitkeep` | 削除 | 中身のあるディレクトリに不要 |
| `TimeManager.getCurrentGameState()` / `isInQuestionPeriod()` / `isInRevealPeriod()` / `hasOthersAnsweringPeriodInRange()` | プロダクションコードから参照ゼロ（テストのみが参照）。**削除し、対応テストも削除** | GameManager は applyThresholds 方式に移行済みで、この状態判定 API は設計の名残。残すと「2 つの状態判定ロジック」が併存し将来の乖離バグの温床になる |
| `YouTubePlayerManager.onTimeUpdate()` と `youtubePlayer.ts` の `startTimeUpdate()` 内部インターバル | R-5 で扱う（ここでは削除しない） | 二重ループ問題とセットで対処 |
| `package.json` `name: "temp-vue-project"` | `youtube-quiz-battle` に変更 | D-13 と同件。コードに先行して直してよい |

注意: `getCurrentGameState` 群の削除はテスト件数が減る。削除前後でテスト対象の挙動カバレッジが落ちていないか（applyThresholds 系テストが同じ境界を踏んでいるか）を確認し、不足があれば gameManager.test.ts 側に境界ケースを追補する。

## R-2: マジックナンバーの定数化と enum 利用の徹底【小〜中】

`src/constants/timing.ts` に追加:

```ts
export const BUTTON_PUSHED_DURATION_MS = 100   // PUSHED → RELEASED の演出時間
export const BUTTON_CHECK_RELEASE_MS = 1500    // ボタンチェック時 RELEASED → STANDBY
export const ANSWER_COUNTDOWN_INTERVAL_MS = 1000
export const YOUTUBE_REWIND_THRESHOLD_SEC = 5.5 // gameManager.ts のクラス内定数から移動
export const YT_API_LOAD_TIMEOUT_MS = 10000
export const YT_API_POLL_INTERVAL_MS = 100
```

置換対象:
- `gameManager.ts`: `setTimeout(..., 100)` / `setTimeout(..., 1500)` / `setInterval(..., 1000)` / `YOUTUBE_REWIND_THRESHOLD_SEC` クラスフィールド
- `gameManager.ts`: 生数値のプレイヤー状態比較 `playerState === 1` / `=== 2` / `=== 3` → `YouTubePlayerState.PLAYING / PAUSED / BUFFERING`（enum は定義済みなのに使われていない箇所が 5 箇所以上ある）
- `youtubePlayer.ts`: `100`（ポーリング）, `10000`(タイムアウト), `1000`（loadVideo の擬似待機）
- `youtubePlayer.ts`: `modestbranding: 1` を削除（YouTube 側で廃止済み。D-8 連動）

## R-3: console.log の logger 化【中】

現状 `src/` に 42 箇所の `console.*` がプロダクションコードに直書きされている。

1. `src/utils/logger.ts` を新規作成:
   ```ts
   /* DEV ビルドでのみ出力するロガー。本番ビルドでは no-op */
   const enabled = import.meta.env.DEV
   export const logger = {
     log: (...args: unknown[]) => { if (enabled) console.log(...args) },
     warn: (...args: unknown[]) => { if (enabled) console.warn(...args) },
     error: (...args: unknown[]) => { console.error(...args) }, // error は本番でも出す
   }
   ```
2. 全 `console.log` / `console.warn` を `logger.log` / `logger.warn` に置換（`console.error` は `logger.error`）
3. `eslint.config.ts` に `'no-console': ['error', { allow: [] }]` を追加（`src/utils/logger.ts` のみ override で許可）
4. テストコード（`__tests__/`）は対象外

## R-4: gameStore 直接変更の排除（ストア規約違反の解消）【中】

`.claude/rules/pinia-store.md` は「状態の変更は store 内の action / setter 経由」と定めるが、`gameManager.ts` が以下を直接代入している:

| 違反箇所 | 追加するアクション |
|---|---|
| `this.gameStore.buttonState = ButtonState.PUSHED` ほか（handleButtonPress 内 3 箇所） | `setButtonState(state: ButtonState)` |
| `this.gameStore.answerTimeRemaining = ...` / `this.gameStore.answerTimeRemaining--`（カウントダウン） | `resetAnswerTime()` / `decrementAnswerTime(): number`（減算後の値を返す） |
| `this.gameStore.currentQuestionIndex = question.index`（applyThresholds / onStart） | `setCurrentQuestionIndex(index: number)` |

手順: gameStore にアクションを追加 → gameManager の代入を全置換 → 既存テストがそのまま通ることを確認（テストが内部代入に依存していたら public アクション経由に書き換え）。

## R-5: 時間更新ループの一本化とリソースリーク修正【中】

**問題1（二重ループ）**: `youtubePlayer.ts` の `startTimeUpdate()` が onReady 時に 150ms インターバルを開始するが、`onTimeUpdate` コールバックを誰も登録しないため**永久に空振りするインターバルが常駐**している。実際の時間更新は App.vue 側の `timeUpdateTick` インターバルが行っており、機構が二重。

**問題2（リーク）**:
- `App.vue` の `onUnmounted` で `playerManager.destroy()` が呼ばれない
- `loadYouTubeIframeAPI()`: スクリプトタグ既存パスの `checkInterval` に打ち切りがない / 10 秒 reject の `setTimeout` が成功時に `clearTimeout` されない
- `GameManager.setupVisibilityHandlers()` / `setupPlayerStateHandlers()` のリスナー（document / window）が解除不能（参照を保持していない）

修正指示:
1. `YouTubePlayerManager` interface から `onTimeUpdate` を削除し、`youtubePlayer.ts` の `startTimeUpdate` / `timeUpdateInterval` を削除（時間取得は呼び出し側の `getCurrentTime()` ポーリングに一本化）
2. App.vue のループ処理を composable `src/composables/useGameLoop.ts` に抽出（`start(playerManager, gameManager)` / `stop()` を公開。STARTUP_GRACE_MS 処理ごと移動）。`src/composables/` ディレクトリは design.md の構成に既定されているが現状空
3. `GameManager` に `destroy(): void` を追加: カウントダウン停止 + 登録済みリスナー解除（リスナーはフィールドに参照を保持する形に変更）
4. `App.vue` の `onUnmounted` で `useGameLoop().stop()` → `gameManager.destroy()` → `playerManager.destroy()` を呼ぶ
5. `loadYouTubeIframeAPI` の `checkInterval` に `YT_API_LOAD_TIMEOUT_MS` の打ち切りを追加し、成功時に reject タイマーを `clearTimeout`

テスト追補: gameManager.test.ts に destroy 後にリスナー・タイマーが発火しないことの検証を追加。

## R-6: GameManager（799 行）の責務分割【大】

コーディング規約の上限（800 行）に到達済み。責務単位で 3 モジュールに分割し、GameManager をファサードとして薄くする。

```
src/services/
├── gameManager.ts            # ファサード。公開 API は現状維持（テスト互換）
├── thresholdEngine.ts        # 新規: consumed 管理 + applyThresholds / processTimeWindow
│                             #   / consumeQuestionsBySeek / recordSkippedQuestion
├── externalPauseController.ts # 新規: pauseExternal / resumeExternal / checkStall
│                             #   / visibility・playerState ハンドラ / YouTube rewind 補正
└── answerFlowController.ts   # 新規: カウントダウン (start/resume/stop/timeout)
                              #   / handleAnswerSubmit / resumeVideoAfterAnswer / submitAnswer(jump)
```

設計上の制約:
- **公開 API（`handleButtonPress` / `handleAnswerSubmit` / `handleReplay` / `updateVideoTime` / `checkStall` / `pauseExternal` / `resumeExternal` / `isExternalPaused` / `initializeExternalPauseHandling` / `resetGame` / `destroy`）は GameManager に残す**。既存テスト（gameManager.test.ts / gameStore.test.ts の統合テスト）を変更せずに通すことが分割の正しさの証明になる
- `consumed` フラグの所有者は thresholdEngine。externalPauseController の rewind 補正が consumed をリセットする必要があるため、thresholdEngine に `resetConsumedForQuestion(index)` / `isConsumed(index)` 等の明示メソッドを設ける（Record を直接渡さない）
- `internalAction` フラグは「プレイヤー操作 API を内部から呼ぶ際のガード」なので、playerManager をラップする小さな `internalPlayerControl`（または answerFlowController 内のヘルパ）に集約し、`internalAction = true/false` の手動対が散在する現状（9 箇所）を `withInternalAction(() => ...)` に統一する
- 各新モジュールは 200〜350 行を目安とする

完了条件（追加）: 既存の gameManager.test.ts を**無修正**で全件パス。

## R-7: コンポーネント層の整理【中】

### R-7a: ButtonState の二重表現を解消

`QuizButton.vue` の props が `'standby' | 'pushed' | ...`（小文字 union）で、App.vue が `toLowerCase() as ...` でキャストしている（`buttonStateProp` computed。eslint 誤検出回避コメント付き）。

- `QuizButton.vue` の props を `ButtonState`（enum, `@/types`）に変更し、クラス名変換（小文字化）はコンポーネント内部の computed で行う
- App.vue の `buttonStateProp` computed とキャスト・回避コメントを削除

### R-7b: props バケツリレーの解消

GamePanel は 11 個の props を App → GamePanel → AnswerContent と中継しているだけで、すべて gameStore 由来。プロジェクト規約（vue-component.md「状態変更は Pinia ストア経由」）の精神に沿い、**表示系コンポーネントが gameStore を直接読む**形に変更する。

- `GamePanel.vue` / `GameInfo.vue` / `AnswerContent.vue` / `GuideText.vue`: `useGameStore()` を直接参照し、props を撤去（汎用部品として残したいものは props 維持でよいが、現状この 4 つはゲーム専用）
- emits（submit / updateInput）は維持してよいが、`updateInput` は store アクション `updateAnswerInput` を直接呼ぶ方が単純
- `GamePanel.vue` の不適切なデフォルト値（`totalQuestions: 5` 等）はこの変更で消滅する
- App.vue は「レイアウト + GameManager への委譲」だけになる

注意: 解答送信は GameManager 経由必須（タイマー停止・動画再開を伴う）なので、submit イベント → App → `gameManager.handleAnswerSubmit()` の経路は維持する。

### R-7c: エラーメッセージ表示の暫定改善は行わない

エラーコード→メッセージ変換は Task 20（errorHandler）の仕事。リファクタリングでは触らない。

## R-8: スタイル基盤の統一（デザイントークン導入）【大・デザイン改善と連動】

**現状の問題**: `.claude/rules/vue-component.md` は「Tailwind CSS v4 のクラスを使用」と定めるが、実装はほぼ全コンポーネントが scoped CSS + ハードコード 16 進カラー（`#2563eb` が 8 ファイルに重複等）。ルールと実態が乖離し、`max-width: 640px` / `max-height: 700px` の media query が 6 コンポーネントにコピペされている。

**方針: A に決定（2026-06-12 ユーザー確認済み）**:
- **A. デザイントークン + Tailwind ユーティリティへ段階移行**: `src/assets/main.css` に Tailwind v4 の `@theme` でトークン（色・余白・radius・shadow・duration）を定義し、新規/変更コンポーネントから順次ユーティリティクラスへ移行。`05-design-review.md` のケース 1 トークン（`wireframe-v2-case1.html` の `:root` 変数）をそのまま `@theme` に写経する
- ~~B. ルール側を現実（scoped CSS + 共通カスタムプロパティ）に合わせて書き換える~~（不採用）

実行順: ケース 1 デザイン適用タスク（`04-task-replan.md` Phase D）と統合して 1 つの流れで行う。**純リファクタリング（見た目不変）としてやるなら、トークン定義 + 既存 16 進値のトークン置換まで**に留め、見た目変更は Phase D に送る。

## R-9: gameStore.handleAnswerSubmit の遷移責務の整理【中・任意】

正解時に store が無条件で `WAITING` へ遷移した後、`jumpToRevealPeriod=true` の場合 GameManager.submitAnswer が `REVEALING` に上書きするため、**一瞬 WAITING を経由するちらつき**（UI 上は 1 フレーム未満だが、状態ログ・テストの可読性に影響）がある。

修正案: store の `handleAnswerSubmit` は「判定 + 記録 + `{isCorrect, isFinal}` 返却」までに縮小し、**遷移先の決定は GameManager（answerFlowController）が一元的に行う**。store / manager 双方のテスト修正を伴うため、R-6 完了後に実施する。

また `GameManager.submitAnswer()` と `handleAnswerSubmit()` の紛らわしい命名は、R-6 分割時に `submitAnswer` → `jumpToRevealIfConfigured(questionIndex, isCorrect)` 等の意図が読める名前に変更する。

---

## 実施しないこと（明示）

- 状態機械ライブラリ（XState 等）の導入: 現行の applyThresholds + Single-Shot Guard はテストで保護されており、置き換えのリスクがリターンを上回る
- ビルド構成・依存の大規模更新（Vite 7 / Vitest 4 / Tailwind 4 は十分新しい）
- services のクラス→関数型への書き換え等、趣味的な変更

## タスクサイズと依存関係まとめ

| タスク | サイズ | 依存 | リスク |
|---|---|---|---|
| R-0 安全網 | S | - | なし |
| R-1 残骸削除 | S | R-0 | 低 |
| R-2 定数化 | S | R-0 | 低 |
| R-3 logger | M | R-0 | 低 |
| R-4 ストアアクション化 | M | R-0 | 低 |
| R-5 ループ一本化 + リーク修正 | M | R-2 | 中（手動での動作確認必須: 再生/タブ切替/リプレイ） |
| R-6 GameManager 分割 | L | R-2, R-4, R-5 | 中（テスト無修正パスが条件） |
| R-7 コンポーネント整理 | M | R-4 | 低 |
| R-8 デザイントークン | L | - | 低（Phase D と統合可） |
| R-9 遷移責務整理 | M | R-6 | 中 |

手動動作確認チェックリスト（R-5 / R-6 完了時に必ず実施）:
- [ ] サンプルデータで通しプレイ（5 問、正解/不正解/タイムアウト各 1 回以上）
- [ ] タブ切り替え → 復帰（ANSWERING 中 / 再生中の両方）
- [ ] 動画再生開始 5 秒以内のタブ切替（YouTube rewind 補正の発火確認）
- [ ] もう一度プレイ → 2 周目完走
- [ ] disableSeekbar=false データでのシークスキップ動作
