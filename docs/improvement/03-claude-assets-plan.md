# 03. プロジェクト `.claude/` 整備計画（指示書）

> 対象: `.claude/settings.json` / `.claude/rules/` / `.claude/skills/` / `.claude/agents/` / `.claude/hooks/` / `CLAUDE.md`
> 目的: (1) リファクタリング・ドキュメント分割後もルールと実態が一致し続ける状態を作る、(2) AI エージェントへの引き継ぎ効率を上げる

## C-1: settings.json の権限スコープ修正【優先: 高】

現状:

```json
"permissions": { "allow": ["Edit(/**)", "Write(/**)", "mcp__playwright__*"] }
```

`Edit(/**)` / `Write(/**)` は**ファイルシステム全体**への書き込み許可であり、プロジェクト設定として過剰。コミットメッセージ（d2f240b）の意図は「プロジェクト配下の許可」なので、意図どおりに修正する。

```json
"permissions": {
  "allow": [
    "Edit(./**)",
    "Write(./**)",
    "mcp__playwright__*"
  ]
}
```

検証: 修正後のセッションでプロジェクト内の Edit/Write がプロンプトなしで通り、プロジェクト外（例: `~/tmp` への Write）がプロンプトされること。
あわせて、頻出する読み取り系 Bash（`npm run test` / `npm run type-check` / `npm run lint` / `git status` / `git diff` / `git log`）の allow 追加を検討する（`/fewer-permission-prompts` スキルの実行が手軽）。

## C-2: ルールの実態同期【優先: 高（R 系タスクと連動）】

| ルールファイル | 修正内容 | 連動タスク |
|---|---|---|
| `rules/pinia-store.md` | テスト配置の記述を `src/stores/__tests__/gameStore.test.ts` に修正 | R-0 |
| `rules/vue-component.md` | スタイル方針を R-8 の決定（推奨: デザイントークン + Tailwind ユーティリティ。当面 scoped CSS 併存可）に合わせて書き換え。「色・余白・radius はトークン（`@theme` 変数）を使う。16 進直書き禁止」を追記 | R-8 |
| `rules/vitest-test.md` | リファレンス節に `quizDataLoader.test.ts`（fetch モックの例）を追加。gameStore.test.ts のパス更新 | R-0 |

## C-3: ルールの新設【優先: 中】

### rules/services.md（新規）

```markdown
---
paths:
  - "src/services/**/*.ts"
  - "src/composables/**/*.ts"
---
# Services / Composables Conventions
- ストアの状態変更は必ず gameStore のアクション経由（直接代入禁止）
- console.* 禁止 → `src/utils/logger.ts` の logger を使う
- 数値リテラル（時間・閾値）は `src/constants/` に定義して import
- YouTube プレイヤー状態の比較は `YouTubePlayerState` enum を使う（生数値 1/2/3 禁止）
- タイマー・イベントリスナーを張るモジュールは解除手段（destroy / stop）を必ず公開する
- ファイル上限 400 行目安（コーディング規約の 800 行より厳しめに運用）
```

R-3〜R-6 完了後に追加（先に追加すると既存コードが全部違反でノイズになる）。

## C-4: スキルの追加【優先: 中】

### skills/new-quiz-data（新規）

クイズデータ作成は今後最も頻繁な運用作業になるが手順が design.md に分散している。

```markdown
---
name: new-quiz-data
description: Create and validate a quiz data.json for a new YouTube video (asks videoId, timestamps, answers; validates ordering rules)
disable-model-invocation: true
---
手順:
1. videoId・問題数・各問題の startTime/revealTime/endTime・answers[] をユーザーに確認
2. public/data/{videoId}/data.json を生成（テンプレートは docs/design/data-model.md のサンプル準拠）
3. 検証ルールをセルフチェック:
   - startTime < revealTime < endTime（各問題）
   - questions[i].endTime <= questions[i+1].startTime（区間の被りなし）
   - questionNumber は 1-indexed で配列順と一致
   - othersAnsweringPeriods は QUESTIONING 区間内・昇順・非重複
4. `npm run dev` を起動し `http://localhost:5173/?v={videoId}` での読み込み確認を案内
```

### skills/design-sync（新規）

design-sync-handoff.md で一度手作業として実施した「実装と設計書の同期」を再現可能な手順にする。

```markdown
---
name: design-sync
description: Audit docs/design/ against src/ implementation and produce a categorized diff report (A: internal inconsistency, B: impl divergence, C: future phase)
---
手順:
1. docs/design/ の各ファイルと対応する src/ を突き合わせ（interface 定義・定数値・状態遷移・JSON スキーマ）
2. 差分を A/B/C に分類した表で報告（B は「実装を正とする」前提で修正案を併記）
3. ユーザー承認後に docs を修正。コードには触れない
```

### 既存スキルの微修正

- `skills/task-commit/SKILL.md`: リファクタリングタスク（`Task R-X:`）形式をサブジェクト規約の例に追加

## C-5: hooks の拡充【優先: 低】

現状: `format-on-edit.mjs`（PostToolUse, async）+ `typecheck-on-stop.mjs`（Stop）。構成は健全。

追加候補（必要になってから入れる。先回りで増やさない）:
- **lint-on-edit**: `eslint --fix` を編集ファイルに対して実行（R-3 で no-console を入れた後に検討。format hook と統合し 1 プロセスにする）
- **test-on-stop は導入しない**: テスト全件は Stop ごとに走らせるには重い（タスク完了時に明示実行する運用を維持）

## C-6: CLAUDE.md の更新【優先: 高（D-11 と連動）】

design.md 分割（D-11）後に必須:
- 「ドキュメント参照先」表の `docs/design.md` を `docs/design/README.md`（+ 主要サブファイル）に更新
- 「ディレクトリ構成」に `src/composables/`（R-5 で新設）を追記
- 改善計画の所在を追記: `docs/improvement/00-overview.md`
- コーディング規約のスタイル節を R-8 の決定に同期

## C-7: agents の運用明文化【優先: 低】

`mobile-ui-reviewer`（haiku）/ `vitest-test-writer`（sonnet）は定義済みだが、いつ使うかが CLAUDE.md に書かれていない。CLAUDE.md 作業ルールに 1 行ずつ追記:

- 「`src/components/` 配下の template/style を変更したら mobile-ui-reviewer でレビューする」
- 「services/stores/utils に新規ロジックを足したら vitest-test-writer でテストを書く」

## C-8: settings.local.json の棚卸し【優先: 低】

`.claude/settings.local.json` の中身を確認し、(a) 個人環境依存でないものは settings.json へ昇格、(b) 不要になった許可を削除。内容は機微の可能性があるためレビューはローカルで実施し、コミットしない。

---

## 実行順まとめ

1. C-1（権限修正。単独で即実施可）
2. C-2 ← R-0 / R-8 と同コミットで
3. C-6 ← D-11（design 分割）と同コミットで
4. C-3 ← R-6 完了後
5. C-4 / C-5 / C-7 / C-8 ← 任意のタイミング
