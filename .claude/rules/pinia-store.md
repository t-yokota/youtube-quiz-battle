---
paths:
  - "src/stores/**/*.ts"
---

# Pinia Store Conventions

## ファイル

- ファイル名は **camelCase**（例: `gameStore.ts`）
- `gameStore.ts` がゲーム状態の **single source of truth**

## 実装

- **`defineStore` の Composition (setup) スタイル** で書く
  ```ts
  export const useGameStore = defineStore('game', () => {
    const state = ref(...)
    function action() { ... }
    return { state, action }
  })
  ```
- 状態の変更は **store 内の action / setter 関数**経由で行う。ストア外から `store.state.foo = ...` のように直接書き換えない
- **共通型**は `src/types/` から import。store 内に重複定義しない
- **`any` 禁止**。`ref<T>()` / `computed<T>()` で型を明示

## 定数・列挙

- マジックナンバー / 文字列リテラルは `src/constants/` に定義した定数を使う
- 状態列挙（例: `GAME_PHASE`, `BUTTON_STATE`）は `src/types/` の union type or const を経由

## テスト

- ストアに対するテストは `src/stores/__tests__/gameStore.test.ts` の既存パターンに合わせる
- `setActivePinia(createPinia())` を `beforeEach` で呼ぶ
