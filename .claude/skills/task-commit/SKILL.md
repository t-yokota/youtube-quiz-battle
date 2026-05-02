---
name: task-commit
description: Stage and commit changes following this project's convention (Task XX subject, bulleted body, Generated with Claude Code footer)
disable-model-invocation: true
---

# task-commit

Create a commit matching the convention defined in `CLAUDE.md`.

## Convention

- **Subject**:
  - タスク実行時: `Task XX: <内容>` (サブタスクは `Task XX-Y: ...`)
  - タスク外: プレフィックスなし、変更内容を表す日本語サブジェクト
- **Body**: 変更内容を箇条書き（`-` 始まり）
- **Footer**: `Generated with Claude Code (<モデルID>)`

## Process

1. `git status`（`-uall` フラグは使わない）と `git diff`（staged + unstaged）で変更を確認
2. `git log -5 --oneline` で次のタスク番号や直近のスタイルを確認
3. 必要なファイルのみ `git add <file>` で staged に追加（`git add -A` / `git add .` は避ける — `.env` などのリスク回避）
4. HEREDOC で commit message を渡して `git commit`
5. `git commit` 完了後、`git status` でクリーンになったことを確認

## 機密ファイルの警告

`.env`, `credentials.json`, 鍵ファイルなどが staged になっていたら、コミット前にユーザーに確認する。

## Commit template

```
Task XX: <内容>

- <変更1>
- <変更2>
- <変更3>

Generated with Claude Code (<モデルID>)
```

## Example invocation

```bash
git commit -m "$(cat <<'EOF'
Task 19: 結果画面の集計ロジック実装

- services/resultAggregator.ts 新規作成
  - aggregate(): 正答率/平均応答時間を計算
- types/result.ts に AggregatedResult 型を追加

Generated with Claude Code (claude-opus-4-7)
EOF
)"
```

## Notes

- `--no-verify` や `--no-gpg-sign` は使わない（pre-commit hook 失敗時は原因を直す）
- amend ではなく新規コミットを作る（既存コミットの上書きは事故のもと）
- 変更がなければコミットしない（空コミットは作らない）
