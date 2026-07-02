# 残タスク裁定メモ: R-7 / R-9 / D-12（handoff 処分）

> 作成: 2026-07-02（Fable 5 による事前裁定）。02-refactoring-plan.md の記述で実行可能なタスクについては重複記載せず、裁定・補足のみを記す。

## R-7: コンポーネント整理

02-refactoring-plan.md の R-7a/R-7b 記述だけで実行可能。補足裁定:

- R-7a と R-7b は**別コミット**（`Task R-7a:` / `Task R-7b:`）
- R-7b で GamePanel 系が gameStore を直接読む形にした後、**App.vue → GamePanel の props が全廃になるかは強制しない**。`quizData.settings` 由来の値（store に無いもの）は props 継続でよい
- emits の `updateInput` は廃止し `gameStore.updateAnswerInput` 直接呼びに統一（02 の「単純」案を採用）。`submit` emit は維持（GameManager 経由必須のため）
- コンポーネントテストは無いので、完了条件は test/type-check/lint + 手動での通しプレイ 1 回

## R-9: 解答送信の遷移責務一元化

02-refactoring-plan.md の記述で実行可能。補足裁定:

- R-6 完了後に実施（answerFlowController が遷移決定の一元点になる）
- `submitAnswer` → `jumpToRevealIfConfigured` リネームは **R-6 で実施済みの想定**（同ディレクトリの [r6-gamemanager-split.md](r6-gamemanager-split.md) 参照）。R-9 到達時に未リネームなら R-9 に含める
- store の `handleAnswerSubmit` から `transitionToState` 呼び出しを除去 →「判定 + 記録 + `{isCorrect, isFinal}` 返却」に縮小。遷移は answerFlowController.resumeVideoAfterAnswer 系で一元決定:
  - 正解 or 最終不正解: jumpToRevealPeriod=true かつ currentVideoTime < revealTime → REVEALING / それ以外 → WAITING
  - リトライ可: QUESTIONING
- gameStore.test.ts の遷移 assertion は仕様変更として修正してよい（このタスクは behavior-preserving ではなく「ちらつき解消」の仕様変更）。gameManager.test.ts は結果として同じ最終状態になるはずなので原則無修正

## D-12: docs/design-sync-handoff.md の処分（裁定: 削除可）

検証結果（2026-07-02）:

1. 資料内の完了項目（カテゴリ A/B/C、JSON キー統一、採番統一、レビュー R-1〜R-3）はすべて design.md・実装・git 履歴に反映済み
2. 唯一の未対応だった「R-4: quizDataLoader 専用テストなし」は、**現在 `src/services/__tests__/quizDataLoader.test.ts`（465 行）が存在し解消済み**
3. 採番体系（index=0-indexed 内部用 / questionNumber=1-indexed 表示用）は design.md に反映済みで、handoff 固有の未転記情報はない

**処置**: `rm docs/design-sync-handoff.md`（untracked のため git 操作不要）。docs/tasks.md の D-12 チェックを更新し、コミット（tasks.md 更新のみ）: `Task D-12: design-sync-handoff.md の処分（役目完了により削除）`
