# Tasks

**次のタスク: Phase 4（実行順: 27-1 → 22 → 23 → 27-2/3。spec: [improvement/specs/phase4-quality-release.md](improvement/specs/phase4-quality-release.md)。25/26 は後回し）**

> Phase 1〜2（Task 1〜18-3）は完了済み → [tasks-archive.md](tasks-archive.md)
> 本リストは [docs/improvement/04-task-replan.md](improvement/04-task-replan.md)（2026-06-12 決定反映済み）に基づく。着手時は本ファイルを正とする。
> 実行ルール・実行体制（モデルルーティング）は [docs/improvement/00-overview.md](improvement/00-overview.md) を参照。

## フェーズ依存関係

```
Phase R (R-0〜R-9) ──┬─→ Phase 3 (機能完成) ──→ Phase 4 (品質・リリース)
                     └─→ Phase D (デザイン改善)   ※Phase 3 と並行可
```

---

## Phase R: リファクタリング（詳細: [improvement/02-refactoring-plan.md](improvement/02-refactoring-plan.md)）

挙動・仕様は変更しない（behavior-preserving）。各タスクの完了条件は共通して「`npm run test` 全件パス + `npm run type-check` パス + `npm run lint` パス」。

- [x] R-0. 安全網確認 + gameStore.test.ts の stores/__tests__ 移動 + ルール修正
  - test / type-check / lint の現状パスを記録、`vitest --coverage` でカバレッジ現状値を記録（docs/improvement/coverage-baseline.md）
  - `src/services/__tests__/gameStore.test.ts` → `src/stores/__tests__/` へ移動
  - `.claude/rules/pinia-store.md` / `vitest-test.md` の記述同期（C-2 連動）
- [x] R-1. 残骸削除（counter.ts / .gitkeep / TimeManager 未使用 API）+ package.json name を `youtube-quiz-battle` に変更（base.css / logo.svg は既に存在せず）
- [x] R-2. マジックナンバー定数化 + YouTubePlayerState enum 徹底 + modestbranding 削除
- [x] R-3. logger 導入 + console.* 置換（41 箇所）+ eslint no-console
- [x] R-4. gameStore 直接変更の排除（setButtonState / resetAnswerTime / decrementAnswerTime / setCurrentQuestionIndex）
- [x] R-5. 時間更新ループ一本化（useGameLoop composable）+ destroy 系リーク修正（手動動作確認は R-6 完了時にまとめて実施）
- [x] R-6. GameManager 3 分割（thresholdEngine / externalPauseController / answerFlowController）。既存テスト無修正パスが条件（184件パス・無修正で達成。手動動作確認済み 2026-07-03、リプレイ挙動のバグ 2 件を発見し修正済み）
- [x] R-7. コンポーネント整理（ButtonState 型統一 / props バケツリレー解消）
- [x] R-9. 解答送信の遷移責務一元化（WAITING→REVEALING ちらつき解消）※R-6 後
- ※ R-8（デザイントークン）は Phase D-1 に統合済み

## Phase 3: 機能完成

### 音声

- [x] 19-0. 効果音素材の準備（新規）
  - 2026-07-03 ユーザー用意の素材を `public/assets/sounds/quiz-sounds.mp3` に配置
  - スプライト実測: button 0–2s / correct 3–5s / incorrect 6–8s（design.md の定義を実ファイルに同期済み）
  - 原本（wav/aac/mp3）は src/assets/sounds_3.* に保持（ビルド対象外）
- [x] 19. 音声管理システムの実装（旧: 19）
  - `src/services/audioManager.ts`。Web Audio API + HTML Audio フォールバック
  - 新規再生時に前の効果音を停止 / fire-and-forget（状態遷移は再生を待たない）
  - 再生トリガ: ボタン押下 / ボタンチェック完了 / 正解 / 不正解（answerFlowController から呼ぶ）
  - SettingsModal の ON/OFF・5 段階音量と接続。音量状態は App.vue のローカル ref から settingsStore（新規 Pinia ストア）へ移管し、LocalStorage 永続化
- [x] 19-2. 音声システムのテスト実装（旧: 19-2）
  - AudioContext / HTMLAudio をモックし、再生・停止・音量・ON/OFF・フォールバック分岐を検証
- [x] 19-3. 設定画面から disableSeekbar を切り替え可能にする（新規・2026-07-03 ユーザー要望）
  - SettingsModal にシーク許可トグルを追加し、settingsStore（Task 19 で新設）で管理・LocalStorage 永続化
  - クイズデータの settings.disableSeekbar はデフォルト値とし、ユーザー設定があれば優先する（優先順位は実装時に design へ追記）
  - 実装タイミングは Task 19 完了後の任意時点でよい
- [x] 19-4. ボタンチェック演出の ON/OFF 設定（新規・2026-07-03 ユーザー要望）
  - settingsStore.buttonCheckEnabled（既定 true・LocalStorage 永続化）+ SettingsModal トグル
  - OFF: READY のボタンは演出・効果音なしの再生ボタン（白い右向き三角形の Face）として動作し、押下で即 TALKING + 再生開始（以降は通常仕様どおり WAIT 等の表示）

### エラーハンドリング

- [x] 20. エラーハンドリングシステムの実装（旧: 20）
  - `src/services/errorHandler.ts` + ErrorDialog 連携
  - エラーコード（QUIZ_DATA_NOT_FOUND 等）→ design 定義の ERROR_MESSAGES への変換（現状はコードが生表示。D-6）
  - YouTube onError / 音声読み込み失敗 / fetch 失敗の分類、復旧可能エラーの自動リトライ（回数上限つき）、復旧不可は再読み込み誘導
