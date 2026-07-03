# プロジェクト改善計画 — マスタープラン

> 作成日: 2026-06-11 / 基準: ブランチ `develop`（旧 develop/claude-code、2026-07-04 改名）, HEAD `2b66c0b`（Task 18-3 完了、次タスク 19 の時点）
> 更新: 2026-06-12 — ユーザー決定を反映（ケース1採用・ケース2不採用 / スタイル方針A / button.webp 不使用 / 旧 Task 24 廃止 / 実行ルールを自律実行型へ改定）。詳細は「決定事項」参照
> 目的: 本ディレクトリ（`docs/improvement/`）は、AI エージェントが引き継いで実行できる粒度でプロジェクト全体の改善を指示するドキュメント群である。**各ドキュメントが指示書、本書が索引と実行順序の定義。**

## ドキュメント構成

| # | ドキュメント | 内容 |
|---|---|---|
| 01 | [01-document-quality.md](01-document-quality.md) | design.md ほかドキュメントの不整合指摘（D-1〜D-17）と修正指示、design.md 分割計画 |
| 02 | [02-refactoring-plan.md](02-refactoring-plan.md) | コードリファクタリング計画（R-0〜R-9）。挙動不変・テスト保護つき |
| 03 | [03-claude-assets-plan.md](03-claude-assets-plan.md) | `.claude/`（settings / rules / skills / agents / hooks）整備計画（C-1〜C-8） |
| 04 | [04-task-replan.md](04-task-replan.md) | docs/tasks.md の置き換え案（Phase R / 3 / D / 4 の新タスク体系） |
| 05 | [05-design-review.md](05-design-review.md) | デザインレビュー（V-1〜V-10）とワイヤーフレーム 2 案の解説 |
| - | [../assets/wireframe-v2-case1.html](../assets/wireframe-v2-case1.html) | ケース1: 構成維持・CSS 刷新案 — **採用**。FINISHED リザルト・タイマー2案・チップページャ等を反復改善済み（ブラウザで開いて状態切替可能） |
| - | [../assets/wireframe-v2-case2.html](../assets/wireframe-v2-case2.html) | ケース2: 構造変更案 — **不採用（2026-06-12）**。アーカイブ参考資料として保持 |

## 主要な発見（要約）

### ドキュメント
- design.md に実装と矛盾する記述が残存（更新間隔 100ms vs 実際 150ms、シーク閾値の旧値 0.1 秒、React 代替案の残骸、GameManager interface の乖離）
- **設計済み・型定義済みなのに実装が存在しない機能が 2 つ**（`hideVideoPlayerDuringAnswer`、横画面警告の表示トリガ）あり、タスク表にも載っていない＝実装漏れ状態
- 2,316 行の design.md は分割が必要。design-sync-handoff.md は役目を終えており処分判断が必要

### コード
- 機能ロジックはテスト 150 件で良く保護されている一方、横断的な負債がある: GameManager 799 行（規約上限）、ストア直接変更（自プロジェクトのルール違反）、console.log 42 箇所、マジックナンバー、**誰も購読しない 150ms インターバルの常駐（二重時間ループ）**、destroy 未呼び出しのリソースリーク、未使用 API（TimeManager の状態判定群、counter.ts 等）
- スタイル実装がルール（Tailwind v4 利用）と乖離: 実態は scoped CSS + 16 進直書きの分散

### .claude/
- `Edit(/**)` / `Write(/**)` がファイルシステム全体を許可しており、プロジェクト配下に絞る修正が必要（最優先）
- rules とコード実態のずれ（テスト配置、スタイル方針）の同期が必要

### デザイン
- 機能骨格は健全だが、視覚は Tailwind 既定色のプロトタイプ段階。「早押しの緊張感」が表現されていない
- 方向性として「TV クイズ番組のステージ / スコアボード」を提案し、トークン定義済みのワイヤーフレーム 2 案を作成

