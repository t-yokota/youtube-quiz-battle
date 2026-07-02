# Phase 3 実行spec: 機能完成タスク（19 / 20 / 21 系）

> 作成: 2026-07-02（Fable 5 による事前設計）。04-task-replan.md の Phase 3 タスクを、実装者が設計判断なしで実行できる粒度に落とした spec。
> 各タスクの共通完了条件: `npm run test` / `npm run type-check` / `npm run lint` パス + 1 タスク 1 コミット（`Task XX:` 形式）。
> **前提: R-6 完了後に着手**（音声トリガ・エラー分岐は answerFlowController / externalPauseController に接続するため）。R-6 未完了で着手する場合はトリガ接続先を現行 gameManager の対応メソッドに読み替える。

## 裁定サマリ（Fable による事前決定）

弱いオーケストレータが迷いやすい点を先に裁定した。**下記以外の設計判断が必要になったらユーザーへエスカレーションする**こと。

| # | 論点 | 裁定 |
|---|---|---|
| A1 | audioManager のインスタンス管理 | モジュールシングルトンにせず `createAudioManager()` ファクトリ。App.vue が生成し GameManager コンストラクタ経由で answerFlowController / facade に渡す（テスト時にモック注入可能にするため。他 service と同形） |
| A2 | 音量レベル→ゲイン変換 | `level / 4`（level: 0-4、0=ミュート）。SettingsModal の既存レンジ（0-4）を正とする（04-task-replan の「5段階」は 0-4 の 5 値の意） |
| A3 | 音声読み込み失敗の扱い | **ブロッキングエラーにしない**。logger.warn + `isSoundSupported()=false` 相当として以後 no-op。design.md の `AUDIO_LOAD_FAILED`（再読み込み誘導）はゲーム開始前のスプライト読込には適用しない。→ **design.md からの逸脱なので Task 19 着手前にユーザーへ 1 行確認**（唯一の要確認点） |
| E1 | QUIZ_DATA_INVALID の suffix | エラーコード照合は `message.split(':')[0]` の前方一致。suffix（`: Missing videoId` 等）は ErrorDialog に出さず logger.error のみに出す |
| E2 | 復旧可能エラーの定義 | 自動リトライ対象は quizDataLoader の fetch 失敗（NETWORK 系）のみ。最大 3 回・指数バックオフ（1s/2s/4s）。YouTube onError と QUIZ_DATA_NOT_FOUND / INVALID はリトライせず再読み込み誘導 |
| O1 | 横画面中のゲーム進行 | External Pause を再利用する。`pauseExternal` の reason union に `'orientation'` を追加し、横画面検出で pause / 縦復帰で `externalPausedReason === 'orientation'` のときのみ resume（visibility と同パターン）。design.md「Screen Orientation Control」への追記もこのタスクで行う |
| O2 | モバイル判定 | `window.matchMedia('(pointer: coarse)').matches` を採用（UA 判定はしない）。PC（pointer: fine）は横画面警告対象外 |
| H1 | プレイヤー非表示の方式 | VideoPlayer のラッパー div に `visibility: hidden` を適用（高さは保持、iframe は破棄しない）。`settings.hideVideoPlayerDuringAnswer && currentState === ANSWERING` のときのみ |
| V1 | 正規化パイプラインと NFKC の重複 | NFKC が既に「半角カナ→全角」「全角英数→半角」を行うため、個別実装しない（design.md の手順 4a/5 は NFKC で充足していることをテストで担保） |
| V2 | かな統一の方向 | カタカナへ統一（design.md 既定どおり）。ひらがな→カタカナはコードポイント +0x60 シフト（U+3041-3096 → U+30A1-30F6）+ 「ゝゞ→ヽヾ」 |
| V3 | 小書きかな標準化 | **実施しない**（「っ」と「つ」の同一視は誤陽性リスクが高い。design.md 手順 4 の「小書きかなの標準化」は長音・NFKC 由来の互換文字処理で実用上足りる）。→ design.md から該当行を削除する（このタスクのコミットに含める）。**逸脱なので Task 21 着手前にユーザーへ 1 行確認**（要確認 2 点目） |
| V4 | validate の既定値 | `normalize: boolean = true` に反転。完全一致が必要なテスト・呼び出しは明示的に `false` を渡す |

