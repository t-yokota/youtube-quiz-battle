# Tasks

**次のタスク: 18（コンポーネント動的化と全体統合）**

---

## Phase 1: UI基盤とコンポーネント実装

- [x] 1. プロジェクト初期設定とビルド環境構築
  - Vue 3 + TypeScript + Vite プロジェクトの作成
  - Tailwind CSS の設定
  - ESLint/Prettier の設定
  - 基本的なディレクトリ構造の作成
  - _Requirements: 8.1_

- [x] 2. Tailwind CSS設定の修正と基本レイアウト
  - Tailwind CSS v4設定の修正
  - 基本的な垂直配置レイアウトの構築
  - 縦画面専用レスポンシブレイアウトの実装
  - _Requirements: 2.1, 2.2_

- [x] 3. Headerコンポーネントの実装
  - Header コンポーネントの作成（タイトル表示）
  - 設定ボタン（歯車アイコン）の配置
  - 青色背景 (#2563eb) の適用
  - レスポンシブデザインの適用
  - _Requirements: 2.1_

- [x] 4. VideoPlayerエリアの実装
  - VideoPlayer コンポーネントの作成（プレースホルダー版）
  - 16:9アスペクト比の維持
  - レスポンシブサイズ調整
  - 状態による表示制御の準備
  - _Requirements: 1.1_

- [x] 5. GameInfoコンポーネントの実装
  - ProgressDisplay サブコンポーネント（問題番号表示）
  - ScoreDisplay サブコンポーネント（正解・不正解数表示）
  - レスポンシブレイアウトの適用
  - _Requirements: 5.1, 5.4_

- [x] 6. AnswerAreaコンポーネントの実装
  - GuideText サブコンポーネント（LOADING/READY/TALKING状態用）
  - AnswerContent サブコンポーネント（QUESTIONING/ANSWERING/WAITING/REVEALING状態用）
  - AnswerMeta サブコンポーネント（残り回数・タイマー・結果表示）
  - AnswerInput サブコンポーネント（テキスト入力・送信ボタン）
  - 状態に応じた表示切り替えの準備
  - _Requirements: 1.3, 5.2_

- [x] 7. QuizButtonコンポーネントの実装
  - 4つの状態（STANDBY/PUSHED/RELEASED/DISABLED）のスタイル実装
  - レスポンシブサイズ計算（4:3比率維持）
  - 余剰スペース最大活用の計算ロジック
  - 最小サイズ制約の設定
  - _Requirements: 1.2, 2.3_

- [x] 8. ResultAreaコンポーネントの実装
  - FinalScore サブコンポーネント（最終スコア表示）
  - ResultTable サブコンポーネント（個別結果表・基本構成と簡略版）
  - ActionButtons サブコンポーネント（再プレイボタン）
  - レスポンシブテーブル表示の実装
  - _Requirements: 1.5_

- [x] 9. SettingsModalとDialogSystemの実装
  - SettingsModal コンポーネント（オーバーレイ表示）
  - AudioSettings サブコンポーネント（音声ON/OFF・5段階音量調整）
  - PrivacyInfo サブコンポーネント（データ収集説明）
  - LoadingDialog・OrientationDialog・ErrorDialog の実装
  - モーダル・ダイアログの表示制御システム
  - _Requirements: 6.4, 7.1, 7.5_

## Phase 2: 状態管理とゲームロジック

- [x] 10. 状態管理システムの構築
  - Pinia ストアの設定
  - ゲーム状態（GAME_STATE）の定義と管理
  - ボタン状態（BUTTON_STATE）の定義と管理
  - アプリケーション状態（AppState）の実装
  - 状態変更の監視とリアクティブ更新
  - _Requirements: 1.1, 5.1_

- [x] 11. クイズデータ管理システムの実装
  - QuizData・QuizQuestion・QuizSettings インターフェースの実装
  - URL パラメータからvideoId抽出機能
  - JSON データファイル読み込み機能
  - データ検証機能（必須フィールド・時間データ妥当性・OthersAnsweringPeriods検証）
  - エラーハンドリングとフォールバック処理
  - _Requirements: 8.1, 8.2, 8.5_

- [x] 12. YouTube Player統合の実装
  - YouTube IFrame API の動的読み込み
  - YouTubePlayerManager インターフェースの実装
  - PlayerVars設定（Strict/Debugプロファイル対応）
    - 固定設定: `disablekb=1`（常時）/ `fs=0`（常時）/ `playsinline=1`（常時）
    - 推奨設定: `origin: window.location.origin` 指定、`host: 'https://www.youtube-nocookie.com'`
    - プロファイル選択は初期化時のみ。本番はStrict固定でランタイム切替なし
  - YouTubePlayerState enum（-1/0/1/2/3/5）導入と型安全な状態処理
  - 基本的なプレイヤー制御機能（再生、一時停止、シーク）
  - プレイヤー状態取得とイベント処理
  - VideoPlayerコンポーネントとの統合
  - _Requirements: 1.1, 1.2_

- [x] 13. 時間管理システムの実装
  - TimeManager の実装
  - 100〜200ms目安（例: 150ms）での動画時間更新機能（setInterval最適化）
  - currentVideoTime と watchedVideoTime の管理
  - シーク検出ロジック（`SEEK_TOLERANCE_SEC = max(0.2, (UPDATE_INTERVAL_MS/1000)*2)` 動的算出）
  - `STARTUP_GRACE_MS`（再生直後の誤検出回避）導入
  - 状態遷移条件判定（shouldTransition関数）
  - _Requirements: 3.1, 3.4_

- [x] 14. External Pause Handlingの実装
  - External Pause検出
    - 可視性変化: `visibilitychange` / `pagehide` / `pageshow`（全状態で有効）
    - プレイヤー状態: `onStateChange(PAUSED/PLAYING)`（内部操作は内部フラグで除外、全状態で有効）
    - 再生停滞: TimeUpdate内で `wallDelta` と `videoDelta` を比較（動画再生中のみ、ANSWERING中は無関係）
  - 検出時の処理
    - `player.pauseVideo()` で動画を明示的に停止（ANSWERING中は既に停止済み）
    - GameManager内のexternalPausedフラグ管理
  - 再開時の処理
    - `player.playVideo()` で動画を再開（ANSWERING中はカウントダウン再開のみ）
  - タブ切り替えテストで動作確認
    - シーク誤検出が発生する場合、猶予処理（`RESUME_GRACE_MS ≈ 300ms`）を追加
    - 発生しなければ猶予処理は不要
  - UI方針
    - ANSWERING以外: 「一時停止中」オーバーレイを表示
    - ANSWERING中: オーバーレイ表示なし（カウントダウン停止・再開はTask 18で実装）
  - _Requirements: 3.1, 3.2, 3.4_

---

**【仕様変更の注意】**
Task 13〜14の記述は、当初設計の`watchedVideoTime`ベース（最大視聴地点を記録）のアプローチを反映しているが、実装過程で以下の仕様変更を実施した。

- **シーク検出方式の変更**: `watchedVideoTime` → `previousVideoTime`（直前の再生位置を記録）に変更
- **最大視聴地点の判別方法**: `watchedVideoTime`ではなく、`consumed`フラグ（問題単位のstart/reveal/endフラグ）で判別
- **ロジック変更による変数の変更** シーク検出の閾値(`SEEK_TOLERANCE_SEC`)を1秒に固定、タブ切り替え時のシーク検出の猶予期間(`RESUME_GRACE_MS`)を削除

Task 15以降は、変更後の`previousVideoTime`ベースの仕様を前提としている。
詳細は`design.md`の「2. Time Management（時間管理）」セクションを参照。

---

- [x] 15. ゲーム状態遷移システムの実装
  - Single-Shot Guard（問題単位のstart/reveal/endフラグ管理）
  - 1ティック内複数閾値走査処理（`(prev, curr]` 窓での処理）
  - 状態遷移ロジックの実装（時間経過起点・アクション起点）
  - OthersAnsweringPeriods処理（区間優先順位・完全包含検証）
  - QUESTIONING/WAITING/REVEALING状態の精密制御
  - `jumpToRevealPeriod`条件: `currentVideoTime < revealTime`のときのみ`seekTo(revealTime)`実行
  - `disableSeekbar=false`のWAITING固定解除: 次のQUIZ開始（`startTime`到達）で解除
  - FINISHED状態への遷移処理
  - FINISHED状態の固定（シークバー操作で変化なし、resetGame()でのみ解除）
  - 状態遷移イベントの発火とコンポーネント連携
  - _Requirements: 1.2, 1.4, 5.1_

---

### [x] 15-2. ゲーム状態遷移ロジックのテスト実装

**目的**: Task 15で実装したゲームコアロジックの品質保証

**前提条件**: Task 15 完了済み ✅

**実装対象ファイル**:
- `src/services/timeManager.ts` → `src/services/timeManager.test.ts`
- `src/services/gameManager.ts` → `src/services/gameManager.test.ts`

**まず必要な作業**: Vitestを導入する（テストフレームワーク未導入）

**完了の定義**:
- [x] `npm test` が全件パス
- [x] `isSeekDetected` の境界値（閾値前後）をカバー
- [x] Single-Shot Guard（`consumed`フラグ）の一回性を検証
- [x] `(prev, curr]` 窓での複数閾値走査（`applyThresholds`）をテスト
- [x] QUESTIONING/WAITING/REVEALING/FINISHED 状態遷移の正確性をテスト
- [x] FINISHED状態の固定（resetGame()でのみ解除）をテスト
- [x] External Pause（可視性変化・再生停滞検出）のテスト

**設計上の注意**:
- シーク閾値は `SEEK_TOLERANCE_SEC = 1秒固定`（当初の動的算出から変更済み）
- `watchedVideoTime` ではなく `previousVideoTime`（直前の再生位置）ベース
- `RESUME_GRACE_MS` は削除済み（タブ切り替え時のシーク誤検出が発生しなかったため）
- 詳細設計: [design.md - Seek Detection via previousVideoTime](design.md#seek-detection-via-previousvideotime)

---

### [x] 15-3. App/storeの最小統合

**目的**: 表示確認用の固定UIをstore駆動に切り替え、Task 16以降の解答判定・キーボード対応・全体統合を載せる土台を作る

**前提条件**: Task 15-2 完了済み ✅

**実装対象ファイル**:
- `src/App.vue`
- `src/components/common/VideoPlayer.vue`
- `src/stores/gameStore.ts`

**完了の定義**:
- [x] Appが固定propsではなくgameStoreの状態を参照してGamePanelを描画する
- [x] AppがgameStoreの状態を参照してQuizButtonの表示・状態を切り替える
- [x] QuizButton押下がGameManager.handleButtonPress()に接続される
- [x] GamePanelの入力更新と送信がgameStore.updateAnswerInput() / handleAnswerSubmit()に接続される
- [x] VideoPlayer初期化完了時にquizDataをgameStoreに設定し、READY状態へ遷移できる
- [x] クイズデータ読み込みがURLパラメータ優先、未指定時はsampleフォールバックで動作する
- [x] LOADING / READY / TALKING / QUESTIONINGの表示差分がApp上で確認できる
- [x] ダミー結果データと表示確認用の固定propsがAppから除去される

**設計上の注意**:
- design.mdの呼び出しフロー（App → GameManager → playerManager）に従い、AppがGameManagerインスタンスを保持する。QuizButtonのpressイベントはAppが中継してGameManager.handleButtonPress()を呼ぶ
- 現在VideoPlayer.vueのローカル変数に閉じているplayerManager/GameManagerの参照を、Appが保持する形に移動する
- gameStore.handleButtonPress()内の動画再生開始/一時停止のTODOはGameManager側の実装に置き換える
- 正誤判定ロジックの中身はTask 16で実装する。このタスクでは判定処理は実装しない
- スペースキー対応はTask 17で実装する
- ResultAreaの完全表示、再プレイ、ANSWERING中のカウントダウン制御はTask 18で実装する

---

### [x] 16. 解答検証システムの実装（Phase 2 MVP版）

**目的**: 早押しボタン押下後の解答正誤判定

**前提条件**: Task 15 完了済み ✅

**実装対象ファイル**:
- `src/services/answerValidator.ts`（新規）
- `src/stores/gameStore.ts`（スコア管理に連携）

**完了の定義**:
- [x] `AnswerValidator` インターフェース実装
- [x] 完全一致判定（正規化なし）が動作する
- [x] 複数正解パターン（配列）に対応
- [x] trim + NFKC 正規化を内部で用意（既定OFF）
- [x] 正誤判定結果がスコアに反映される

**設計上の注意**:
- Phase 2 MVP は「正規化なし + 完全一致」のみ。全角半角・仮名揺れ対応は Phase 3（Task 21）
- Requirement 4 の AC（4.1〜4.4）は Phase 3 完了で初めて達成される
- インターフェース: `validate(userInput: string, correctAnswers: string[]): boolean`

---

### [x] 16-2. 解答検証システムのテスト実装

**前提条件**: Task 16 完了後

**完了の定義**:
- [x] 完全一致判定のテスト
- [x] 複数正解パターンのテスト
- [x] スコア管理との連携テスト

---

### [x] 17. キーボードハンドリングとボタンインタラクション

**目的**: PC環境でのスペースキー早押し対応とボタン状態の完全実装

**前提条件**: Task 15 完了済み ✅

**実装対象ファイル**:
- `src/components/game/QuizButton.vue`
- `src/App.vue`（グローバルキーボードイベント）

**完了の定義**:
- [x] スペースキーで早押しボタンが押下できる
- [x] `input`/`textarea`/`contentEditable` 入力中は誤操作防止で無効化
- [x] `preventDefault()` でスペースキーによるスクロールを抑止
- [x] ボタン状態遷移（STANDBY → PUSHED → RELEASED → DISABLED）が完全動作
- [x] PC環境でのキーボードとクリック操作が統合されている

---

### [x] 17-2. キーボード・ボタン操作のテスト実装

**前提条件**: Task 17 完了後

**完了の定義**:
- [x] スペースキー早押しのテスト（shouldHandleSpaceKey 分岐網羅）
- [x] 入力中の誤操作防止テスト（input/textarea/contentEditable/button/a/select）
- [x] ボタン押下時の状態遷移テスト（GameManager.handleButtonPress: PUSHED→RELEASED→分岐）

---

### [ ] 18. コンポーネント動的化と全体統合

**目的**: 全コンポーネントを状態管理と連携させ、ゲーム開始〜終了の完全フローを実現

**前提条件**: Task 15-3, 16, 17 完了後

**実装対象ファイル**:
- `src/App.vue`
- `src/components/game/GamePanel.vue`、`AnswerContent.vue`、`GameInfo.vue`
- `src/components/result/`（全コンポーネント）

**完了の定義**:
- [ ] ゲーム状態に応じた全コンポーネントの表示切り替えが動作する
- [ ] 解答カウントダウンタイマーが ANSWERING で開始・External Pause で停止/再開する
- [ ] 解答送信フローが完成（入力 → 判定 → 結果表示 → 動画再開）
- [ ] GameInfo（問題番号・スコア）がリアルタイム更新される
- [ ] ResultArea（FinalScore・ResultTable・ResultActions）が FINISHED 状態で表示される
- [ ] 「もう一度プレイ」ボタンで最初から再プレイできる

**設計上の注意**:
- 解答カウントダウンタイマーの責務は GameManager が所有（コンポーネントではない）
- Result領域に統合コンポーネントはない。FinalScore/ResultTable/ResultActions を App.vue で直接配置
- リセット時は `gameManager.resetGame()` → `gameStore.resetGame()` → 動画を0秒にシーク → 再生開始

---

### [ ] 18-2. 統合テストの実装

**前提条件**: Task 18 完了後

**完了の定義**:
- [ ] 基本的なゲームフローのコンポーネント統合テスト
- [ ] 解答送信フローのテスト
- [ ] タイマー機能のテスト

---

## Phase 3: 高度な機能と最適化

### [ ] 19. 音声管理システムの実装

**実装対象**: `src/services/audioManager.ts`（新規）

**完了の定義**:
- [ ] Web Audio API で音声スプライト再生（フォールバック: HTML Audio）
- [ ] 3種類の効果音: ボタン音（0s）・正解音（0.5s〜）・不正解音（1.5s〜）
- [ ] 新たな効果音再生時は前の音声を停止してから再生
- [ ] SettingsModal の音声ON/OFF・5段階音量と連携

**設計上の注意**:
- 音声スプライトファイル: `/assets/sounds/quiz-sounds.mp3`
- ゲーム状態遷移は音声再生終了を待たない（fire-and-forget）

---

### [ ] 19-2. 音声システムのテスト実装

---

### [ ] 20. エラーハンドリングシステムの実装

**実装対象**: `src/services/errorHandler.ts`（新規）+ `ErrorDialog.vue` 連携

**完了の定義**:
- [ ] YouTube動画・音声ファイル・クイズデータ読み込みエラーを分類して表示
- [ ] 復旧可能なエラーの自動リトライ
- [ ] 復旧不可能なエラーで「再読み込み」ボタン表示（`location.reload()`）

---

### [ ] 20-2. エラーシナリオのテスト実装

---

### [ ] 21. 解答検証システムの拡張実装（Phase 3版）

**目的**: Requirement 4 の完全達成（全角半角・大小文字・仮名揺れ対応）

**完了の定義**:
- [ ] NFKC正規化 → 大文字小文字統一 → trim → 日本語処理パイプライン実装
- [ ] 日本語含有検出（Unicode Property + フォールバック）
- [ ] 半角カナ→全角カナ、ひらがな/カタカナ統一（カタカナへ）
- [ ] 長音記号の同形異体統一（`ー/ｰ/―/－` → `ー`）
- [ ] 数字の幅統一（全角→半角）

---

### [ ] 21-2. 拡張機能のテスト実装

---

### [ ] 22. モバイル最適化とレスポンシブ強化

- タッチ操作の応答性向上、ソフトキーボード対応
- フォントサイズ16px以上・タッチターゲット44px以上
- iOS/Android環境での動作検証

---

### [ ] 23. PC対応機能の完全実装

- キーボードナビゲーション、ホバー効果・フォーカス表示
- マウス・タッチ・キーボード操作の統合

---

### [ ] 23-2. クロスブラウザ・デバイステストの実装

---

### [ ] 24. 早押しボタン画像スプライト対応

- 4状態（STANDBY/PUSHED/RELEASED/DISABLED）の画像スプライト
- CSSスタイルから画像表示へ移行（SVG検討）

---

### [ ] 25. Firebase Analytics統合

- プレイセッションID管理（UUID）
- ゲーム完了・問題解答イベントの匿名送信

---

### [ ] 26. 完全なE2Eテストスイートの実装

- YouTube Player統合・音声システム統合の完全テスト
- 複雑なシナリオ（External Pause復帰、連続シーク、エッジケース）

---

### [ ] 27. パフォーマンス最適化とデプロイ準備

- バンドルサイズ・初期読み込み・メモリ使用量の最適化
- 本番ビルド設定、HTTPS対応確認
