---
paths:
  - "src/components/**/*.vue"
---

# Vue Component Conventions

## ファイル

- ファイル名は **PascalCase**（例: `QuizCard.vue`, `ResultTable.vue`）
- 配置先サブディレクトリ:
  - `src/components/common/` — 共通部品（ボタン・ベースダイアログ等）
  - `src/components/dialogs/` — モーダルダイアログ
  - `src/components/game/` — ゲーム画面
  - `src/components/result/` — 結果画面

## 実装

- **Composition API + `<script setup>`** のみ。Options API は使わない
- **TypeScript**。`any` 禁止。`defineProps<{...}>()` / `defineEmits<{...}>()` で型を明示
- **状態変更**は Pinia ストア (`src/stores/gameStore.ts`) 経由。コンポーネント local state で済ませない
- **共通型**は `src/types/` から import（`@/types/...` パス）
- **マジックナンバー禁止** → `src/constants/` に定義した定数を import

## スタイル

- **Tailwind CSS v4** のクラスを使用。v3 専用ユーティリティは使わない
- **スマホ縦画面（360–430px 幅）ファースト**。横スクロールが出ないこと
- タッチターゲットは ≥ 44×44px
- `:focus-visible` のアウトラインを `outline-none` で潰さない
