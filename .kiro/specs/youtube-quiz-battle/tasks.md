# Implementation Plan

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

- [ ] 13. 時間管理システムの実装
  - TimeManager の実装
  - 100〜200ms目安（例: 150ms）での動画時間更新機能（setInterval最適化）
  - currentVideoTime と watchedVideoTime の管理
  - シーク検出ロジック（`SEEK_TOLERANCE_SEC = max(0.2, (UPDATE_INTERVAL_MS/1000)*2)` 動的算出）
  - `STARTUP_GRACE_MS`（再生直後の誤検出回避）導入
  - 状態遷移条件判定（shouldTransition関数）
  - _Requirements: 3.1, 3.4_

- [ ] 14. 一回性トリガとExternal Pause Handlingの実装
  - Single-Shot Guard（問題単位のstart/reveal/endフラグ管理）
  - 1ティック内複数閾値走査処理
  - External Pause検出（可視性・プレイヤー状態・再生停滞）
    - 可視性イベント: `visibilitychange` / `pagehide` / `pageshow`
    - プレイヤー状態: `onStateChange(PAUSED/PLAYING)`（内部操作は内部フラグで除外）
  - 一時停止時の時間遷移判定停止
  - UI方針: ANSWERING中は「一時停止中」オーバーレイを表示しない（解答カウントダウン停止のみ）
  - 再開時のシーク検出猶予処理（`RESUME_GRACE_MS ≈ 300ms`の猶予中、シーク検出無効化）
  - 復帰時の同期処理（`watchedVideoTime = currentVideoTime`）
  - _Requirements: 3.1, 3.2, 3.4_

- [ ] 15. ゲーム状態遷移システムの実装
  - 状態遷移ロジックの実装（時間経過起点・アクション起点）
  - OthersAnsweringPeriods処理（区間優先順位・完全包含検証）
  - QUESTIONING/WAITING/REVEALING状態の精密制御
  - `jumpToRevealPeriod`条件: `currentVideoTime < revealTime`のときのみ`seekTo(revealTime)`実行
  - `disableSeekbar=false`のWAITING固定解除: 次のQUIZ開始（`startTime`到達）で解除
  - FINISHED状態への遷移処理
  - 状態遷移イベントの発火とコンポーネント連携
  - _Requirements: 1.2, 1.4, 5.1_

- [ ] 16. 解答検証システムの実装（Phase 2 MVP版）
  - AnswerValidator の基本実装
  - 完全一致判定（正規化なし）
  - 複数正解パターンの対応
  - trim+NFKC正規化の準備（既定OFF）
  - 正誤判定ロジックとスコア管理
  - _Requirements: 4.1, 4.2, 4.4, 4.5_

- [ ] 17. キーボードハンドリングとボタンインタラクション
  - PC環境でのスペースキー早押し対応
  - 入力中の誤操作防止（input/textarea/contentEditable判定）
  - preventDefault()による既定スクロール抑止
  - QuizButtonコンポーネントのクリック・キーボードイベント処理
  - ボタン状態遷移の完全実装
  - _Requirements: 1.2, 2.5_

- [ ] 18. コンポーネント動的化と全体統合
  - 全コンポーネントの状態管理連携
  - ゲーム状態に応じた表示切り替え実装
  - AnswerAreaコンポーネントの解答送信・タイマー機能
  - 解答カウントダウンタイマー責務: GameManagerが所有、ANSWERINGで開始、External Pauseで停止/再開
  - GameInfoコンポーネントの進行状況・スコア表示
  - ResultAreaコンポーネントの結果表示機能
  - ゲーム開始からゲーム終了までの完全フロー実装
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 5.1, 5.2, 5.3, 5.4_

## Phase 3: 高度な機能と最適化

- [ ] 19. 音声管理システムの実装
  - AudioManager の実装
  - Web Audio API を使用した音声スプライト再生
  - HTML Audio フォールバック機能
  - 3種類の効果音（ボタン音、正解音、不正解音）の実装
  - 音声の重複再生制御
  - SettingsModalとの音声設定連携
  - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [ ] 20. エラーハンドリングシステムの実装
  - エラー分類と適切なメッセージ表示
  - YouTube動画・音声ファイル・クイズデータ読み込みエラー対応
  - 復旧可能なエラーの自動リトライ
  - 復旧不可能なエラーのページ再読み込み誘導
  - ErrorDialogコンポーネントとの連携
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 21. 解答検証システムの拡張実装（Phase 3版）
  - 安全な統一パイプラインの実装
  - Unicode正規化（NFKC）・大文字小文字統一・前後空白trim
  - 日本語含有検出（Unicode Property対応・フォールバック）
  - 半角カナ→全角カナ・ひらがな/カタカナ統一
  - 長音記号同形異体統一・数字幅統一
  - _Requirements: 4.3_

- [ ] 22. モバイル最適化とレスポンシブ強化
  - タッチ操作の応答性向上
  - ソフトキーボード対応の画面調整
  - フォントサイズ16px以上・タッチターゲット44px以上の確保
  - 横画面警告ダイアログの動作確認
  - iOS/Android環境での動作検証
  - _Requirements: 2.2, 2.4_

- [ ] 23. PC対応機能の完全実装
  - キーボードナビゲーション対応
  - PC向けUI調整（ホバー効果・フォーカス表示）
  - マウス・タッチ・キーボード操作の統合
  - デスクトップ環境での動作最適化
  - _Requirements: 2.5_

- [ ] 24. 早押しボタン画像スプライト対応
  - 4つの状態に対応した画像スプライトファイルの作成
  - CSSから画像表示への移行
  - SVG対応の検討
  - パフォーマンス最適化
  - _Requirements: なし（拡張機能）_

- [ ] 25. Firebase Analytics統合
  - Firebase Analytics の設定
  - プレイセッションID管理（UUID生成）
  - ゲーム完了イベント・問題解答イベントの送信
  - 匿名データ収集の実装
  - プライバシー配慮の確認
  - _Requirements: なし（追加機能）_

- [ ] 26. 単体テストの実装
  - ゲーム状態遷移ロジックのテスト
    - 遷移境界の包含テスト、Single-Shot Guard（問題単位）テスト
    - `(prev,curr]`窓走査テスト、`SEEK_TOLERANCE_SEC`前後のテスト
    - OthersAnsweringPeriods優先順位テスト、jumpToReveal条件テスト
  - 解答検証システムのテスト（正規化・正誤判定）
  - 時間管理システムのテスト（シーク検出・状態遷移）
  - ユーティリティ関数のテスト
  - コンポーネント単体テスト（@testing-library/vue使用）
  - _Requirements: なし（品質保証）_

- [ ] 27. 統合・E2Eテストの実装
  - YouTube Player統合のテスト
  - 音声システム統合のテスト
  - 完全なゲームフローのE2Eテスト
  - エラーシナリオのテスト（External Pause復帰、シーク検出、データ読み込み失敗）
  - モバイル・PC環境でのクロスブラウザテスト
  - コンポーネント統合テスト（@testing-library/vue使用）
  - _Requirements: なし（品質保証）_

- [ ] 28. パフォーマンス最適化とデプロイ準備
  - 初期読み込み時間の最適化
  - バンドルサイズの最適化
  - メモリ使用量の最適化
  - 本番ビルド設定の最適化
  - 静的アセットの最適化
  - HTTPS対応の確認
  - _Requirements: なし（最適化・デプロイ準備）_
