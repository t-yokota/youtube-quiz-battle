# YouTube Quiz Battle — Claude Code Guide

## プロジェクト概要

YouTubeクイズ動画を視聴しながらリアルタイムで早押し解答するWebアプリ。
1人プレイ、スマートフォン縦画面メイン（PCはデバッグ用途）。

## 技術スタック

- **Vue 3** (Composition API) + **TypeScript** + **Vite 7**
- **Pinia** (状態管理)
- **Tailwind CSS v4** (スタイリング)
- **YouTube IFrame API** (動画再生)
- **Vitest 4** + jsdom（テスト）

## 開発コマンド

| 用途 | コマンド |
|---|---|
| 開発サーバ起動 | `npm run dev` |
| 型チェック | `npm run type-check` |
| Lint + 自動修正 | `npm run lint` |
| フォーマット | `npm run format` |
| テスト（1回実行） | `npm run test` |
| テスト（watch） | `npm run test:watch` |
| 本番ビルド | `npm run build` |
| ビルドプレビュー | `npm run preview` |

## ディレクトリ構成

```
src/
├── components/     # Vue SFC（common/dialogs/game/result サブディレクトリ）
├── services/       # ビジネスロジック
│                   #   answerValidator / gameManager / quizDataLoader
│                   #   timeManager / youtubePlayer
├── stores/         # Pinia ストア（gameStore.ts が状態の単一の真実の源）
├── types/          # 共通型定義（any 禁止のための集約点）
├── constants/      # 定数（マジックナンバー禁止）
├── utils/          # 純粋関数ユーティリティ
├── assets/         # 画像・CSS
├── App.vue         # ルートコンポーネント
└── main.ts         # エントリポイント
```

テストは各ディレクトリ配下に `__tests__/` で co-locate（詳細は [.claude/rules/vitest-test.md](.claude/rules/vitest-test.md)）。

## 作業ルール

### 大きな変更前は方針を確認する

以下の場合は実装前にチャットで方針を提案し、同意を得てから着手する：

- 設計方針の変更、要件の追加・修正
- ファイル構造の変更（新規作成・削除・移動）
- 複数ファイルにまたがる大規模な変更

**例外（即座に実行してよい）**: タイポ修正、ユーザーが「すぐに修正して」と指示した場合、docs/improvement/ の指示書および docs/tasks.md に記載済みのタスク（合意済みとみなす）

### 自律実行の原則

- docs/tasks.md の順序に従い、ユーザーの都度確認なしに複数タスクを連続実行してよい
- コミット粒度は 1 タスク 1 コミットを維持し、タスク完了ごとに docs/tasks.md のチェックボックスを更新する
- ユーザーへの確認が必要なのは以下のみ:
  - 仕様バグ（実装と設計が矛盾し、どちらが正かをユーザーが決めるべきもの）
  - 要件・仕様の不明点、設計方針の変更
- 確認待ちでブロックされたら、質問を提示した上で依存しない次のタスクへ進む
- 実装上のバグ（テスト失敗・型エラー・明白な誤り）は自律的に修正する。
  進行中のタスクと無関係な修正は別コミットに分ける
- 対象ファイル・完了条件（test / type-check / lint のパス）を spawn プロンプトに含める。diff のレビューとコミットはオーケストレーターが行い、サブエージェントはコミットしない（担当ルーティングの詳細: docs/improvement/00-overview.md「実行体制」）
- オーケストレーターがインラインで実行してよいのは **docs/improvement/specs/ に設計済み spec があるタスクのみ**。spec の無い設計作業（分割設計・仕様裁定・デザイン方針）は着手前にユーザーへ方針を提案する

### コミットメッセージ規約

- **タスクの実行**: `Task XX: <内容>` をサブジェクトに使用する
- **タスク外の変更**: プレフィックスなし、または変更内容を表す語句をサブジェクトに使用する
- **本文**: 変更内容を箇条書きで記述する
- **Claudeが実装した場合**: 本文末尾に `Generated with Claude Code (<モデルID>)` を付ける

詳細フローと完全な例: [.claude/skills/task-commit/SKILL.md](.claude/skills/task-commit/SKILL.md)

## コーディング規約

共通ルール:

- **TypeScript**: `any` 禁止。共通型は `src/types/` に集約
- **命名**: ファイルは PascalCase（コンポーネント）/ camelCase（サービス・ストア・ユーティリティ）
- **マジックナンバー禁止**: `src/constants/` に定義した定数を使う

カテゴリ別の詳細規約は `.claude/rules/` に分離（該当ファイルを編集する時に自動適用）:

| 対象 | ルールファイル |
|---|---|
| Vue SFC | [.claude/rules/vue-component.md](.claude/rules/vue-component.md) |
| Pinia ストア | [.claude/rules/pinia-store.md](.claude/rules/pinia-store.md) |
| Vitest テスト | [.claude/rules/vitest-test.md](.claude/rules/vitest-test.md) |

## ドキュメント参照先

| 目的 | ファイル |
|---|---|
| タスク進捗・次にやること | [docs/tasks.md](docs/tasks.md) |
| 詳細設計（状態遷移・時間管理等） | [docs/design.md](docs/design.md) |
| 要件定義 | [docs/requirements.md](docs/requirements.md) |
| ワイヤーフレーム | [docs/assets/wireframe.html](docs/assets/wireframe.html) |
