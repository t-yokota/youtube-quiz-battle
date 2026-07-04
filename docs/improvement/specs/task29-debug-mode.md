# Task 29 実行spec: デバッグモード（クイズ設定の実行時上書き）

> 作成: 2026-07-05（Fable 5 による設計・ユーザー裁定済み）。
> 裁定: **上書き対象は A = クイズ設定 4 項目のみ**（answerTimeLimit / maxAttempts / jumpToRevealPeriod / hideVideoPlayerDuringAnswer）。演出タイミング（B）・状態ジャンプ（C）は対象外。**上書き値はセッション限り（非永続）**。
> 完了条件: `npm run test` / `type-check` / `lint` / `build` パス + 手動確認。

## 概要

クイズデータに `settings.debug: true` があるときだけ、設定画面に「デバッグ」セクションを表示し、クイズ設定 4 項目を実行時に上書きできるようにする。上書きの解決は gameStore の `effectiveSettings` に一元化する（disableSeekbar のユーザー上書きで実証済みパターンの一般化）。

## 29-1. データ・型

- `src/types/quizData.ts` の `QuizSettings` に `debug: boolean` を追加
- `src/services/quizDataLoader.ts`:
  - `RawQuizData.settings` に `debug?: boolean` を追加
  - validate: `debug` が存在する場合 boolean であることを検証（`QUIZ_DATA_INVALID: Invalid debug`）
  - convert: `debug: rawData.settings.debug ?? false`
- `public/data/sample/data.json` に `"debug": true` を追加（動作確認用。公開時に外すかは別途判断）
- `convertToQuizData` の戻り値 settings オブジェクトに `debug` 行を追加すること（quizDataLoader.ts L196-203）
- テスト影響: 既存テストの `makeQuizData()` 系ヘルパーは `QuizSettings` の必須プロパティ追加により型エラーになる → 各ヘルパーに `debug: false` を追加（対象は gameManager.test.ts / gameStore.test.ts / quizDataLoader.test.ts の 3 ファイルで全数。値の変更はしない）

## 29-2. debugStore（新規 `src/stores/debugStore.ts`）

```ts
// セッション限り（LocalStorage 永続化しない）
state:
  answerTimeLimitOverride: Ref<number | null>      // null = 上書きなし
  maxAttemptsOverride: Ref<number | null>
  jumpToRevealPeriodOverride: Ref<boolean | null>
  hideVideoPlayerDuringAnswerOverride: Ref<boolean | null>
actions:
  setAnswerTimeLimitOverride(v: number | null)
  setMaxAttemptsOverride(v: number | null)
  setJumpToRevealPeriodOverride(v: boolean | null)
  setHideVideoPlayerDuringAnswerOverride(v: boolean | null)
  resetOverrides()   // 全て null に
```

- pinia-store.md 規約準拠（setup スタイル、action 経由の変更）
- 値の範囲ガード（setter 内）: answerTimeLimit は 1〜300、maxAttempts は 1〜9 に clamp。小数は `Math.round`、`Number.isFinite` でない値（NaN 等）は null 扱い。boolean 系 setter は型どおり（boolean | null のみ受ける）で追加ガード不要
- gameStore から `useDebugStore()` を呼ぶストア間依存は、gameStore→settingsStore（guideText で実績、後に撤去）と同型で pinia の setup ストアでは問題ない。computed 内で呼ぶこと（初期化順序に依存しない）

## 29-3. effectiveSettings（gameStore）

- `gameStore` に computed `effectiveSettings` を追加:
  ```ts
  const effectiveSettings = computed<QuizSettings | null>(() => {
    if (!quizData.value) return null
    const s = quizData.value.settings
    if (!s.debug) return s  // debug でないデータでは上書きを一切適用しない
    const d = useDebugStore()
    return {
      ...s,
      answerTimeLimit: d.answerTimeLimitOverride ?? s.answerTimeLimit,
      maxAttempts: d.maxAttemptsOverride ?? s.maxAttempts,
      jumpToRevealPeriod: d.jumpToRevealPeriodOverride ?? s.jumpToRevealPeriod,
      hideVideoPlayerDuringAnswer:
        d.hideVideoPlayerDuringAnswerOverride ?? s.hideVideoPlayerDuringAnswer,
    }
  })
  ```
