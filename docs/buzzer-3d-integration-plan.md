# 3D早押しボタンの組み込み計画

作成日: 2026-09-14。対象: develop / `723f1cd`。状態: 実装・ローカル検証完了。実機確認・公開は未実施。

## 結論

提供キットの形状・アニメーション計算を再利用し、現在のQuizButtonに3D表示を追加する。受理判定・動画停止・効果音・解答期限は既存のApp／GameManagerが担当する。現行2Dを残し、初回導入では設定から3D円形／3D早稲田式風を選べる構成を推奨する。

モデルの追加だけでは完了しない。Vue接続、クリックと回転の競合回避、小ボタンのタップしやすさ、WebGL障害時の2D復帰が主な実装範囲となる。3Dを初期表示にする判断は実機確認後に行う。

## 確認した資産

参照元: `C:\Users\yokota\Downloads\quizbattle-waseda-model-addon\buzzer-3d-kit`。
`ADDON.md`を最新仕様として、README、HANDOFF、設定JSON、共通view、両モデル、型契約、全テストを確認した。

| 項目 | 確認内容 |
| --- | --- |
| モデル | `simple-round-v1`、`waseda-style-v1`の2種類。Three.jsの手続き型メッシュで、GLBは不要 |
| 共通描画 | 1つのrenderer・camera・入力処理を共有し、factoryを交換 |
| 押下 | down 40ms／hold 20ms／up 80ms、合計140ms。ゲーム側の100ms遷移とは独立 |
| 発光 | RELEASED中は500ms周期。円形はキャップ、早稲田式風は固定ランプのみ |
| 操作 | キットはキャップへのpointerdownで通知、台座・余白はドラッグ回転 |
| 姿勢 | 親グループX=-10°。操作回転0°が基準姿勢 |
| 依存 | Three.js 0.128.0、独立デモ用Vite。既存アプリへの接続は未実装 |
| 検証記録 | 提供元は7件のNodeテスト・ビルド成功を記録。実ブラウザ・タッチ確認は未実施 |

初回調査ではソースレビューとSHA256マニフェスト22件の一致を確認した。後続実装でThree.js 0.186.0と同版の型定義を導入し、モデル・計算をTypeScriptへ移植した。外部フォルダは変更していない。

## 現在のアプリとの接続

- [QuizButton.vue](../src/components/game/QuizButton.vue)はネイティブbuttonのclickからpressを通知し、再生アイコン・BUTTON CHECK表示・チェック切替も担当している。
- [App.vue](../src/App.vue)は開始ゲート・設定・テーマ・横画面警告中の入力を遮断し、iOS用の同期focusを行う。
- [useQuizSession.ts](../src/composables/useQuizSession.ts)経由で[gameManager.ts](../src/services/gameManager.ts)へ渡り、`isButtonEnabled`で最終受理判定を行う。
- READYでBUTTON CHECK OFFなら、PUSHEDを経由せず再生へ進む。この仕様は維持する。
- [settingsStore.ts](../src/stores/settingsStore.ts)には3D表示・モデル選択の保存項目がない。
- [SettingsGeneral.vue](../src/components/dialogs/SettingsGeneral.vue)へ選択項目を追加できる。テーマ設定とは独立させる。

## 組み込み前に解消する点

| 優先度 | 確認した点 | 対応 |
| --- | --- | --- |
| 高 | 現行clickとキットpointerdownで受理時刻とユーザー操作条件が異なる | 初回はclick基準を維持。キャップで開始した操作だけを候補にし、ドラッグ・cancelを除外してclickから同期通知。pointerdown方式への変更は別判断とする |
| 高 | 早稲田式風の押下対象は小キャップのみで、スマホ上の実寸が小さくなる可能性 | 320px幅で画面上の当たり判定を測定。必要なら遮蔽を考慮した許容領域か明示的なDOM操作ボタンを用意。ランプや回転操作が早押しになる拡張は避ける |
| 高 | WebGLRenderer生成失敗は例外、onError通知は主にcontext loss。render例外や初期化途中の後始末は網羅されていない | 初期化・描画・モデル交換の失敗経路を統一し、確保済み資産を解放して2Dへ復帰 |
| 中 | 非表示時にRAFを止めるが、setState／configure等のinvalidateから再予約できる | 非表示中は新規描画も予約せず、復帰時に最新状態と経過時間を反映 |
| 中 | reduced-motionは押し込みの補間にしか効かず、RELEASEDの点滅は継続 | 動きを減らす設定では押し込みを即時反映、点滅を定常点灯に置換し、連続RAFも停止 |
| 中 | contracts.d.tsにblinkPeriodMs、ケース材質、lampColorやview APIの型が揃っていない | TypeScriptへ移植し、実装・設定・モデル契約を一致させる |
| 中 | 外観変更でもモデルを再生成。dispose後の公開メソッド呼び出しへのガードが不足 | 破棄後の処理を無効化。設定UIは頻繁なスライダー更新を持たせず、必要な変更だけ反映 |
| 中 | r128固有のoutputEncodingと明示的な色変換を使用 | 採用版の色管理と照明へ移植し、基準プレビューと両モデルを比較 |
| 中 | 全JSをPWAのprecache対象にしている | importの遅延化だけではSWによる事前取得は減らない。生成物サイズとキャッシュを測定して公開条件にする |

