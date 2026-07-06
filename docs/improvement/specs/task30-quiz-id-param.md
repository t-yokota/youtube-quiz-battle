# Task 30 実行spec: quizId パラメータ対応（コンテンツ指定）

> 作成: 2026-07-05（Fable 5 による設計・ユーザー裁定: 概念は quizId で統一）。
> 完了条件: `npm run test` / `type-check` / `lint` / `build` パス + 手動確認。

## 概要

`?quiz=<quizId>` でクイズコンテンツを指定できるようにする。quizId は独自 ID（slug）であり videoId とは別概念（同一動画に複数クイズセットを許す）。データ配置は `public/data/<quizId>/data.json`。未指定時は `sample`。

## 30-1. URL パラメータと ID 検証（quizDataLoader）

- `extractVideoIdFromUrl()` を **`extractQuizIdFromUrl()` に改名**し、`?quiz=` のみを読む
  （旧 `?v` / `?video` は廃止 — 外部共有された実績がないため互換不要）。未指定は `'sample'` を返す
- quizId のバリデーション: `/^[a-z0-9-]{1,64}$/`。不一致は `QUIZ_DATA_NOT_FOUND` を throw
  （任意文字列で fetch URL を組み立てない）
- `loadQuizData(quizId: string)`: 引数名・コメントを quizId に改め、`sample` 特別扱いの分岐を削除
  （`data/${quizId}/data.json` の一本化。sample も通常の quizId）
- `validateQuizData` の **videoId 一致チェック（`QUIZ_DATA_INVALID: Video ID mismatch`）を削除**
  （quizId は videoId ではなくなるため。videoId の存在チェックは維持）

## 30-2. App.vue

- 初期化で `extractQuizIdFromUrl()` の結果を `quizId` ref に保持し `loadQuizData(quizId)` を呼ぶ
- `QUIZ_DATA_NOT_FOUND` 時の文言が「指定されたクイズが見つかりません」系になっているか
  errorHandler を確認し、必要なら文言調整（再読み込み誘導ではなく ID 見直しを促す）

## 30-3. Analytics への quiz_id 追加

- 4 つのイベント interface すべてに `quizId: string` を追加（必須）→ GA パラメータ `quiz_id`
- App のイベント送信箇所で quizId ref を同梱
- spec task25 の 25-6 登録ガイドに追記: `quiz_id` は**カスタムディメンション登録対象**
  （カーディナリティ = クイズ数なので低い）

## 30-4. テスト

- quizDataLoader: `extractQuizIdFromUrl`（?quiz= / 未指定 sample / 不正 slug → NOT_FOUND）、
  URL 組み立て（data/<quizId>/data.json）、videoId 一致チェック削除に伴う既存テストの更新
- analyticsService: quiz_id が snake_case 変換に含まれること（既存テストのパラメータ期待値に追記）

## 手動確認

- [ ] `?quiz=sample` と未指定で同じデータが読める
- [ ] 存在しない ID（`?quiz=zzz`）でエラーダイアログ（見つかりません系文言）
- [ ] 不正文字列（`?quiz=../etc`）でも fetch されずエラー
- [ ] DebugView のイベントに quiz_id が入る（Firebase 設定後）

## やらないこと

- **data.json への quizId の埋め込み**（2026-07-07 ユーザー裁定: 入れない。quizId の真実の源は
  URL パラメータ = ディレクトリ名のみ。将来コンテンツ一覧の manifest を作る際に再検討）
- コンテンツ一覧・選択ページ（別タスク）
- データ配信のリモート化（現状は public/data のまま。ローダーの解決点は一本化済みなので将来差し替え可能）
