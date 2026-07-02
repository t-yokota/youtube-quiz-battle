# R-6 実行spec: GameManager 3分割設計

> 作成: 2026-07-02（Fable 5 による事前設計）。実装者はこの spec のみで作業を完結できることを意図している。
> 対象コミット基準: `074dcc4`（R-5 完了後）。gameManager.ts は現在 895 行。
> 完了条件: `npm run test` 全件パス（**gameManager.test.ts は無修正**）+ `npm run type-check` + `npm run lint` パス + 各新モジュール 350 行以下 + gameManager.ts 300 行以下。

## 1. 分割後の構成と依存方向

```
src/services/
├── gameManager.ts              # ファサード（公開API維持、~250行）
├── internalPlayerControl.ts    # 新規: internalAction ガードの一元化（~60行）
├── thresholdEngine.ts          # 新規: consumed 管理 + 閾値走査（~330行）
├── answerFlowController.ts     # 新規: 解答フロー + カウントダウン（~200行）
└── externalPauseController.ts  # 新規: External Pause + stall + rewind 補正（~300行）
```

依存方向（矢印 = import する側 → される側）。**循環禁止**:

```
gameManager ──→ thresholdEngine
gameManager ──→ answerFlowController ──→ thresholdEngine, internalPlayerControl
gameManager ──→ externalPauseController ──→ thresholdEngine, answerFlowController, internalPlayerControl
gameManager ──→ internalPlayerControl
```

- `thresholdEngine` は他の新モジュールを import しない（最下層）
- `internalPlayerControl` は `YouTubePlayerManager` のみに依存
- ストア型は全モジュールで `ReturnType<typeof useGameStore>`（現行踏襲、`import type`）

## 2. internalPlayerControl.ts

現行の `internalAction = true/false` 手動対（9 箇所: L111-113, 200-202, 206-208, 235-237, 242-244, 283-285, 359-361, 435-437, 532-534, 842-845）を集約する。

```ts
import type { YouTubePlayerManager } from '@/types'

/** 内部操作ガード付きプレイヤー制御。onStateChange 側はこのフラグで内部操作由来の状態変化を無視する */
export class InternalPlayerControl {
  private playerManager: YouTubePlayerManager
  private internalAction = false

  constructor(playerManager: YouTubePlayerManager)

  /** fn 実行中だけ internalAction を立てる（同期のみ。fn 内で await しないこと） */
  withInternalAction(fn: () => void): void
  isInternalAction(): boolean

  // 透過プロキシ（ガードなし読み取り系）
  getCurrentTime(): number
  getPlayerState(): number
  onStateChange(cb: (state: number) => void): void

  // ガード付きショートハンド（withInternalAction で包んで委譲）
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number): void
}
export function createInternalPlayerControl(pm: YouTubePlayerManager): InternalPlayerControl
```

実装注意:
- `seekTo + playVideo` を連続で行う箇所（submitAnswer, L842-845）は `withInternalAction(() => { pc.seekToRaw...; })` ではなく **`withInternalAction` に生の playerManager 操作を書く形でも、ショートハンド 2 連続でもよい**（各呼び出しが同期でフラグを閉じるため挙動同一。現行も同期対なので等価）。簡潔さ優先でショートハンド連続呼びを推奨。
- `getPlayerState()` の戻り値は現行どおり number（`YouTubePlayerState` enum と比較）。

## 3. thresholdEngine.ts

**責務**: consumed フラグの唯一の所有者。時間窓 (prev, curr] の閾値走査・シーク消費・スキップ記録・start/reveal/end ハンドラ。

移動するメンバー（現 gameManager.ts の行番号）:

| 現メンバー | 行 | 移動後 |
|---|---|---|
| `interface ConsumedFlags` | L21-25 | そのまま移動（非export でよい） |
| `consumed: Record<number, ConsumedFlags>` | L47 | private フィールド |
| `processTimeWindow(prev, curr)` | L620-625 | public |
| `applyThresholds(prev, curr, question)` | L633-736 | private |
| `consumeQuestionsBySeek(prev, curr)` | L561-613 | public |
| `recordSkippedQuestion(index, isSkip)` | L743-766 | private |
| `onStart / onReveal / onEnd` | L772-815 | private |
| resetGame 内の `this.consumed = {}` | L83 | `resetAll()` |
| resumeExternal 内の consumed リセットループ | L320-336 | `resetUnansweredConsumed()`（下記） |
| submitAnswer 内の `c.reveal = true` 先行設定 | L836-839 | `markRevealConsumed(index)` |