## 初回導入の仕様案

1. 初期値は従来2D。設定を「表示方式: 2D／3D」と、その配下の「ボタンタイプ: 円形／早稲田式風」の2階層にする。ボタンタイプは3D選択時だけ表示し、2Dへ戻しても最後に選んだ3Dタイプを保存する。3Dモデルの色・形・照明はADDONの採用値を維持し、周辺UIだけ既存テーマに従う。
2. 表示設定は内部ではrenderModeとmodelId、固定appearancePresetIdを分離する。保存データにバージョンを持たせ、既存の音声・シーク等の設定を保持して移行する。未知ID・破損値は2Dへ戻す。
3. 表示方式・ボタンタイプの変更はREADY／FINISHEDに限定する。プレイ中の選択UIは無効化して理由を表示する。既存の設定ダイアログの動画停止・解答期限継続ポリシーを維持する。
4. 押下は既存press経路に同期接続し、描画完了・nextTick・importの完了を待たせない。PUSHED／RELEASEDを同期watchで受け、ゲームが受理する前には演出しない。
5. 既存の再生アイコン・BUTTON CHECK切替を維持する。ユーザー指定により3DのPUSH／ON!／WAIT文字とモデル上の文字は追加せず、aria-labelで操作名を提供する。READYのチェックOFF時に押下演出を追加するためのゲーム変更は行わない。
6. ネイティブbuttonと見えるフォーカス表示を残す。canvasは描画・回転を担当し、キーボード／読み上げの操作経路を確保する。グローバルSpaceとの二重通知を防ぐ。
7. Three.js・3D viewは遅延ロードする。準備中・読込失敗・WebGL非対応・context lossは2Dで操作できる。ロード中の切替・unmount後に古いviewを生成しない世代管理を入れる。
8. 一時的な描画失敗ではユーザーの保存済み3D選択を消さず、その表示セッションを2Dへ退避する。再試行は明示操作とし、自動再生成を繰り返さない。

上記は計画上の推奨値。3Dの初期有効化、押下タイミングのpointerdown化、調整用スライダー、JSON入出力、GLB対応は初回対象に含めない。

## WAITの表示（ユーザー承認済み）

現行のWAITは独立したButtonStateではなく、`DISABLED`に対する2Dボタンのラベル。キットにもDISABLED入力と減光処理はあるが、WAITの文字表示はない。ゲーム状態を追加せず、次の表示を採用する。3Dの状態文字はユーザー指定により表示しない。

| ボタン状態 | 3Dの見た目 | 操作 |
| --- | --- | --- |
| STANDBY | 通常位置・通常の素材色・消灯 | 文字なし。READYかつチェックOFFなら再生アイコン。入力可否は既存のisButtonEnabledに従う |
| PUSHED | 受理済み押下の単発アニメーション | 追加押下を受理しない |
| RELEASED | 円形はキャップ、早稲田式風はランプが点滅 | 文字なし。入力不可でも点灯は維持 |
| DISABLED | 可動部を通常位置へ戻し、キャップを減光、点滅停止。早稲田式風はランプも減光・消灯 | 文字なし。早押し操作を無効化 |

WAITは減光・消灯で表現し、追加の文字表示やモーダルは設けない。既存2Dの文字は維持する。3Dにもネイティブbuttonを残し、読み上げ用の操作名を指定する。

WAIT中も台座・余白からの回転は許可する。キャップへの操作は無反応とし、回転へ読み替えない。設定・横画面警告などのモーダル表示中は回転も操作させない。

`isButtonEnabled=false`を一律DISABLEDへ変換してはいけない。受理直後や解答中のRELEASEDまでWAITにすると、解答権取得の点灯が消えるため、表示状態と入力可否を別々に渡す。既存2DのDISABLEDは沈み込み表示だが、3Dはキットの通常位置＋減光を採用する案とする。

## 実装順序と完了条件

### 1. 描画基盤とモデルの移植

- `src/components/game/buzzer3d/`へ型契約、設定、motion、glow、registry、2モデル、viewを移植する。
- キットのpackage.json／lockfile／デモHTMLはアプリへ上書きしない。Three.jsのみアプリの依存へ追加し、必要な型定義と版を揃える。
- 実装時点の安定版を固定して採用候補とし、r128は視覚比較の基準とする。最新版へ番号だけ変更しない。
- 純粋なmotion／glow、モデルの移動・発光・当たり判定対象をVitestへ移植し、型チェックを通す。
- 完了条件: 両モデルの採用姿勢・色・形が比較でき、ゲーム非依存で描画・交換・破棄できる。

### 2. 描画ライフサイクルと障害復帰

