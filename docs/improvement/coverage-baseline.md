# カバレッジベースライン（R-0 時点）

> 記録日: 2026-06-13 / Phase R 着手前のスナップショット。リファクタリング完了後の比較に使う。

## 安全網の状態

| チェック | 結果 |
|---|---|
| `npm run test` | 184 件 / 6 ファイル 全件パス |
| `npm run type-check` | パス |
| `npm run lint` | パス（`.claude/**` を ESLint ignore に追加後。スキル資材のテンプレートが誤って lint 対象だった） |

## カバレッジ（`vitest run --coverage`, v8）

```
-------------------|---------|----------|---------|---------|
File               | % Stmts | % Branch | % Funcs | % Lines |
-------------------|---------|----------|---------|---------|
All files          |   87.01 |    76.51 |   86.51 |   87.47 |
 constants/timing  |     100 |      100 |     100 |     100 |
 services 全体     |   85.26 |    76.92 |   90.76 |   86.21 |
  answerValidator  |     100 |      100 |     100 |     100 |
  gameManager      |   90.00 |    78.19 |   92.10 |   91.13 |
  quizDataLoader   |   98.55 |    98.79 |     100 |   98.48 |
  timeManager      |   35.41 |    21.05 |   80.00 |   35.55 |
 stores/gameStore  |   88.88 |    65.57 |   70.00 |   88.23 |
 types             |     100 |      100 |     100 |     100 |
 utils             |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|
```

## 注記

- **集計対象はテストから import されたファイルのみ**。`services/youtubePlayer.ts`、Vue SFC（`src/components/`）、`App.vue`、`main.ts`、`stores/counter.ts` は未集計（テスト未参照のため）
- `timeManager.ts` の 35% は、プロダクションから参照されていない状態判定 API 群（`getCurrentGameState` / `isInQuestionPeriod` 等）の行が大半。**R-1 で削除予定**のため、削除後はむしろ上がる見込み
- R-1 の `getCurrentGameState` 群削除時は、削除されるテストが踏んでいた境界が `applyThresholds` 系テストでカバーされているかを確認すること（02-refactoring-plan.md R-1 注意書き）