公開インターフェース:

```ts
export class ThresholdEngine {
  constructor(quizData: QuizData, gameStore: ReturnType<typeof useGameStore>)

  /** (prev, curr] 窓の全問題の閾値を走査し状態遷移を処理（現 processTimeWindow と同一） */
  processTimeWindow(prev: number, curr: number): void

  /** シークで飛ばした問題を消費扱いにし、シーク後状態へ遷移（現 consumeQuestionsBySeek と同一） */
  consumeQuestionsBySeek(prev: number, curr: number): void

  /** submitAnswer の二重発火防止用: reveal フラグのみ先行消費 */
  markRevealConsumed(questionIndex: number): void

  /** システム巻き戻り時: 解答記録がない（または skipped の）問題の consumed をリセット。
      skipped 結果は gameStore.removeResult で削除する（現 L320-336 のループ全体をこの中へ移動） */
  resetUnansweredConsumed(): void

  /** resetGame 用: 全 consumed を破棄 */
  resetAll(): void
}
export function createThresholdEngine(...): ThresholdEngine
```

制約:
- `consumed` の Record を外部に返さない（getter 禁止）。externalPauseController は `resetUnansweredConsumed()` のみ呼ぶ。
- ロジックは**一切変更しない**（コピー移動）。logger のプレフィックスは `[ThresholdEngine]` に変えてよい（テストは logger 出力に依存していない。**変更前に gameManager.test.ts を grep して console/logger への assertion がないことを確認**）。

## 4. answerFlowController.ts

**責務**: 解答カウントダウン、解答送信、解答後の動画再開、jumpToRevealPeriod シーク。

| 現メンバー | 行 | 移動後 |
|---|---|---|
| `answerCountdownInterval` | L53 | private |
| `startAnswerCountdown / resumeAnswerCountdown / stopAnswerCountdown` | L123-158 | public（externalPauseController が stop/resume を呼ぶため） |
| `handleAnswerTimeout` | L164-173 | private |
| `handleAnswerSubmit(answer)` | L179-186 | public |
| `resumeVideoAfterAnswer(result)` | L192-210 | private |
| `submitAnswer(questionIndex, isCorrect)` | L822-852 | public、**`jumpToRevealIfConfigured(questionIndex, isCorrect)` にリネーム**（02-refactoring-plan R-9 で予告済みのリネームを分割時に実施） |

```ts
export class AnswerFlowController {
  constructor(
    playerControl: InternalPlayerControl,
    quizData: QuizData,
    gameStore: ReturnType<typeof useGameStore>,
    timeManager: TimeManager,
    thresholdEngine: ThresholdEngine,
  )
  startAnswerCountdown(): void
  resumeAnswerCountdown(): void
  stopAnswerCountdown(): void
  handleAnswerSubmit(answer: string): void
  /** 旧 submitAnswer。jumpToRevealPeriod=true かつ currentVideoTime < revealTime のときのみシーク */
  jumpToRevealIfConfigured(questionIndex: number, isCorrect: boolean): void
}
```

注意:
- 旧 `submitAnswer` 内の consumed 直接操作（L836-839）は `thresholdEngine.markRevealConsumed(questionIndex)` に置換。
- `resumeVideoAfterAnswer` が呼ぶ旧 `this.submitAnswer(...)`（L196）は `this.jumpToRevealIfConfigured(...)` になる。
- **ファサードの公開 API 名 `submitAnswer` は gameManager に残す**（テスト互換）: `submitAnswer(i, c) { this.answerFlow.jumpToRevealIfConfigured(i, c) }`。

## 5. externalPauseController.ts

**責務**: External Pause の開始/解除、visibility/pagehide/pageshow ハンドラ、プレイヤー状態変化ハンドラ、stall 検出、YouTube rewind 補正。