## 推奨実行順序

```
[即時・単独実行可]
  C-1 settings.json 権限スコープ修正

[Wave 1: ドキュメント修正]（コードに触れない）
  D-1〜D-10（design.md の不整合修正）→ D-13（README/package name は R-1 と択一）

[Wave 2: リファクタリング]（docs/tasks.md を 04 案で更新してから着手）
  R-0 → R-1 → R-2 → R-3 → R-4 → R-5 → R-6 → R-7 → (R-9)
  併走: C-2（ルール同期）

[Wave 3: ドキュメント構造]（Wave 1, 2 完了後）
  D-11 design.md 分割 + C-6 CLAUDE.md 更新 + D-12 handoff 処分 + D-17 tasks アーカイブ

[Wave 4: 機能完成 + デザイン]（並行可）
  Phase 3（19-0 → 19 → 19-2 → 20 → 20-2 → 20-3 → 20-4 → 21 → 21-2）
  Phase D（D-1 トークン → D-2 ケース1適用）

[Wave 5: 品質・リリース]
  22 → 23 → 25 → 26 → 27
```

## 実行時の共通ルール（自律実行型・2026-06-12 改定）

1. **自律的に連続実行してよい**。Wave 順に従い、ユーザーの都度承認を待たずに複数タスクを進める。コミット粒度は従来どおり **1 タスク 1 コミット**とし、タスク完了ごとに docs/tasks.md のチェックボックスを更新する
2. 完了条件は常に `npm run test` + `npm run type-check` + `npm run lint` のパス
3. **ユーザー確認が必要なのは「仕様の判断」のみ**: 仕様バグ（実装と設計が矛盾し、どちらが正かをユーザーが決めるべきもの）・要件の不明点・設計方針の変更。確認待ちでブロックされたら、質問を提示した上で依存しない次のタスクへ進む
4. **実装上のバグ（テスト失敗・型エラー・明白な誤り）は自律的に解決する**。進行中タスクと無関係な修正はコミットを分ける
5. 各指示書の行番号・件数は作成時点のスナップショット。**実行前に必ず現物を確認**すること

## 実行体制（役割ベース・2026-07-02 改定 / 初版 2026-06-13）

役割は 4 つ。**モデル名は下の割当表だけに書き、本文・タスク表では役割名を使う**（モデル世代交代時は割当表のみ差し替える）。

- **Orchestrator**: 計画・タスク振り分け・全 diff レビュー・コミット。設計済み spec（`docs/improvement/specs/`）があるタスクのみインライン実行してよい
- **Designer**: 未設計タスクの設計・仕様バグの裁定・spec の作成。**Orchestrator と Designer が別モデルの期間（ポスト Fable 期）は、spec の無い設計作業に着手する前にユーザーへエスカレーションする**（自己流設計の禁止）
- **Worker**: spec/指示書に従う実装・テスト作成。コミットしない
- **Reviewer**: diff レビュー補助（mobile-ui-reviewer 等の専用エージェント）

### モデル割当表

| 役割 | Fable 期（〜2026-07-07） | ポスト Fable 期 |
|---|---|---|
| Orchestrator | Fable 5 | Opus 系の最新（なければ Sonnet 系の最新） |
| Designer | Fable 5（インライン） | 原則ユーザー相談。軽微なら Orchestrator + 事後ユーザーレビュー |
| Worker（機械的） | Sonnet 5 | Sonnet 系の最新 |
| Worker（裁量中） | Sonnet 5（2026-07-03 変更。spec が詳細なら十分。2ストライク時は Opus 系へ昇格） | Sonnet 系の最新（同左の昇格ルール） |
| Reviewer | haiku（mobile-ui-reviewer 指定済み） | 同左 |

切り出し判断は「**仕様の密度 vs 実装の表面積**」: 指示が短く編集量が多いタスクほど Worker 向き。判断中心で編集量が小さいタスクは Orchestrator がインラインで実行する。

