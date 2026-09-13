# デプロイ手順

Cloudflare PagesのDirect Uploadプロジェクト`youtube-quiz-battle`へ、GitHub Actionsから検証済みの成果物を公開する。Cloudflare側のGit連携は使用しない。公開パスは`/`。

| ブランチ | 公開先 | GA4 |
| --- | --- | --- |
| main | https://youtube-quiz-battle.pages.dev/ | 本番測定IDで送信 |
| develop | https://develop.youtube-quiz-battle.pages.dev/ | 無効 |

developの固定URLは初回のブランチデプロイ後に有効になる。独自ドメインは後からPagesのCustom domainsで設定する。

## 初期設定

GitHubリポジトリのSettings → Secrets and variables → Actionsへ登録する。

| 種類 | 名前 | 内容 |
| --- | --- | --- |
| Repository secret | `CLOUDFLARE_API_TOKEN` | 対象アカウントのCloudflare Pages → Edit権限を持つAPIトークン |
| Repository variable | `CLOUDFLARE_ACCOUNT_ID` | PagesプロジェクトのアカウントID |

アカウントIDをRepository secretに登録しても利用できる。両方にある場合はVariableを優先する。プロジェクト名はワークフローに直接記載しているため、Variableは不要。

Cloudflare PagesのProduction branchは`main`にする。ワークフローはデプロイ前にAPIで確認し、異なる場合は公開を止める。Direct Uploadで本番ブランチを変更する場合は、[公式手順](https://developers.cloudflare.com/pages/get-started/direct-upload/#production-branch-control)に従ってプロジェクトAPIへ`{"production_branch":"main"}`をPATCHする。

GitHubのEnvironmentはmain用の`production`、develop用の`preview`を使用する。承認必須ルールは設定しなくてもよい。認証情報は上記Repository secretを参照する。

## ワークフロー

`.github/workflows/check.yml`（Quality checks）で実行する。

1. PR、main・developへのpush、または手動実行で検証を開始する。
2. `npm ci` → `npm run lint:check` → `npm run type-check` → `npm run test:coverage` → `npm run build-only`を実行する。カバレッジは全指標80%以上が必要。
3. main・developのpush／手動実行のみ、生成した`dist/`をartifactとして保存する。
4. 検証成功後のdeployジョブが同じartifactを取得し、Cloudflareの本番ブランチ設定を確認してWranglerで公開する。再ビルドはしない。

PRでは公開ジョブを実行せず、検証・ビルドにもCloudflareトークンを渡さない。同じブランチの実行は直列化する（進行中は完了させ、待機中の古い実行はGitHubのconcurrency制御で置き換わる）。

GA4はビルド時の`VITE_GA_MEASUREMENT_ID`で切り替える。mainは本番ID、develop・PRは空文字にする。Cloudflare側に環境変数を設定しても、アップロード済みのJavaScriptには反映されない。

## 通常の公開

1. developをpushし、Actionsのcheck・deploy成功を確認する。
2. developの固定URLで実YouTube・スマホ操作・PWA更新を確認する。
3. 確認後にmainへ取り込み、pushする。

```bash
git push origin develop
# HTTPS検証後
git checkout main
git merge --ff-only develop
git push origin main
git checkout develop
```

Actionsの成功後、対象URLでアプリの起動を確認する。PWAは更新通知から更新し、インストール済みアプリも確認する。

## 移行時の確認

- このワークフローでの初回公開と、本番ブランチ設定の実確認は未完了。
- 旧GitHub Pages用の`deploy.yml`は削除済み。Cloudflareでの公開確認後、GitHubのSettings → Pagesから旧サイトをUnpublishする。
- 独自ドメインを設定したらREADMEと本書の本番URLを更新する。

## 失敗時

- check失敗: Lint・型・テスト・カバレッジ・ビルドの該当ログを確認する。公開は行われない。
- 認証エラー: Secret名、トークン期限、Pages編集権限、アカウントIDを確認する。
- 本番ブランチ検証エラー: CloudflareプロジェクトのProduction branchを`main`へ修正する。
- アップロードの一時障害: 最新コミットのrunであることを確認し、失敗したジョブを再実行する。古いrunを再実行すると古い成果物を再公開するため、通常は最新ブランチから手動実行する。

Direct Uploadの仕様は[Cloudflare公式CI手順](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)を参照。