| 現メンバー | 行 | 移動後 |
|---|---|---|
| `externalPaused / externalPausedReason` | L38-39 | private |
| `lastWallMs / lastVideoTime` | L43-44 | private |
| `hasPassedRewindThreshold` | L50 | private（後述の updateRewindThreshold で更新） |
| `visibilityChangeHandler / pageHideHandler / pageShowHandler` | L56-58 | private |
| `isExternalPaused()` | L255-257 | public |
| `pauseExternal(reason)` | L263-287 | public |
| `resumeExternal()` | L292-363 | public |
| `setupVisibilityHandlers()` | L368-412 | **public**（gameManager.test.ts が直接呼んでいるためファサード委譲が必要。検証済み 2026-07-02） |
| `setupPlayerStateHandlers()` | L417-447 | **public**（同上） |
| `checkStall(wallMs, videoTime)` | L454-485 | public |
| `initializeExternalPauseHandling()` | L490-495 | public → `initialize()` に改名可（ファサード側で旧名維持） |
| updateVideoTime 内の rewind 閾値通過チェック | L518-521 | `updateRewindThreshold(current)` public |
| destroy 内のリスナー解除 | L869-880 | `destroy()` public |
| handleReplay 内の external クリア | L104-105 | `resetPauseState()` public（externalPaused/reason を false/null に） |
| resetGame 内の `hasPassedRewindThreshold = false` | L80 | `resetRewindThreshold()` public（または resetPauseState に統合せず別メソッド。resetGame は rewind のみ、handleReplay は両方呼ぶ点に注意） |

```ts
export class ExternalPauseController {
  constructor(
    playerControl: InternalPlayerControl,
    quizData: QuizData,
    gameStore: ReturnType<typeof useGameStore>,
    timeManager: TimeManager,
    thresholdEngine: ThresholdEngine,
    answerFlow: AnswerFlowController,
  )
  initialize(): void                       // 旧 initializeExternalPauseHandling
  isExternalPaused(): boolean
  pauseExternal(reason: 'visibility' | 'user' | 'stall'): void
  resumeExternal(): void
  checkStall(currentWallMs: number, currentVideoTime: number): void
  updateRewindThreshold(current: number): void
  resetRewindThreshold(): void
  resetPauseState(): void
  destroy(): void
}
```

注意:
- `resumeExternal` 内の consumed リセットループ（L320-336）は丸ごと `thresholdEngine.resetUnansweredConsumed()` 呼び出しに置換。**quizData への依存はループ移設後も rewind 判定で不要になるか確認し、不要なら constructor から quizData を外す**（現状 L320 のループ以外に quizData 参照なし → 移設後は外せる。外した場合は上記シグネチャから削除）。
- `setupPlayerStateHandlers` の `onStateChange` コールバック内 `if (this.internalAction) return`（L420）は `if (this.playerControl.isInternalAction()) return` に置換。ANSWERING 中の強制 pause（L435-437）は `playerControl.pauseVideo()`。
- pause/resume 中の ANSWERING 分岐（L280-286, L356-362）は `answerFlow.stopAnswerCountdown()` / `answerFlow.resumeAnswerCountdown()` を呼ぶ。

## 6. gameManager.ts（ファサード）

残すもの: 公開 API 全部 + `handleButtonPress` の実体 + `updateVideoTime` のオーケストレーション + `resetGame`/`handleReplay` + `destroy` + コンストラクタでの各コントローラ生成。

```ts
export class GameManager {
  private timeManager: TimeManager
  private playerControl: InternalPlayerControl
  private thresholdEngine: ThresholdEngine
  private answerFlow: AnswerFlowController
  private externalPause: ExternalPauseController
  private gameStore: ReturnType<typeof useGameStore>
  private quizData: QuizData

  constructor(playerManager, quizData, gameStore)  // シグネチャ現状維持

  // 公開 API（名前・シグネチャ・挙動とも現状維持 — テスト無修正パスの根拠）
  resetGame(): void          // answerFlow.stop + externalPause.resetRewindThreshold + thresholdEngine.resetAll + gameStore.resetGame + timeManager.resetTimeValues
  handleReplay(): void       // 現行ロジック。externalPause.resetPauseState + resetGame + playerControl.seekTo(0) + READY 遷移
  handleAnswerSubmit(answer: string): void   // → answerFlow.handleAnswerSubmit
  handleButtonPress(): void  // 実体をここに残す（gameStore/playerControl/answerFlow.startAnswerCountdown を使用）
  isExternalPaused(): boolean               // → externalPause
  pauseExternal(reason): void               // → externalPause
  resumeExternal(): void                    // → externalPause
  setupVisibilityHandlers(): void           // → externalPause 内部化。※下記「公開API検証」参照
  setupPlayerStateHandlers(): void          // 同上
  checkStall(w, v): void                    // → externalPause
  initializeExternalPauseHandling(): void   // → externalPause.initialize（lastWallMs/lastVideoTime 初期化含む）
  updateVideoTime(current: number): void    // 下記
  submitAnswer(i: number, c: boolean): void // → answerFlow.jumpToRevealIfConfigured
  destroy(): void                           // answerFlow.stop + externalPause.destroy
}
```

