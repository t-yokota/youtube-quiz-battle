# YouTube Quiz Battle — Claude Code Guide

## プロジェクト概要

YouTubeクイズ動画を視聴しながらリアルタイムで早押し解答するWebアプリ。
1人プレイ、スマートフォン縦画面メイン（PCはデバッグ用途）。

## 技術スタック

- **Vue 3** (Composition API) + **TypeScript** + **Vite 7**
- **Pinia** (状態管理)
- **Tailwind CSS v4** (スタイリング)
- **YouTube IFrame API** (動画再生)
- テストフレームワーク: 未導入（Task 15-2で Vitest を導入予定）

## 作業ルール

### 大きな変更前は方針を確認する

以下の場合は実装前にチャットで方針を提案し、同意を得てから着手する：

- 設計方針の変更、要件の追加・修正
- ファイル構造の変更（新規作成・削除・移動）
- 複数ファイルにまたがる大規模な変更

例外（即座に実行してよい）: タイポ修正、ユーザーが「すぐに修正して」と指示した場合

### 1タスク1実行の原則

- 1回の会話で1つのタスクのみ完了させる
- タスク完了後は `docs/tasks.md` のチェックボックスを更新してから報告する
- 次のタスクはユーザーの確認を待ってから開始する

### コミットメッセージ規約

- **タスクの実行**: `Task XX: <内容>` をサブジェクトに使用する
- **タスク外の変更**: プレフィックスなし、または変更内容を表す語句をサブジェクトに使用する
- **本文**: 変更内容を箇条書きで記述する
- **Claudeが実装した場合**: 本文末尾に `Generated with Claude Code (<モデルID>)` を付ける

```
Task 16: 解答検証システムの実装（Phase 2 MVP版）

- services/answerValidator.ts作成
  - validate(): 完全一致判定
  - 複数正解パターン対応

Generated with Claude Code (claude-opus-4-6)
```

## コーディング規約

- **コンポーネント**: Vue SFC (Single File Component)、Composition API + `<script setup>`
- **型定義**: `src/types/` に集約。`any` は使わない
- **状態管理**: Pinia ストア (`src/stores/gameStore.ts`) を経由する
- **定数**: `src/constants/` に定義（マジックナンバー禁止）
- **命名**: ファイル名はPascalCase（コンポーネント）、camelCase（サービス・ストア）

## ドキュメント参照先

| 目的 | ファイル |
|---|---|
| タスク進捗・次にやること | [docs/tasks.md](docs/tasks.md) |
| 詳細設計（状態遷移・時間管理等） | [docs/design.md](docs/design.md) |
| 要件定義 | [docs/requirements.md](docs/requirements.md) |
| ワイヤーフレーム | [docs/assets/wireframe.html](docs/assets/wireframe.html) |
