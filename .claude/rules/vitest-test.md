---
paths:
  - "src/**/__tests__/**/*.ts"
---

# Vitest Test Conventions

## 配置

- ソースの隣の `__tests__/` ディレクトリに **co-locate** する
  - `src/services/foo.ts` → `src/services/__tests__/foo.test.ts`
  - `src/utils/bar.ts` → `src/utils/__tests__/bar.test.ts`
- ファイル名は **`<元ファイル名>.test.ts`**

## フレームワーク

- **Vitest 4**（jest ではない）
- 環境は **jsdom**（`vite.config.ts` で設定済み）
- カバレッジは `@vitest/coverage-v8`

## 書き方

- **public API 経由でテスト**する。private 実装の詳細をアサートしない
- **TypeScript**、`any` 禁止
- ゴールデンパス + エッジケース（境界値・異常系）を必ずカバー
- describe/it のネストは原則1階層。深くなるなら分割を検討

## スタイル

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { Foo } from '../foo'

describe('Foo', () => {
  beforeEach(() => {
    // setup
  })

  describe('methodName', () => {
    it('正常系: <期待される振る舞い>', () => {
      // arrange / act / assert
    })

    it('異常系: <エッジケース>', () => {
      // ...
    })
  })
})
```

## リファレンス

スタイル参考になる既存テスト:
- `src/services/__tests__/answerValidator.test.ts` — シンプルな入力→出力テスト
- `src/services/__tests__/gameManager.test.ts` — Pinia ストアと連携するテスト
- `src/services/__tests__/timeManager.test.ts` — タイマー / 時間計算のテスト
- `src/services/__tests__/quizDataLoader.test.ts` — `fetch` を `vi.stubGlobal` でモックするテスト
- `src/stores/__tests__/gameStore.test.ts` — Pinia ストア単体の状態遷移テスト
