# ポスト Fable 初日チェックリスト（2026-07-08 以降の最初のセッション用）

> Fable 5 のサブスク利用は 2026-07-07 まで。以降のオーケストレータ（Opus/Sonnet 系）はこの手順で開始する。

## 1. 環境切替（ユーザー作業）

- [ ] `~/dotfiles/.claude/settings.json` の `model` / `advisorModel` を最新 Opus 系へ変更（手順詳細: dotfiles の `.claude/README.md` 末尾「Post-Fable Model Switch」）
- [ ] `~/dotfiles/.claude/rules/ecc/common/performance.md` のモデル割当列を現行世代に更新

## 2. オーケストレータが最初に読むもの（順に）

1. `CLAUDE.md`（プロジェクト規約。「spec の無い設計作業はエスカレーション」の原則を含む）
2. `docs/improvement/00-overview.md` の「実行体制」（役割ベース。自分は Orchestrator 役）
3. `orchestrator-playbook` スキル（spawn パッケージング・報告検証・2ストライク・コミット規律）
4. `docs/tasks.md`（次タスクの確認）
5. 着手タスクに対応する `docs/improvement/specs/` の spec

## 3. 実行原則（要約）

- spec があるタスクだけを実行する。spec が現物と食い違ったら黙って読み替えず、ユーザーへ報告
- Worker の報告は必ず自分で再検証（テスト再実行・diff 精読・件数突合）してからコミット
- 設計判断（分割・裁定・デザイン方針）が必要になったら着手前にユーザーへ提案

## 4. 残タスクと spec 対応（2026-07-02 時点）

| 次タスク順 | spec |
|---|---|
| R-6（GameManager 分割） | specs/r6-gamemanager-split.md |
| R-7a / R-7b | 02-refactoring-plan.md + specs/remaining-tasks-notes.md |
| R-9 | specs/remaining-tasks-notes.md（R-6 後） |
| 19-0〜21-2 | specs/phase3-feature-specs.md（A3/V3 はユーザー裁定済み 2026-07-03、確認不要） |
| D-1 / D-2 | specs/design-tokens-and-case1.md（D-2 のタイマー 2 案はユーザー選択） |
| Phase 4（22/23/25/26/27） | spec 未作成。**着手前に Designer 手順（ユーザー相談 or spec 作成 + ドライラン検証）を踏む** |

## 5. spec ドライラン検証の型（新 spec を書いたら必ず）

中位モデルの Worker に「この spec だけで実装できるか。曖昧点・現物との不一致・不足情報を列挙せよ（実装禁止）」と読ませ、指摘を spec に反映してから実装に入る。