---

## Task 19-0: 効果音素材の準備

人手作業が主のタスク。**素材選定はユーザーと協働**（勝手にダウンロードしない）。

1. ユーザーに素材候補（フリー素材サイト or 自作）の提示を依頼
2. 入手後、スプライト化: button 0–0.5s / correct 0.5–1.5s / incorrect 1.5–2.3s（design.md L1177-1184 の `DEFAULT_AUDIO_SPRITE` が正）
3. 配置: `public/assets/sounds/quiz-sounds.mp3`
4. ライセンス表記が必要なら `docs/` に記録し PrivacyInfo/README への記載要否をユーザーに確認

## Task 19: 音声管理システム

### 新規ファイル
- `src/services/audioManager.ts`（~200 行目安）
- `src/stores/settingsStore.ts`（新規 Pinia ストア、setup 形式。`.claude/rules/pinia-store.md` 準拠）
- `src/constants/audio.ts`: `SOUND_TYPE` enum（design.md L1171-1175）、`DEFAULT_AUDIO_SPRITE`、`LOCALSTORAGE_KEY_SETTINGS = 'yqb-settings'`

### audioManager 公開IF（design.md L1121-1134 を実装。ただし戻り値は下記）

```ts
export interface AudioManagerOptions { sprite?: typeof DEFAULT_AUDIO_SPRITE }
export class AudioManager {
  /** スプライトの読み込み。失敗時は throw せず内部で unsupported 化（裁定 A3） */
  async init(): Promise<void>
  playSound(type: SOUND_TYPE): void   // fire-and-forget（design は Promise だが待つ用途がないため void。呼び出し側は await しない）
  stopSound(type?: SOUND_TYPE): void
  setVolume(volume: number): void     // 0-1
  getVolume(): number
  setSoundEnabled(enabled: boolean): void
  setMute(muted: boolean): void
  isSoundSupported(): boolean
}
export function createAudioManager(options?: AudioManagerOptions): AudioManager
```

実装方式: Web Audio API（`AudioContext` + `decodeAudioData` + `AudioBufferSourceNode` + `GainNode`）。`AudioContext` 未定義環境では HTML Audio（`new Audio()` + currentTime シーク + setTimeout 停止）にフォールバック。新規再生時は再生中の効果音を `stopSound()` してから再生（design.md L1165）。

### settingsStore

```ts
state: soundEnabled (boolean, 既定 true), volumeLevel (number 0-4, 既定 3)
actions: setSoundEnabled, setVolumeLevel（それぞれ LocalStorage へ即時保存）
初期化: LOCALSTORAGE_KEY_SETTINGS から復元（JSON parse 失敗時は既定値 + logger.warn）
```

App.vue の `volumeLevel` ローカル ref（L49）と `handleUpdateVolume`（L136-138）を settingsStore 参照に置換。SettingsModal は props/emits 維持でよい（親が store と接続）。store 変更を `watch` して `audioManager.setVolume(level/4)` / `setSoundEnabled` を反映。

### 再生トリガ（design.md L1150-1161）

| トリガ | 接続先（R-6 後の構成） |
|---|---|
| ボタン押下音 | `GameManager.handleButtonPress` 冒頭（isButtonEnabled ガード通過後） |
| 正解音（ボタンチェック） | handleButtonPress の READY 分岐で STANDBY へ戻すタイミング（L232 相当） |
| 正解音 / 不正解音 | answerFlowController の判定後（`handleAnswerSubmit` / `handleAnswerTimeout` で result.isCorrect により分岐） |

GameManager（facade）コンストラクタに `audioManager` を追加（第4引数、省略可にすると既存テスト無修正で通る: `audioManager?: AudioManager`。undefined なら再生スキップ）。

### 受け入れ基準
- [ ] 音 ON/OFF・音量変更が SettingsModal から即時反映され、リロード後も保持される
- [ ] 素材未配置でもゲームが正常動作（unsupported 化して無音）
- [ ] 既存テスト無修正パス（audioManager 省略可のため）

## Task 19-2: 音声システムのテスト

