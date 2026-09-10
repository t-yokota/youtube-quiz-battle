# プロジェクト全体レビューとリファクタリング計画

> **コード改善の草案（2026-09-10）**: 旧計画の決定を反映済み。設計書分割・クイズ作成スキルは対象外、ルール同期・設計同期スキルは保留。参照・README更新は完了、GA4の既存アプリ実装範囲は動作確認済みとして扱う。以下のコード改善は提案であり、実装には未着手。

作成日: 2026-09-10 / 対象: `develop`、HEAD `cf44162` のワーキングツリー。
対象範囲: `src/`、テスト、ビルド・CI・PWA設定、README、設計・改善・タスク文書。
レビュー時点ではコード・既存テスト・設定は変更していない。後続の旧計画整理では文書の移動・参照更新を行った。開始時から存在した `.claude/settings.json` の変更は対象外。

## 結論

既存の R-0〜R-9 による責務分割、ストアアクション、テーマトークン、サービスの単体テストは有効な基盤になっている。全面的な再設計よりも、**入力操作・内部シーク・プレイヤー初期化の不具合を回帰テストで保護し、時刻とライフサイクルの契約を整理する**ことを優先する。

App.vue は741行、SettingsModal.vue は855行、ExternalPauseController は509行。行数自体より、App に初期化・分析送信・音声設定・操作制御が集中し、サービス間で「内部操作後の時刻」「保留中のタイマー」の管理が分かれていることが問題である。

## 検証結果と限界

| チェック | 結果 |
|---|---|
| `npm run build`（型チェックを含む） | 成功 |
| `./node_modules/.bin/eslint .` | 成功。`npm run lint` は `--fix` を含むため使用していない |
| Vitest | 32ファイル・484件、すべて成功 |
| 全ソースを対象にしたカバレッジ | Statements 66.00%、Branches 57.65%、Functions 59.85%、Lines 68.21% |
| services のカバレッジ | Statements 84.77%、Branches 80.66%、Lines 86.35% |
| 実機・実YouTube・本番GA4・PWA更新 | 今回未実施 |
| 依存パッケージの脆弱性監査 | 今回未実施。依存の安全性を保証する評価ではない |

カバレッジの実行コマンド:

```sh
npm test -- --coverage \
  --coverage.include='src/**/*.{ts,vue}' \
  --coverage.exclude='src/**/__tests__/**' \
  --coverage.exclude='src/types/**'
```

App.vue、VideoPlayer.vue、AnswerContent.vue、youtubePlayer.ts、useGameLoop.ts、useOrientationGuard.ts は実行カバレッジ0%。SettingsModal等はテストファイルが存在しても、ソース文字列・CSS検査が中心で動作の検証になっていない箇所がある。テーマ・レイアウトの静的検査は残し、操作と副作用のテストを補う。

旧 [coverage-baseline.md](archive/improvement-202606/coverage-baseline.md) の87.47%（行）はimportされたファイルのみの集計であり、今回と母集団が異なる。今回の値だけで品質が低下したとは判断しない。

以下の不具合は**コードの制御経路から確認した指摘**。今回、個別の再現テストの追加やブラウザでの再現は実施していない。実装着手時に記載シナリオを失敗するテストとして固定する。参照行は上記HEAD時点。

## 優先度別の指摘

P1: 主機能の阻害・誤判定を招くため構造変更前に修正。P2: 条件付き障害・保守性・検証不足。P3: 整理・文書更新。

