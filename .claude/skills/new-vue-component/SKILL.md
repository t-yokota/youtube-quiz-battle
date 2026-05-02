---
name: new-vue-component
description: Scaffold a new Vue 3 SFC under src/components/ following project conventions (Composition API + script setup, Tailwind v4, types from src/types/)
disable-model-invocation: true
---

# new-vue-component

新しい Vue 3 SFC をプロジェクト規約に沿って作成する。

## 規約（CLAUDE.md より）

- **API**: Composition API + `<script setup>`
- **言語**: TypeScript（`any` は使わない）
- **ファイル名**: PascalCase（例: `QuizCard.vue`）
- **配置先**: 用途に応じたサブディレクトリ
  - `src/components/common/` — ボタン・ダイアログベース等の共通部品
  - `src/components/dialogs/` — モーダルダイアログ
  - `src/components/game/` — ゲーム画面のコンポーネント
  - `src/components/result/` — 結果画面のコンポーネント
- **型**: 共通型は `src/types/` から import
- **状態**: 変更は Pinia ストア (`src/stores/gameStore.ts`) 経由
- **定数**: マジックナンバー禁止 → `src/constants/` に定義
- **スタイル**: Tailwind CSS v4。スマホ縦画面ファースト

## 手順

1. ユーザーに確認:
   - コンポーネント名（PascalCase）
   - 配置先サブディレクトリ
   - props（型と必須/任意）
   - emits（イベント名と payload 型）
2. `assets/Component.template.vue` をひな形として読み込む
3. プレースホルダを置換してファイル生成
4. 新しい型が必要なら、追加先（`src/types/` のどのファイル）をユーザーに確認
5. 既存の似たコンポーネント（同じサブディレクトリ内）のスタイル/構造を参考にして整合させる

## ひな形

`assets/Component.template.vue` 参照。