- [x] 20-2. エラーシナリオのテスト実装（旧: 20-2）
- [x] 20-3. 画面向き検出と OrientationDialog の接続（新規・Requirement 2.2）
  - 現状 OrientationDialog はコンポーネントのみ存在し、表示トリガが未実装（`isOrientationOpen` が恒久 false）
  - `matchMedia('(orientation: landscape)')` + モバイル判定で表示制御。PC は対象外
  - 横画面中のゲーム進行の扱い（External Pause にするか否か）を design に追記して実装
- [x] 20-4. hideVideoPlayerDuringAnswer の実装（新規・設計済み未実装。D-4）
  - settings.hideVideoPlayerDuringAnswer=true かつ ANSWERING のとき VideoPlayer を非表示（DOM は保持し visibility/height 制御。iframe 破棄はしない — プレイヤー状態を失うため）
  - WAITING/REVEALING 遷移時に復帰。テスト追加

### 解答判定の完成（Requirement 4 達成ポイント）

- [x] 21. 解答検証システムの拡張（旧: 21）
  - NFKC → casefold → trim → 日本語処理（半角カナ→全角、ひらがな→カタカナ、長音統一）→ 数字幅統一のパイプライン
  - 既定 ON に切り替え（Phase 2 の完全一致は normalize=false で温存）
- [x] 21-2. 拡張機能のテスト実装（旧: 21-2）
  - 表記揺れマトリクステスト（ひらがな/カタカナ/半角カナ/全角英数/前後空白/長音異体）
- [x] 21-3. リトライ時の不正解フィードバック表示（新規・2026-07-03 ユーザー要望・仕様変更）
  - 現状: 残り回数がある不正解では answerResult を null に戻すため「不正解」表示・赤枠フラッシュが出ない
  - 変更: 残り回数があっても不正解判定を表示し（QUESTIONING 復帰後も維持）、次の解答時に結果表示を上書きする
  - データは既に複数解答対応済み（pendingUserAnswers → QuestionResult.userAnswers のリスト）。Result 画面は最後の解答のみ表示（実装済み）で変更不要
  - gameStore.handleAnswerSubmit の answerResult リセット除去 + 関連テスト（「answerResult が null」ケース）の期待値変更を伴う

## Phase D: デザイン改善（詳細: [improvement/05-design-review.md](improvement/05-design-review.md)）

採用デザインは **ケース1**（[assets/wireframe-v2-case1.html](assets/wireframe-v2-case1.html)）。ケース2 は不採用（アーカイブ）。

- [x] D-1. デザイントークン基盤の導入（= 旧 R-8）
  - `wireframe-v2-case1.html` の `:root` トークンを `src/assets/main.css` の `@theme` へ移植
  - 既存コンポーネントの 16 進直書きをトークン参照へ置換（この時点では見た目ほぼ不変）
- [x] D-2. ケース 1 デザインの適用（構成維持・CSS 刷新）※タイマーは①リング採用（2026-07-03）。レビュー・実機確認は下記参照
  - 対象: AppHeader / GameInfo / AnswerContent / GuideText / QuizButton / FinalScore / ResultTable / ResultActions / ダイアログ群
  - 早押しボタンの物理ボタン化（真上視点の円形キャップ + 同心円台座 + LED グロー。沈み込みは縮小 + 内側影 + 減光）
  - スコアボード化: チップ列は直近5問ウィンドウ + 三角ページャ（右端は現在の問題まで）。○/×/スキップ/無解答を一体 SVG アイコンで描画
  - FINISHED はワイヤーフレームのフルスクリーンリザルト（大型スコア + 問題別タイムライン + もう一度プレイ）を適用
  - タイマー表示はワイヤーフレームの 2 案（①リング / ②解答エリア枠メーター）から実装時にユーザーが選択（**未決の判断ポイント**）
  - `prefers-reduced-motion` 対応・`:focus-visible` 維持を必須要件とする
  - mobile-ui-reviewer エージェントでレビュー（360–430px 幅、横スクロールなし、44px タッチターゲット）
- ※ 旧 Task 24（ボタン画像スプライト）は**廃止**。D-2 の CSS 物理ボタンで代替（docs/assets/button.webp は不使用・削除）

## Phase 4: 品質・リリース

実行 spec: [improvement/specs/phase4-quality-release.md](improvement/specs/phase4-quality-release.md)（2026-07-03 作成）。実行順は 27-1（base 対応）→ 22 → 23 → 27-2/3 → 実機確認。ホスティングは暫定 GitHub Pages。25/26 は後回し（着手時に spec 作成）。

- [ ] 22. モバイル最適化（旧: 22）
  - ソフトキーボード対応（visualViewport で ANSWERING 時の入力欄可視性確保）/ タッチ応答 / iOS・Android 実機確認
- [ ] 23. PC 対応の仕上げ（旧: 23）
  - キーボードナビゲーション一巡 / hover・focus 状態の網羅（D-2 で大半は完了している想定の確認タスク）
- [ ] 25. Firebase Analytics 統合（旧: 25）
  - プレイセッション ID（UUID v4）/ quiz_session_completed / question_answered イベント
  - PrivacyInfo 文言と送信内容の整合確認（D-15）
- [ ] 26. E2E テストスイート（旧: 26 + 23-2 統合）
  - Playwright 導入（.mcp.json に playwright あり、依存としては未導入）
  - 通しプレイ / External Pause 復帰 / シーク 2 モード / リプレイ / 視覚回帰（320/375/430px）
  - クロスブラウザ（Chromium / WebKit / Firefox）をここに統合（旧 23-2 を吸収）
- [ ] 27. パフォーマンス最適化とデプロイ準備（旧: 27）
  - バンドル分析 / 静的ホスティング設定 / HTTPS / 本番ビルド検証