| 担当 | 対象タスク | 理由 |
|---|---|---|
| Orchestrator インライン | 仕様バグの一次切り分け / 全 diff レビューとコミット / spec 済みの小タスク（D-12 等） | 判断中心・編集量小。切り出すと逆に高コスト |
| Worker（機械的） | R-7a / テスト作成（19-2, 20-2, 21-2。vitest-test-writer 使用）/ D-1 トークン移植 | spec/指示書に手順まで記載があり機械的。テスト群が安全網 |
| Worker（裁量中） | R-6 実装 / R-7b / R-9 / 19・20・21 の機能実装 / D-2 デザイン適用 | 実装裁量が中程度。設計は specs/ で確定済み |
| Orchestrator 引き取り | 同種の失敗が2回続いたタスク / R-6 の「既存テスト無修正パス」を満たせない場合 | 追加指示で粘るより引き取るほうが安い。引き取っても解けなければユーザーへ |

### 事前設計済み spec（Designer=Fable 5 が作成、2026-07-02）

| spec | 対象タスク |
|---|---|
| [specs/r6-gamemanager-split.md](specs/r6-gamemanager-split.md) | R-6 |
| [specs/phase3-feature-specs.md](specs/phase3-feature-specs.md) | 19 / 19-2 / 20 / 20-2 / 20-3 / 20-4 / 21 / 21-2（要ユーザー確認 2 点を含む） |
| [specs/design-tokens-and-case1.md](specs/design-tokens-and-case1.md) | D-1 / D-2 |
| [specs/remaining-tasks-notes.md](specs/remaining-tasks-notes.md) | R-7 / R-9 / D-12 の裁定 |
| [specs/phase4-quality-release.md](specs/phase4-quality-release.md) | 22 / 23 / 27（GitHub Pages）。25 / 26 は後回し・未設計 |

### 運用ルール

1. **指示書パッケージング**: spawn プロンプトに「該当指示書セクションの要約 + 対象ファイルパス + 完了条件（`npm run test` / `type-check` / `lint` のパス）+ やらないことリスト」を必ず含める。コールドスタートの再探索を防ぐことが最大のトークン削減
2. **コミット権は Orchestrator**: Worker の作業はワーキングツリーの変更まで。Orchestrator が diff をレビューし、`Task XX:` 規約でコミットする（1 タスク 1 コミットと品質ゲートの維持）
3. **2ストライクで引き取り**: 同じ失敗を2回報告した Worker には追加指示で粘らず、Orchestrator が引き取る。引き取っても解決しない場合はユーザーへエスカレーション
4. **連続タスクは同一エージェント継続**: R-1→R-2→R-3 のような連鎖は毎回新規 spawn せず、SendMessage で同じサブエージェントに続けて投げてコンテキストを再利用する
5. **並列はフェーズ境界のみ**: R 系は依存連鎖のため直列。Phase 3 と Phase D が並行可能になった時点で worktree 分離して並列 spawn する
6. **成功報告の検証**: サブエージェントの完了報告は鵜呑みにせず、テスト実行結果（件数・パス状況）で裏取りしてからコミットする

## 決定事項（2026-06-12・ユーザー確認済み）

| 論点 | 決定 |
|---|---|
| デザイン案 | **ケース1（構成維持・CSS 刷新）を採用**。ケース2（構造変更）は不採用。wireframe-v2-case2.html はアーカイブ参考資料として保持 |
| R-8/D-1 スタイル方針 | **A（デザイントークン + Tailwind ユーティリティへ段階移行）** |
| D-14 button.webp | **不使用・削除**（コミットしない） |
| 旧 Task 24（ボタン画像スプライト） | **廃止**。ケース1の CSS 物理ボタンで代替 |

未決の判断ポイント: なし（D-2 のタイマー表示は①リングに決定・2026-07-03）。
