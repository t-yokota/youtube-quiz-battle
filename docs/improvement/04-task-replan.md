# 04. 実装タスク再計画（docs/tasks.md 置き換え案）

> 本書は `docs/tasks.md` の Phase 3 以降を置き換える再計画案。承認後、tasks.md へ反映する（Phase 1〜2 の完了タスクは `docs/tasks-archive.md` へ移動。D-17 参照）。
> 旧 Task 19〜27 は新番号体系に再配置済み。**旧番号との対応は各タスク末尾の（旧: XX）で示す。**

## 再計画の方針

1. **Phase R（リファクタリング）を音声実装より前に挟む**。理由: GameManager 分割（R-6）・ストアアクション化（R-4）・logger（R-3）は、音声/エラーハンドリング実装が乗る土台そのものを変える。後でやるほど手戻りが大きい
2. **設計済み・未実装の機能（hideVideoPlayerDuringAnswer / 横画面警告）を明示タスク化**。従来は task 表に存在せず実装漏れ状態だった
3. **デザイン改善（Phase D）を独立フェーズ化**する。適用するのは**ケース1（トークン + CSS 刷新）のみ**（ケース2は不採用が確定。2026-06-12）
4. タスクは Wave 順に**自律的に連続実行**する（1 タスク 1 コミット + テストとセットは維持）。仕様判断が必要な点のみユーザーに確認する（2026-06-12 改定。詳細は 00-overview.md の実行ルール）

> **実行spec（2026-07-02 追加）**: R-6 / Phase 3 / Phase D / R-7・R-9 は `docs/improvement/specs/` に実装可能粒度の spec がある。着手時は本書ではなく spec を正とする（索引: 00-overview.md「事前設計済み spec」）。

## フェーズ依存関係

```
Phase R (R-0〜R-9) ──┬─→ Phase 3 (機能完成) ──→ Phase 4 (品質・リリース)
                     └─→ Phase D (デザイン改善)   ※Phase 3 と並行可
```

---

## Phase R: リファクタリング（詳細: [02-refactoring-plan.md](02-refactoring-plan.md)）

- [ ] R-0. 安全網確認 + gameStore.test.ts の stores/__tests__ 移動 + ルール修正
- [ ] R-1. 残骸削除（counter.ts / base.css / logo.svg / .gitkeep / TimeManager 未使用 API）+ package.json name
- [ ] R-2. マジックナンバー定数化 + YouTubePlayerState enum 徹底 + modestbranding 削除
- [ ] R-3. logger 導入 + console.* 置換（42 箇所）+ eslint no-console
- [ ] R-4. gameStore 直接変更の排除（setButtonState / decrementAnswerTime / setCurrentQuestionIndex）
- [ ] R-5. 時間更新ループ一本化（useGameLoop composable）+ destroy 系リーク修正 + 手動動作確認
- [ ] R-6. GameManager 3 分割（thresholdEngine / externalPauseController / answerFlowController）。既存テスト無修正パスが条件
- [ ] R-7. コンポーネント整理（ButtonState 型統一 / props バケツリレー解消）
- [ ] R-9. 解答送信の遷移責務一元化（WAITING→REVEALING ちらつき解消）※R-6 後
- ※ R-8（デザイントークン）は Phase D-1 に統合

## Phase 3: 機能完成

### 音声

- [ ] 19-0. 効果音素材の準備（新規）
  - ボタン音 / 正解音 / 不正解音の素材選定（フリー素材 or 自作）とライセンス確認
  - 音声スプライト `public/assets/sounds/quiz-sounds.mp3` の作成（button: 0–0.5s, correct: 0.5–1.5s, incorrect: 1.5–2.3s）
  - design ドキュメントのスプライト定義と実ファイルの整合確認
- [ ] 19. 音声管理システムの実装（旧: 19）
  - `src/services/audioManager.ts`。Web Audio API + HTML Audio フォールバック
  - 新規再生時に前の効果音を停止 / fire-and-forget（状態遷移は再生を待たない）
  - 再生トリガ: ボタン押下 / ボタンチェック完了 / 正解 / 不正解（answerFlowController から呼ぶ）
  - SettingsModal の ON/OFF・5 段階音量と接続。**音量状態は App.vue のローカル ref から settingsStore（新規 Pinia ストア）へ移管**し、LocalStorage 永続化（design Future Work の前倒し。設定が揮発する現状は UX 欠陥）
- [ ] 19-2. 音声システムのテスト実装（旧: 19-2）
  - AudioContext / HTMLAudio をモックし、再生・停止・音量・ON/OFF・フォールバック分岐を検証

