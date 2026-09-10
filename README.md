# YouTube Quiz Battle

YouTubeのクイズ動画を見ながら早押し・解答し、動画出演者との疑似対戦を楽しむ1人用Webアプリ。スマートフォンの縦画面を中心に、PCのキーボード操作にも対応する。

Vue 3・TypeScript・Pinia・Vite・Tailwind CSS v4で構成し、動画再生にはYouTube IFrame APIを使用する。

## 遊び方

[公開アプリ](https://t-yokota.github.io/youtube-quiz-battle/)を開き、読み込み後に「タップしてはじめる」を押す。ボタンを押して動画の再生を開始し、出題される問題に早押しで解答する。設定から効果音・シーク許可・ボタンチェック演出・UIテーマを変更できる。

クイズはURLの`?quiz=`で指定する。省略時は`sample`を読み込む。

```text
https://t-yokota.github.io/youtube-quiz-battle/?quiz=sample
```

PCではSpaceで早押し、解答欄ではEnterまたは送信ボタンで解答できる。

## 開発環境

Node.jsのバージョンは[mise.toml](mise.toml)で管理する（現在24）。miseを利用する場合は、リポジトリのルートで次を実行する。

```sh
mise install
npm ci
npm run dev
```

mise以外でNode.jsを用意する場合も、同ファイルのバージョンに合わせて`npm ci`以降を実行する。

通常の開発URLは`http://localhost:5173/youtube-quiz-battle/?quiz=sample`。ポートが使用中の場合は、起動ログに表示されたURLを使う。動画の読み込みにはインターネット接続が必要。

WSL2上の開発画面を同一ネットワークのスマートフォンから確認する場合は、[スマートフォン実機確認手順](docs/local-device-testing.md)を参照する。

## 開発コマンド

| 用途 | コマンド |
|---|---|
| 開発サーバー | `npm run dev` |
| 型チェック | `npm run type-check` |
| テスト | `npm test` |
| 全ソースのカバレッジと下限検査 | `npm run test:coverage` |
| テストを監視実行 | `npm run test:watch` |
| Lint（自動修正あり） | `npm run lint` |
| Lint（検査のみ） | `npm run lint:check` |
| フォーマット（srcを書き換え） | `npm run format` |
| 本番ビルド（型チェックを含む） | `npm run build` |
| ビルド結果のプレビュー | `npm run preview` |
| バンドル分析（stats.htmlを出力） | `npm run analyze` |

テストから未参照のソースも含めてカバレッジを確認する場合:

```sh
npm run test:coverage
```

## クイズデータの追加

`public/data/<quizId>/data.json`を作成する。`quizId`は英小文字・数字・ハイフンからなる1〜64文字の識別子。YouTubeの動画IDはJSON内の`videoId`で別に指定する。

次は[sampleデータ](public/data/sample/data.json)の第1問を使った最小構成の例。`public/data/my-quiz/data.json`に保存すると、`/youtube-quiz-battle/?quiz=my-quiz`で読み込める。

```json
{
  "videoId": "E5200yjbvj8",
  "settings": {
    "maxAttempts": 3,
    "answerTimeLimit": 10
  },
  "questions": [
    {
      "questionNumber": 1,
      "answers": ["あまおう"],
      "startTime": 4.01,
      "revealTime": 18.78,
      "endTime": 20.3
    }
  ]
}
```

- 時刻は動画先頭からの秒数で、`startTime < revealTime < endTime`とする
- 問題は時刻順に並べ、前問の`endTime`が次問の`startTime`を超えないようにする
- `questionNumber`を指定する場合は1から始まる配列順の連番とする
- `answers`には1つ以上の空でない正解文字列を指定する。表記違いの正解も追加できる
- `answerTimeLimit`は正の整数（秒）。`maxAttempts`には解答可能回数を指定する
- `othersAnsweringPeriods`を指定する場合は、出題開始から正解発表までの区間内に、重複しない時刻順の期間を並べる

シーク許可・解答後の正解発表へのジャンプ・解答中の動画非表示等の設定例はsampleデータと[詳細設計](docs/design.md#sample-quiz-data)を参照する。シークとボタンチェックは、保存済みのユーザー設定がデータの既定値より優先される。

## デプロイとドキュメント

GitHub Pages向けのサブパスは`/youtube-quiz-battle/`。mainへのpushでGitHub Actionsがテスト・ビルド・デプロイを実行する。操作手順は[デプロイ手順](docs/deployment.md)を参照する。

- [タスクと計画の窓口](docs/tasks.md)
- [要件定義](docs/requirements.md) / [詳細設計](docs/design.md)
- [全体レビューとリファクタリング計画案](docs/project-review-and-refactoring-plan.md)