- **読み取り箇所の付け替え**（`settings.X` 直読み → `effectiveSettings`。2026-07-05 時点の全数）:
  | 箇所 | 対象 |
  |---|---|
  | gameStore.ts L264-265（initializeForQuestion） | maxAttempts / answerTimeLimit |
  | gameStore.ts L290（resetAnswerTime） | answerTimeLimit |
  | gameStore.ts L325-326（setQuizData 初期値） | そのまま（データ読込直後の初期表示用。以後は各問題の onStart → initializeForQuestion が毎回 effectiveSettings から再設定するため、上書きは「次の問題から」自然に反映される） |
  | answerFlowController.ts L137, L158 | jumpToRevealPeriod → `this.gameStore.effectiveSettings?.jumpToRevealPeriod ?? false`（quizData 直読みを置換） |
  | App.vue L176（shouldHidePlayer） | hideVideoPlayerDuringAnswer → `gameStore.effectiveSettings?.hideVideoPlayerDuringAnswer` |
  | AnswerContent.vue L24（タイマー分母） | answerTimeLimit |
  | AnswerContent.vue L74（残り回数の分母表示） | maxAttempts |
- disableSeekbar は既存の settingsStore 上書き（ユーザー設定）を維持し、effectiveSettings には**含めない**（二重上書きの混乱を避ける。デバッグでの切替は既存のシーク設定トグルで代用できる）

## 29-4. SettingsModal のデバッグセクション

- 表示条件: `gameStore.quizData?.settings.debug === true`。位置は**「ボタンチェック演出」セクションの直下・「データ収集について」の直上**（現在の並びは 効果音設定 → シーク操作 → ボタンチェック演出 → データ収集）
- 見出し: 「デバッグ」+ 説明文「クイズ設定を一時的に上書きします（リロードで解除）」
- 各項目の UI: **「上書きする」チェックボックス + 入力コントロール**の行構成
  - チェック OFF = override null（コントロールは disabled、プレースホルダにデータ値を表示）
  - チェック ON = コントロールの値を setter へ（number input: answerTimeLimit 1-300 / maxAttempts 1-9、トグル: jumpToRevealPeriod / hideVideoPlayerDuringAnswer）
- 「すべてリセット」ボタン（resetOverrides）
- 反映タイミングの注記を表示: 「解答時間・解答回数は次の問題から反映」
- スタイルは既存セクション（seek-control 系クラス）を踏襲し、新規クラスは `debug-` プレフィックス（debug-row / debug-input 等）。デバッグ見出しは注意色（gold）で他と区別。バインディングは既存に合わせ `:checked/:value` + `@change/@input`（v-model 不使用）
- hideVideoPlayerDuringAnswer の即時反映は App.vue の computed が毎評価されるため（技術根拠）。answerTimeLimit/maxAttempts が次の問題からなのは initializeForQuestion で問題開始時に読むため

## 29-5. テスト

- debugStore.test.ts（新規）: 既定 null / setter / clamp（0→1、310→300 等）/ resetOverrides / **LocalStorage に書き込まれないこと**
- gameStore.test.ts に追補: effectiveSettings が debug=false では上書きを無視 / debug=true で上書きが優先 / initializeForQuestion で override が反映（次の問題から）
- answerFlow 経由: jumpToRevealPeriod override=true で REVEALING 直行（既存テストのパターン流用、gameManager.test.ts に 1 件）
- 既存テストは 29-1 の `debug: false` 追加以外は無修正

## 手動確認

- [ ] sample（debug: true）で設定画面にデバッグセクションが出る / debug の無いデータでは出ない
- [ ] answerTimeLimit を 3 に上書き → 次の問題からタイマーが 3 秒になる
- [ ] maxAttempts を 1 に上書き → 次の問題から 1 回で確定
- [ ] jumpToRevealPeriod ON → 正解時に即 REVEALING へジャンプ
- [ ] hideVideoPlayerDuringAnswer ON → ANSWERING 中に動画が消える（即時反映）
- [ ] リロードで全上書きが解除される

## やらないこと

- 演出タイミング（timing.ts 定数）の上書き（B: 不採用）/ 状態ジャンプ（C: 不採用）
- LocalStorage 永続化 / disableSeekbar の debug 上書き（既存のユーザー設定で代用）