- 非表示・reduced-motion・resize・context loss・初期化失敗・disposeの処理を整える。
- 1表示領域につきrendererは1つ。モデル交換時はgeometry／material／textureだけを破棄し、終了時にRAF・observer・イベント・rendererも解放する。
- 失敗したfactoryの部分生成資産も解放できる所有権にする。
- 完了条件: 非表示／静止時に不要なRAFがなく、連続切替・unmountで資産やイベントが増殖しない。

### 3. QuizButtonへの接続

- `Buzzer3DView.vue`をVueアダプターとし、QuizButtonを2D／3Dの表示切替の窓口にする。既存2D表示は必要な範囲で子コンポーネントへ抽出する。
- Appのゲート判定・同期focus・既存press経路を使い、ゲームタイマーは追加しない。
- キャップ操作と回転を識別し、キャンセル・二重入力・フォーカス・回転後の遮蔽を検証する。
- 初期状態をmount直後にも渡す。遅延ロード中にPUSHEDを通過した場合は、最新状態を表示して過去の押下を再受理しない。
- 完了条件: 動画停止・記録・効果音が既存と同じイベント内で発生し、100ms後の解答遷移が演出時間に影響されない。

### 4. 設定・画面レイアウト

- settingsStoreの保存・復元・未知値・旧形式移行を実装し、SettingsGeneralに選択UIを追加する。
- 表示方式→3Dボタンタイプの階層UI、WAITの減光・消灯、再生表示、BUTTON CHECK切替、姿勢リセット操作を整える。
- 固定デモ用のカメラ距離をそのまま使わず、実際のボタン領域へ両モデルを収める。小キャップのタップ領域も同時に検証する。
- 完了条件: 320px幅・既存テーマ・キーボード表示時も欠けず、設定変更と画面復帰で意図したモデルになる。

### 5. 統合検証と公開準備

- Lint、型チェック、全テスト、全ソースのcoverage各指標80%以上、本番・develop向けビルドを実施する。3Dコードを一括coverage除外しない。
- WebGLRendererのみを差し替えた統合テストで接続・障害復帰を検証する。見た目・GPU動作の正しさは実ブラウザで補う。
- 既存方針に従い、恒久的なE2E基盤は追加しない。必要なローカルブラウザ確認とdevelopのHTTPSで手動確認する。
- iOS Safari／Android Chromeで押下→入力欄focus→キーボード、動画停止・音、連打・Space、回転・cancelを確認する。
- リセット／リトライ／Result後復帰、設定・テーマ・横画面警告、タブ切替、PWA更新を確認する。
- JS増分・初回表示・YouTube同時再生時の描画負荷、PWAのprecache上限と更新を確認する。
- 完了条件: 2Dの既存動作を維持し、両3Dモデルで早押しでき、3D失敗時にも遊べる。実機未確認を完了扱いにしない。

コミットは段階番号ではなく、モデル基盤／描画制御／入力・Vue接続／設定保存・UI／公開文書などの修正範囲で分ける。サブエージェントを増やさず、単体で順に実施する。

## 公開方針

実装後はdevelopへ公開して実機確認し、その結果を受けてmainへ反映する。最初は2Dを既定値として3Dを選択可能にする。問題があれば2Dへ戻せる状態を維持する。依存追加と実装は完了。本番公開・初期表示の3D化は未実施。

## 技術資料

- [Three.js Color Management](https://threejs.org/manual/en/color-management.html): 色入力・出力色空間の移植基準。
- [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html): r163以降はWebGL 1非対応。現行版採用時は2Dフォールバックが必要。
- [Three.js Cleanup](https://threejs.org/manual/en/cleanup.html): GPU資産はgeometry／material／texture等の明示的解放が必要。

## 実装・検証結果（2026-09-14）

- Three.js / @types/threeを0.186.0へ固定。r128の色値・照明強度を現行APIへ移植した。
- キャップの投影位置へ透明なネイティブbuttonを配置。操作領域は最低44pxで、手前の遮蔽物をRaycasterで除外する。台座・余白はポインター捕捉による回転専用。
- 3Dの文字表示なし。再生三角形、向きを戻すアイコン、読み上げ用操作名を提供する。
- 615テスト成功。coverage: Statements 91.48% / Branches 84.96% / Functions 91.96% / Lines 93.86%。型チェック・Lint・両環境のビルド成功。
- ローカルChromiumで両モデル・押下・WAIT・320px幅・context loss後の2D復帰を確認。実際のAppはYouTubeを模擬し、設定階層・モーダル中の操作遮断を確認。
- 3Dチャンクは約534KB（gzip約136KB）。初期JSとは分離するが、PWAでは事前キャッシュする。precache合計は約2MBで、ビルド成功。Viteの500KBチャンク警告は残る。
- npm auditで見つかった既存の開発依存を互換範囲で更新し、オンライン監査0件。
- 実YouTube・iOS/Androidのタッチ／キーボード／読み上げ・実端末GPU負荷・HTTPSのPWA更新は未確認。描画モックやソフトウェアWebGLの成功を実機確認の代用にしない。