| ID | 優先度 | 指摘・発生条件と影響 | 根拠 |
|---|---|---|---|
| F-01 | P1 | 開始ゲート表示中、bodyにフォーカスした状態でSpaceを押すとゲームが開始する。ゲートは残り、READY以外では解除できず操作を阻害する | [App.vue](../src/App.vue#L383) のキー処理、394行のREADY判定、560〜578行のゲート |
| F-02 | P1 | IME変換確定のEnterでも解答送信される。日本語入力の途中で正誤判定・試行回数消費が発生する | [AnswerContent.vue](../src/components/game/AnswerContent.vue#L55)、131行。composition判定なし |
| F-03 | P1 | 正解発表へ内部シーク後、次のポーリングがユーザーシークとして処理される。シーク禁止なら元の位置へ戻り、許可なら問題消費・TALKING遷移を起こす | [answerFlowController.ts](../src/services/answerFlowController.ts#L167) のseekはTimeManagerを同期しない。[gameManager.ts](../src/services/gameManager.ts#L337) の通常シーク判定 |
| F-04 | P1 | 150ms間隔で継続ポーリングすると停滞検出の壁時計差が1200msに達しない。長いバッファリングを検出できない | [externalPauseController.ts](../src/services/externalPauseController.ts#L388) は毎回比較基準を更新。[useGameLoop.ts](../src/composables/useGameLoop.ts#L39) |
| F-05 | P1 | YouTubeのready後のエラーが上位へ通知されない。解決済み初期化Promiseへのrejectだけで、再生エラーが表示されない | [youtubePlayer.ts](../src/services/youtubePlayer.ts#L152)、161〜163行 |
| F-06 | P1 | APIスクリプト読込成功後、Playerからready/errorが来ないと初期化が終わらない | [youtubePlayer.ts](../src/services/youtubePlayer.ts#L80)。APIロードには期限があるがPlayer生成にはない |
| F-07 | P2 | 押下後の100ms・1800ms等のタイマーがreset/destroy後も発火し、状態変更や新たなカウントダウン開始を起こせる | [gameManager.ts](../src/services/gameManager.ts#L218)、395行。押下タイマーのハンドルを保持していない |
| F-08 | P2 | localStorageの取得失敗で起動が中断し、保存失敗で設定変更の後続処理が中断する | [settingsStore.ts](../src/stores/settingsStore.ts#L24)、54行。[useTheme.ts](../src/composables/useTheme.ts#L60)、68・78行 |
| F-09 | P2 | JSONを検証前にRawQuizDataへキャスト。`null`、数値videoId、文字列boolean、オブジェクトのothersAnsweringPeriods等を適切に拒否できず、不正設定やTypeErrorを生む | [quizDataLoader.ts](../src/services/quizDataLoader.ts#L73)、94・118・169・224行 |
| F-10 | P2 | 0秒開始の問題はローダーで許可されるが、初期previousTime=0では開始条件 `prev + ε < startTime` を満たさずQUESTIONINGにならない | [thresholdEngine.ts](../src/services/thresholdEngine.ts#L174)、[timeManager.ts](../src/services/timeManager.ts#L11) |
| F-11 | P2 | 複数問を前方シークで飛ばすと、後続の未解答問題にも現在問の押下・送信種別配列が転記される | [gameStore.ts](../src/stores/gameStore.ts#L207)、[thresholdEngine.ts](../src/services/thresholdEngine.ts#L293)。userAnswersだけ問題別に選別 |
| F-12 | P2 | ダイアログのフォーカス閉じ込め・復元・背景操作遮断が不足。Tabで背面のゲームへ移動できる | [SettingsModal.vue](../src/components/dialogs/SettingsModal.vue#L131)、[ThemeSwitcher.vue](../src/components/theme/ThemeSwitcher.vue#L152)、Appのグローバルキー処理 |
| F-13 | P2 | 音声にdisposeがなく、App終了時にAudioContext・無音ループを解放しない。非同期resume後の再生もstopと競合する | [audioManager.ts](../src/services/audioManager.ts#L158)、197・256行、[App.vue](../src/App.vue#L468) |
| F-14 | P2 | CIはmain push/手動実行のみ。PR上の検証とLint・coverage閾値による防御がない | [.github/workflows/deploy.yml](../.github/workflows/deploy.yml#L5)、[vite.config.ts](../vite.config.ts#L80) |

F-03の回帰例: 前回動画時刻11秒、revealTime=20秒として解答を確定し、直後に `updateVideoTime(20)` を呼ぶ。シーク許可・禁止の両方で、REVEALINGの維持と元位置へのseekがないことを検証する。

F-04の回帰例: 初期基準を与えた後、動画時刻固定・BUFFERING状態で150ms刻みに1.2秒以上進める。現在の単発で1200ms飛ばすテストでは検出できない。停滞時のpauseと「動画時間が進むこと」を要求する復帰条件にも整合確認が必要。

## 実施計画

各段階は小さなレビュー単位に分ける。不具合修正と挙動を保つ抽出を別コミットにし、公開APIを維持したまま段階移行する。以下の規模は工数の相対目安（S: 局所、M: 複数モジュール、L: 統合検証込み）で、日程の確約ではない。

| 段階 | 作業・成果物 | 依存 | 規模 | 完了条件 |
|---|---|---|---|---|
| A | 全ソースのcoverage設定を固定。非破壊の`lint:check`、PR用の品質workflowを追加。Playerと時刻取得が連動するテスト用フェイクを用意 | なし | M | 既存484件成功、build/Lint成功。現状値を再現可能に記録し下回ったら検知 |
| B1 | F-01・02をテスト→修正。共通のゲーム操作可否判定とIME対応Enter処理 | A | S | ゲート・各overlay表示中に背面操作なし。変換確定で送信0回、通常Enterで1回 |
| B2 | F-03・04・10・11をテスト→修正。内部シーク、停滞検出、0秒境界、問題別結果の整合 | A | M | 操作→非同期通知→複数tick後も正しい状態・位置・結果。シーク許可ON/OFF、リプレイでも成立 |
| B3 | F-05・06・08・09をテスト→修正。初期化失敗・実行時エラー・保存不能・不正JSONを扱う | A | M | ready待機の期限、ready後エラー表示、保存不能でも起動、invalidデータは統一エラー |
| C | F-07・13を修正。Player/音声/タイマー/非同期初期化の所有者とdisposeを明確化 | B2・B3 | M | reset/destroy/unmount後に状態変更・再生・新規タイマーがない。初期化途中の終了でも後始末 |
| D | AppのAnalyticsと初期化・セッション管理を抽出。設定解決・結果イベント生成を一元化 | B1〜C | L | Appは画面構成とイベント接続中心。イベントpayload・送信回数・リプレイ動作の互換を統合テストで確認 |
| E | 共通ダイアログ基盤とSettingsModalの責務分割。F-12対応 | B1・C | M | focus移動/復元、背景遮断、閉じられる画面のEscapeを検証。画面幅・テーマ変更で表示を維持 |
| F | 文書同期、未使用資産整理、実機・PWA確認、カバレッジ最終ゲート | D・E | M | 全指標80%以上、全チェック成功。未完了の実機項目と判断事項が明記されている |

推奨順: A → B1 → B2 → B3 → C → D → E → F。B1〜B3のテスト・局所修正は担当ファイルが重ならない範囲で並行可能。DのApp抽出は不具合修正が落ち着いてから行う。

### 構造変更の具体案

1. **時刻・シークの契約**: 内部シークを専用操作に集約し、目的・目標時刻・TimeManager同期・閾値消費方針をまとめる。YouTubeの遅れた時刻通知もテスト対象にする。単にpreviousTimeを書き換えるだけで完了としない。
2. **終了処理の契約**: 作成した単位がtimer/listener/player/audioを解除する。リセットと完全破棄を区別し、保留中の非同期処理は世代番号等で失効させる。Player初期化途中のunmountにも対応する。
3. **App分割**: `useQuizAnalytics`（設定・結果・セッション送信）と `useQuizSession`（ロード、Manager接続、開始・リプレイ・終了）を候補とする。音声設定のwatchは音声の所有者へ移す。iOSのタップ内focus・unlock・warmupは同期のユーザー操作内に残す。
4. **結果の契約**: 結果記録へ問題単位のattemptデータを明示的に渡す。並行する配列の対応関係をテストし、必要ならattemptオブジェクト配列に内部モデルを集約する。既存Result/Analytics形式には変換層を置く。
5. **境界**: ローダーを `unknown → 構造検証 → 時刻等の意味検証 → 内部型` に分ける。storageはread/write双方で失敗時にセッション内設定へ退避する。スキーマライブラリ導入は必須ではない。
6. **UI**: 共通ダイアログは名前・role・modal状態・focus管理を持つ。警告/読み込み等の閉じられない画面は明示設定で区別。SettingsModalは一般設定・デバッグ設定を単位に抽出し、CSSトークンを維持する。

## テストとリリース判定

- 単体: ローダーの不正値、保存失敗、タイムアウト、内部シーク、0秒境界、連続stall監視、結果記録。
- 統合: 実際にVueをmountし、開始ゲート・IME・解答・リプレイ・設定・Playerエラーの経路を検証。既存のソース文字列検査の件数を動作保証とみなさない。
- カバレッジ: Aでは現在値を下限にして後退を防ぎ、B〜Eで不足領域を埋める。FでStatements/Branches/Functions/Linesすべて80%以上を目標・完了条件にする。未達は明示し、重要ファイルの除外で達成扱いにしない。
- 実機: iOS/AndroidのIME・キーボード・音声unlock、横向き/タブ復帰、正解/不正解/timeout、2周目、シーク設定両方を確認する。PWAは更新を保留したプレイ、更新後再起動、オフライン時表示を確認する。
- E2E: [tasks.md](archive/improvement-202606/tasks.md) には2026-07-06のスイート不採用が記録されている。今回の基本計画はunit/統合+既存の実機チェックで進める。自動E2Eは開始→解答→リプレイ等の少数ケースに限定する再導入案として別判断にし、導入しない場合の手動負担を残課題として明記する。
- 各PR: 非破壊Lint、型、build、test、coverageを実施。デプロイ権限はデプロイjobへ限定する。今回の作業ではworkflow変更・push・デプロイは実行していない。

## 文書・運用の整理と判断事項

- 旧R計画は実施済みの履歴として保持し、今回の計画を新たな改善サイクルとして扱う。R-6の分割を再実施しない。
- 旧`docs/tasks.md`のPhase 4・330件・Firebase設定待ち等の記述は、旧計画整理で履歴へ移動済み。GA4のアプリ実装範囲はユーザー認識に基づき動作確認済みとして終了した。新たなコード改善を実行する際に現役`docs/tasks.md`へ実行計画を登録する。
- `docs/design.md`は分割しない（ユーザー決定）。参照先は現配置へ更新済み。今後のコード変更に伴う内容の更新は同ファイルに反映する。ルール同期・設計同期スキルの作成は保留。
- READMEのクイズ指定URL、作成例、開発・検証コマンド、設計・デプロイへのリンクは更新済み。未使用候補の`src/assets/base.css`・`logo.svg`は参照と用途を再確認してから削除する。
- Analyticsの自由入力解答送信は、現状のマスキングで完全匿名化されるわけではない。送信項目を維持するか、集計値へ縮小するかは別のプロダクト判断とする。今回、送信仕様の変更や法令適合性の判定は行わない。
- 音量値のクランプは既存テストが範囲外保存を許容しているため、UI/ストア契約変更として扱う。外部公開APIの互換性を確認してから決める。
- 状態機械ライブラリ導入、サービス全面書き換え、依存の一括更新は今回の必須計画に含めない。既存構成で契約とテストを整える。

最初の実装単位は **Aの検証基盤とB1の開始ゲート・IME回帰テスト/修正**。その後B2でゲーム進行の整合を固めてから、抽出を進める。
