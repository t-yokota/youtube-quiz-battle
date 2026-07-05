# デプロイ手順

GitHub Pages でホスティングしている。**main ブランチへの push が GitHub Actions（`.github/workflows/deploy.yml`）を発火させ、自動でビルド・デプロイされる。**

- 公開 URL: https://t-yokota.github.io/youtube-quiz-battle/
- ワークフロー: checkout → mise（Node）→ `npm ci` → `npm run test` → `npm run build` → Pages へアップロード

## 手順

開発は develop ブランチで行い、デプロイしたいタイミングで main へ取り込む。

```bash
# 1. develop を push
git push origin develop

# 2. main に切り替えて develop を取り込み、push（← これがデプロイのトリガー）
git checkout main
git merge --ff-only develop
git push origin main

# 3. develop に戻る
git checkout develop
```

未コミットの変更（例: .claude/settings.json）がありブランチ切替がブロックされる場合は、前後で退避・復元する:

```bash
git stash push -m "wip" <ファイル>   # 手順 2 の前
git stash pop                        # 手順 3 の後
```

## 確認

- GitHub の **Actions タブ**で「Deploy to GitHub Pages」が success になれば反映完了
- 反映直後はブラウザキャッシュが残ることがあるため、スーパーリロードで確認する

## 失敗時

- `Error: Deployment failed, try again later.` は **Pages 側の一時障害**のことが多い。
  Actions の失敗した run から **Re-run failed jobs** で再実行すれば大抵通る（過去実績: 最大 3 回目で成功）
- 繰り返し失敗する場合は Settings → Environments → github-pages に
  In progress のまま固まったデプロイがないか確認し、あればキャンセルする
- テスト失敗などビルド側のエラーの場合はログを見てコードを修正する