### エラーハンドリング

- [ ] 20. エラーハンドリングシステムの実装（旧: 20）
  - `src/services/errorHandler.ts` + ErrorDialog 連携
  - **エラーコード（QUIZ_DATA_NOT_FOUND 等）→ design 定義の ERROR_MESSAGES への変換**（現状はコードが生表示されている。D-6）
  - YouTube onError / 音声読み込み失敗 / fetch 失敗の分類、復旧可能エラーの自動リトライ（回数上限つき）、復旧不可は再読み込み誘導
- [ ] 20-2. エラーシナリオのテスト実装（旧: 20-2）
- [ ] 20-3. 画面向き検出と OrientationDialog の接続（新規・Requirement 2.2）
  - 現状 OrientationDialog はコンポーネントのみ存在し、表示トリガが未実装（`isOrientationOpen` が恒久 false）
  - `matchMedia('(orientation: landscape)')` + モバイル判定で表示制御。PC は対象外
  - 横画面中のゲーム進行の扱い（External Pause にするか否か）を design に追記して実装
- [ ] 20-4. hideVideoPlayerDuringAnswer の実装（新規・設計済み未実装。D-4）
  - settings.hideVideoPlayerDuringAnswer=true かつ ANSWERING のとき VideoPlayer を非表示（DOM は保持し visibility/height 制御。iframe 破棄はしない — プレイヤー状態を失うため）
  - WAITING/REVEALING 遷移時に復帰。テスト追加

### 解答判定の完成（Requirement 4 達成ポイント）

- [ ] 21. 解答検証システムの拡張（旧: 21）
  - NFKC → casefold → trim → 日本語処理（半角カナ→全角、ひらがな→カタカナ、長音統一）→ 数字幅統一のパイプライン
  - 既定 ON に切り替え（Phase 2 の完全一致は normalize=false で温存）
- [ ] 21-2. 拡張機能のテスト実装（旧: 21-2）
  - 表記揺れマトリクステスト（ひらがな/カタカナ/半角カナ/全角英数/前後空白/長音異体）

## Phase D: デザイン改善（詳細: [05-design-review.md](05-design-review.md)）

- [ ] D-1. デザイントークン基盤の導入（= 旧 R-8）
  - `wireframe-v2-case1.html` の `:root` トークンを `src/assets/main.css` の `@theme` へ移植
  - 既存コンポーネントの 16 進直書きをトークン参照へ置換（この時点では見た目ほぼ不変）
- [ ] D-2. ケース 1 デザインの適用（構成維持・CSS 刷新）
  - 対象: AppHeader / GameInfo / AnswerContent / GuideText / QuizButton / FinalScore / ResultTable / ResultActions / ダイアログ群
  - 早押しボタンの物理ボタン化（真上視点の円形キャップ + 同心円台座 + LED グロー。押下の沈み込みは縮小 + 内側影 + 減光）
  - スコアボード化: チップ列は直近5問のスライディングウィンドウ + 三角ページャ（右端は現在の問題まで）。○/×/スキップ/無解答を一体 SVG アイコンで描画
  - FINISHED はワイヤーフレームのフルスクリーンリザルト（大型スコア + 問題別タイムライン + もう一度プレイ）を適用
  - タイマー表示はワイヤーフレームの 2 案（①リング / ②解答エリア枠メーター）から実装時にユーザーが選択（未決の判断ポイント）
  - `prefers-reduced-motion` 対応・`:focus-visible` 維持を必須要件とする
  - mobile-ui-reviewer エージェントでレビュー（360–430px 幅、横スクロールなし、44px タッチターゲット）
- ※ ケース2（構造変更）は**不採用が確定**（2026-06-12）。wireframe-v2-case2.html はアーカイブ参考資料として保持し、タスク化しない
- ※ 旧 Task 24（ボタン画像スプライト）は**廃止確定**。D-2 の物理ボタン CSS 表現で代替する。docs/assets/button.webp は不使用・削除（D-14 決定済み）

## Phase 4: 品質・リリース

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

---

## tasks.md 反映時の注意

- 冒頭の「次のタスク」を `R-0` に変更する
- 旧 Task 19〜27 のセクションは本書の新定義で置き換える（旧 24 は廃止確定。Phase D に注記を残す）
- Phase 1〜2 は `docs/tasks-archive.md` へ移動し、tasks.md 冒頭にアーカイブへのリンクを置く
- 各タスク着手時は本書ではなく tasks.md を正とする（本書は計画のスナップショット）