`updateVideoTime(current)` のファサード実装（現行 L501-554 の構造を維持）:

```ts
if (this.externalPause.isExternalPaused()) return
if (this.gameStore.currentState === GameState.FINISHED) return
const prev = this.timeManager.getPreviousVideoTime()
this.timeManager.updateCurrentVideoTime(current)
this.externalPause.updateRewindThreshold(current)
if (this.timeManager.isSeekDetected(current)) {
  if (ANSWERING || disableSeekbar) {  // 現行 L527-538 と同一。seekTo(prev) は playerControl 経由
    ...
  } else {
    this.thresholdEngine.consumeQuestionsBySeek(prev, current)
    this.timeManager.updatePreviousVideoTime(current)
  }
  return
}
this.thresholdEngine.processTimeWindow(prev, current)
this.timeManager.updatePreviousVideoTime(current)
```

### 公開API検証（検証済み: 2026-07-02）

grep 検証の結果、gameManager.test.ts は `gm.setupVisibilityHandlers()` / `gm.initializeExternalPauseHandling()` を直接呼んでいる（L519, 531, 545, 568, 583, 635, 1276, 1319 ほか）。また `as any` による private アクセスは 0 件。したがって:

- `setupVisibilityHandlers` / `setupPlayerStateHandlers` は ExternalPauseController で public とし、**ファサードにも同名の委譲メソッドを残す**（確定。再検討不要）
- private メンバーの移動はテストに影響しない（確定）

## 7. 移行手順（各ステップでテスト緑を維持）

1. **Step 0**: `npm run test` / `type-check` / `lint` パス確認。`rg -n 'setupVisibilityHandlers|setupPlayerStateHandlers|submitAnswer|initializeExternalPauseHandling' src/ docs/` で公開 API の呼び出し元を確認・記録。
2. **Step 1**: `internalPlayerControl.ts` 新設。gameManager 内の 9 箇所の手動対を `playerControl` 経由に置換（この時点では他は分割しない）。テスト実行。コミット可能ポイント（ただし R-6 は 1 コミットでよい。中間コミットは任意）。
3. **Step 2**: `thresholdEngine.ts` 新設。consumed + 走査系メソッドをコピー移動し、gameManager から委譲。`markRevealConsumed` / `resetUnansweredConsumed` / `resetAll` を実装。テスト実行。
4. **Step 3**: `answerFlowController.ts` 新設。カウントダウン + 解答フローを移動。`submitAnswer` → `jumpToRevealIfConfigured` リネーム（ファサードに旧名委譲を残す）。テスト実行。
5. **Step 4**: `externalPauseController.ts` 新設。pause/resume/stall/visibility/rewind を移動。テスト実行。
6. **Step 5**: gameManager の残骸整理（未使用 import 削除、コメント整理）。行数確認（`wc -l src/services/*.ts`）。`npm run test && npm run type-check && npm run lint`。
7. **Step 6**: 手動動作確認（02-refactoring-plan 末尾のチェックリスト: 通しプレイ / タブ切替復帰（ANSWERING 中・再生中）/ 再生開始 5 秒以内のタブ切替（rewind 補正）/ もう一度プレイ 2 周目 / disableSeekbar=false シークスキップ）。

## 8. テスト影響

- **gameManager.test.ts（1360 行）: 無修正で全件パスが完了条件**。private メンバーへの `(manager as any)` アクセスがある場合は Step 0 の grep で発見し、**その private が移動対象なら実装前にユーザーへ報告**（テスト修正の要否は仕様判断）。`rg -n 'as any|\[\x27consumed\x27\]|internalAction' src/services/__tests__/gameManager.test.ts`
- 新モジュール単体テストは R-6 では**追加しない**（既存統合テストが挙動を保証。単体テスト追補は任意の後続タスク）。
- timeManager / gameStore / answerValidator テストへの影響なし（触らない）。

## 9. 受け入れ基準まとめ

- [ ] `npm run test` 全件パス、gameManager.test.ts 無修正
- [ ] `npm run type-check` / `npm run lint` パス
- [ ] gameManager.ts ≤ 300 行、各新モジュール ≤ 350 行
- [ ] `internalAction = true/false` の手動対が src/ から消滅（`rg -n 'internalAction = ' src/services/` が internalPlayerControl.ts 内のみ）
- [ ] consumed への直接アクセスが thresholdEngine 外に存在しない
- [ ] 手動動作確認チェックリスト全項目パス
- [ ] コミット: `Task R-6: GameManager の責務分割（3コントローラ + internalPlayerControl 抽出）`