`src/services/__tests__/audioManager.test.ts` + `src/stores/__tests__/settingsStore.test.ts`。AudioContext / HTMLAudio / localStorage をモック。検証: 再生・停止・重複再生時の停止→再生・音量変換（level/4）・ON/OFF・フォールバック分岐・読込失敗時の no-op 化・LocalStorage 復元と壊れた JSON の回復。注: 実スプライト位置（0.5s 境界等）の検証はモックでは無意味なので行わない（19-0 完了後の手動確認事項）。

## Task 20: エラーハンドリングシステム

### 新規ファイル
- `src/services/errorHandler.ts`
- `src/constants/errorMessages.ts`: design.md L1849-1858 の `ERROR_MESSAGES` をそのまま移植

### 公開IF

```ts
export type ErrorCode = keyof typeof ERROR_MESSAGES
/** 分類規則（順に評価）:
 *  1. error が Error かつ message の ':' 前部分が ERROR_MESSAGES のキーに一致 → そのコード
 *  2. error が TypeError（fetch のネットワーク断は TypeError を投げる）→ 'NETWORK_ERROR'
 *  3. それ以外 → 'GENERIC_ERROR' */
export function classifyError(error: unknown): ErrorCode
export function getErrorMessage(error: unknown): string   // classifyError → ERROR_MESSAGES
export function isRecoverable(code: ErrorCode): boolean   // NETWORK_ERROR / QUIZ_DATA_LOAD_FAILED のみ true（裁定 E2）
export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T>  // 1s/2s/4s バックオフ。リトライは isRecoverable な throw のみ
```

### 接続変更
- App.vue `initError`（L42, L61-64）: `initError.value = getErrorMessage(error)` に変更（コード生表示の解消 = D-6）。suffix 付き詳細は logger.error のみ
- quizDataLoader の fetch 呼び出しを `withRetry` で包む。**リトライ判定は `isRecoverable(classifyError(e))`** とする（fetch 例外 = TypeError → NETWORK_ERROR → リトライ対象、`QUIZ_DATA_LOAD_FAILED`（HTTP 非 404 エラー）もリトライ対象、`QUIZ_DATA_NOT_FOUND` / `QUIZ_DATA_INVALID` は即時伝播）。quizDataLoader の外側 catch（現 L63-65 の rethrow）は変更不要 — 分類は errorHandler 側で行う
- YouTube onError（`handlePlayerError` L90-92）: `getErrorMessage` を通す（YOUTUBE_LOAD_FAILED へ分類）
- 音声読込失敗はここに接続しない（裁定 A3。ブロッキングにしない）

### 受け入れ基準
- [ ] 存在しない quizId でメッセージが日本語文言になる（コードが画面に出ない）
- [ ] ネットワーク断→復帰で自動リトライが機能（テストはタイマーモックで検証）

## Task 20-2: エラーシナリオのテスト

`src/services/__tests__/errorHandler.test.ts`。classify（suffix 付き含む）/ 未知コード→GENERIC / withRetry の回数・バックオフ・非復旧 throw の即時伝播。quizDataLoader.test.ts にリトライ統合ケースを追補。

## Task 20-3: 画面向き検出と OrientationDialog 接続

- 新規 composable `src/composables/useOrientationGuard.ts`:
  ```ts
  export function useOrientationGuard(onLandscape: () => void, onPortrait: () => void): { isLandscape: Readonly<Ref<boolean>>, stop(): void }
  ```
  `matchMedia('(orientation: landscape)')` の change 監視。`(pointer: coarse)` でない場合は何もしない（裁定 O2）。App.vue の setup で呼び出し、`onUnmounted` で `stop()`（既存の gameLoop.stop() と並べる）。
- App.vue: `isOrientationOpen`（L46）を composable の `isLandscape` に接続。onLandscape → `gameManager.pauseExternal('orientation')`、onPortrait → reason が orientation のときのみ `resumeExternal()`（裁定 O1。resume 条件の判定は GameManager 側に `resumeExternalIfReason(reason)` を追加するのが最小変更）
- 型変更: `pauseExternal` の reason union に `'orientation'` 追加（externalPauseController + 型定義）
- design.md「Screen Orientation Control」（L1542-1546）に External Pause 連動の 3 行を追記
- テスト: gameManager.test.ts に orientation reason の pause/resume ケースを**追加**（既存ケースは無修正）

## Task 20-4: hideVideoPlayerDuringAnswer

- App.vue の VideoPlayer ラッパーに `:class="{ 'player-hidden': shouldHidePlayer }"` を付与。`shouldHidePlayer = computed(() => quizData?.settings.hideVideoPlayerDuringAnswer && gameStore.currentState === GameState.ANSWERING)`
- CSS: `.player-hidden { visibility: hidden; }`（高さ保持・iframe 非破棄。裁定 H1）
- WAITING / REVEALING への遷移で自動復帰（computed なので追加処理不要）
- テスト: コンポーネントテスト基盤がないため、computed 相当のロジックを gameStore 系テストで担保できる形（純関数化 or ストア getter 化）にする。getter `shouldHideVideoPlayer(settings)` を gameStore に置くのは責務過剰なので、**App.vue 内 computed + 手動確認でよい**（Task 26 の E2E で自動化）

## Task 21: 解答検証システムの拡張

`src/services/answerValidator.ts` を拡張（現 38 行 → ~120 行目安）:

```ts
export function validate(userInput: string, correctAnswers: string[], normalize: boolean = true): boolean  // 既定 ON（裁定 V4）
export function normalizeAnswer(input: string): string  // 下記パイプライン
export function containsJapanese(s: string): boolean    // design.md L1229-1235 の RE_JP をそのまま使用
```

パイプライン（design.md L1211-1223 準拠、裁定 V1/V2/V3 反映）:
1. `normalize('NFKC')`（半角カナ→全角・全角英数→半角もここで解決）
2. `toLowerCase()`（casefold 相当。トルコ語 İ 等の厳密 casefold は不要）
3. `trim()`（内部空白保持）
4. `containsJapanese` が true のときのみ: ひらがな→カタカナ（U+3041-3096 → +0x60、ゝゞ→ヽヾ）、長音異体統一（`[ー―－ｰ]` → 「ー」。※ｰ は NFKC でー化済みだが防御的に含める）
5. 数字幅は NFKC で統一済み（追加処理なし）

呼び出し側: `gameStore.ts` L206 `validate(answer, question.answers)` は既定 ON になるため変更不要。既存テストの扱い（機械的規則）:
- answerValidator.test.ts: **「正規化なしの完全一致」を仕様として検証しているケース**（例: 表記が違えば不正解になることを確認するもの）のみ `normalize: false` を明示。正規化 ON でも結果が変わらないケース（完全一致で正解）は無修正で据え置く。迷ったら「このテストは何の仕様を固定しているか」で判断し、正規化 ON で結果が反転するテストだけ触る
- gameStore.test.ts: 落ちた場合は仕様変更として期待値を更新してよい
design.md 手順 4「小書きかなの標準化」の行を削除（裁定 V3、ユーザー確認後）。

## Task 21-2: 表記揺れマトリクステスト

answerValidator.test.ts に追加。最低限のマトリクス: ひらがな⇔カタカナ / 半角カナ / 全角英数 / 大文字小文字 / 前後空白 / 長音異体（ー―－ｰ）/ 日本語なし入力でかな変換が走らないこと / 「っ」≠「つ」（V3 の裁定を固定するテスト）/ 全角数字。

---

## Task 19-3: 設定画面から disableSeekbar を切り替え（2026-07-03 追加・ユーザー要望）

- SettingsModal にシーク許可トグルを追加。settingsStore に `disableSeekbarOverride: boolean | null`（null=クイズデータの設定に従う）を追加し LocalStorage 永続化
- 実効値の解決: `override ?? quizData.settings.disableSeekbar`。参照箇所は GameManager.updateVideoTime のシーク分岐 1 箇所（実装時に rg で確認）
- design.md の QuizSettings 説明に優先順位（ユーザー設定 > データ設定）を追記
- タイミング: Task 19（settingsStore 新設）完了後の任意時点

## 実行順とコミット

19-0 →（ユーザー確認 A3）→ 19 → 19-2 →（任意時点で 19-3）→ 20 → 20-2 → 20-3 → 20-4 →（ユーザー確認 V3）→ 21 → 21-2。
各タスク完了時に docs/tasks.md のチェックボックス更新を同一コミットに含める。
