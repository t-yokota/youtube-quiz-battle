# design.md 内容監査（2026-07-07）

> 4 並列の読み取り専用監査エージェント（Explore）による docs/design.md vs 実装の全数突き合わせ結果。
> design.md 最新化の入力資料。**すべての項目で「実装が正」**（実装バグの疑いは末尾の別枠に隔離）。
> design.md の行番号は監査時点（2283 行版）のもの。

## 更新方針（Designer 裁定）

1. design.md は「現在の設計」を記述する文書とする。実装済みの現実に合わせて書き換え、
   未実装の構想は Future Work 節へ移すか削除する
2. タイミング等の数値は `src/constants/timing.ts` 等の**定数名を正**として記述し、
   値を併記する場合は「2026-07-07 時点」と明示する（将来のチューニングでの再乖離を抑える）
3. 消化済みタスク番号への言及（「Task 20-4 で実装予定」等）は削除する
4. 疑似コード・フローチャートは実装の分岐に合わせて修正する
5. 実装バグの疑い（末尾別枠）は design.md には反映しない（コード修正の判断は別途）

---

## 監査 1: 状態・時間管理（design.md L118-875）

### 乖離一覧

| # | design.md の記述（行） | 実装の現状（ファイル:行） | 分類 |
|---|---|---|---|
| 1 | L258 / L277 / L290「RELEASED → STANDBY は 1500ms 後」 | `BUTTON_CHECK_RELEASE_MS = 1800`（timing.ts:52、gameManager.ts:238） | 数値乖離 |
| 2 | L291「1500ms後 → TALKING に遷移（動画再生開始）」＝遷移と同時に再生 | TALKING 遷移は 1800ms 後、再生はさらに `VIDEO_START_DELAY_MS = 1200` 後（gameManager.ts:224-237）。遅延中に externalPaused か state≠TALKING なら再生しない | 数値+挙動乖離 |
| 3 | L714-723「External Pause 中は時間更新を完全にスキップ」 | `shouldSkipTimeUpdate()` は `externalPaused && reason !== 'user'`。user 一時停止中はシーク検出のため通す（externalPauseController.ts:89-91） | 挙動乖離 |
| 4 | L442「disableSeekbar=true のときのみ強制リセット」 | ANSWERING 中は disableSeekbar の値に関係なく強制リセット（gameManager.ts:345） | doc に無い |
| 5 | L588 / L852 強制リセットは `seekTo(previousVideoTime)` のみ | 加えて currentVideoTime も prev に巻き戻す（gameManager.ts:349） | doc に無い |
| 6 | L591-598 フローチャート: シーク時「WAITING へ遷移」の 1 分岐 | 実装は 3 分岐（FINISHED / WAITING / TALKING）（thresholdEngine.ts:84-102）。本文 L442 は 3 分岐で、フローチャートのみ陳腐化 | doc 内部矛盾 |
| 7 | L442・L591 シーク消費時は「consumed + 状態遷移」だけ | 消費と同時に `recordSkippedQuestion(...,true)` で結果記録（thresholdEngine.ts:63,78）+ `initializeForQuestion()` で解答 UI クリア（:106） | doc に無い |
| 8 | L520-530 recordSkippedQuestion: userAnswers 常に `[]`、skipped は引数のまま | 現在問題なら `pendingUserAnswers` を引き継ぎ、`skipped = isSkip && !hasAttempted`（thresholdEngine.ts:277-299） | 挙動乖離 |
| 9 | L454-503 applyThresholds: recordSkippedQuestion は start 閾値の消費済み分岐のみ | `onReveal`（:328）と `onEnd`（:342）でも呼ぶ = REVEALING 開始時に未確定結果を確定記録 | doc に無い |
| 10 | L554 `const isLast = q.index >= questions.length`（常に false になる誤り） | `lastQuestion.index` との一致比較で FINISHED/TALKING 分岐（thresholdEngine.ts:344-352） | doc の誤り |
| 11 | L467（1 引数）と L520（2 引数）の recordSkippedQuestion 不一致 | 実装は常に 2 引数 | doc 内部矛盾 |
| 12 | L358-360「othersAnsweringPeriods は消費済み問題では実質無意味」 | consumed を見ずに period 終了で無条件 QUESTIONING 復帰（thresholdEngine.ts:211-220）→ 実装バグ疑い（別枠 B-2） | 挙動乖離 |
| 13 | L164/L170「WAITING（そのまま動画再開）」 | jumpToRevealPeriod=true かつ currentVideoTime >= revealTime では WAITING 遷移するが playVideo しない（answerFlowController.ts:132-140）→ 実装バグ疑い（別枠 B-1） | 挙動乖離 |
| 14 | L172-173「解答制限時間終了 → 強制正誤判定」 | 入力途中の文字列を `submissionType='timeout'` で送信して判定（answerFlowController.ts:93-102） | doc に無い |
| 15 | L678-770 External Pause reason は 3 種 | `'orientation'` を含む 4 種（externalPauseController.ts:31,97,187-195） | doc に無い |
| 16 | L1549「pauseExternal('orientation') を呼ぶ」 | `pauseExternalForOrientation()`（PLAYING or ANSWERING のときだけ pause するガード付き） | 挙動乖離 |
| 17 | L733-737 visibilitychange(hidden): PLAYING のときだけ pause | PLAYING **または** ANSWERING（externalPauseController.ts:215-221） | 挙動乖離 |
| 18 | L747-752 pagehide: PLAYING のみ | PLAYING または ANSWERING（:231-242） | 挙動乖離 |
| 19 | L762-765 PAUSED: internalAction 以外は常に pauseExternal('user') | ANSWERING 中と READY 中は無視するガードあり（:283-290） | doc に無い |
| 20 | L766-768 PLAYING: externalPaused なら resume するだけ | (a) ANSWERING → 即 pauseVideo、(b) READY + gate warmup 窓 → 無視、(c) READY + readyPlaySuppress 窓 → pauseVideo、(d) READY → TALKING 遷移（プレイヤー直接再生でゲーム開始）（:293-322）。(d) は遷移図にも無い | doc に無い |
| 21 | （記述なし） | ENDED → External Pause 解除 + `finalizeAtVideoEnd()` で残問題全消費・FINISHED 確定（:268-279、thresholdEngine.ts:148-152） | doc に無い |
| 22 | L700「『一時停止中』オーバーレイを表示」 | 該当 UI は未実装（isExternalPaused() の UI 利用ゼロ）→ doc から削除 or Future Work | doc のみ |
| 23 | L704「playVideo() で再開」 | ANSWERING 中は playVideo せず resumeAnswerCountdown() のみ（:174-178） | doc に無い |
| 24 | L814-825「Task 18 での改善予定」 | 実装済み: `resetUnansweredConsumed()` + skipped 結果の `removeResult()` 削除（thresholdEngine.ts:124-140） | doc 陳腐化 |
| 25 | L640-644 STARTUP_GRACE 中も stall 基準値を更新 | grace 中は即 return し基準値を更新しない（useGameLoop.ts:34-36） | 挙動乖離（軽微） |
| 26 | L624「全 start 消費済み＆未消費 end なしなら強制 FINISHED（ソフトロック防止）」 | 該当ロジックなし。FINISHED 化は end 消費 / consumeQuestionsBySeek / ENDED finalize のみ | doc のみ |
| 27 | L539 initializeForQuestion の対象 5 項目 | 加えて pendingTimesUntilPress / pendingSubmissionTypes もリセット（gameStore.ts:304-312） | doc に無い |
| 28 | L143 遷移図: LOADING → READY → [ボタンチェック] → TALKING | (a) 開始ゲート（音声許諾 + warmup）タップ、(b) ボタンチェック OFF 時の即 TALKING+playVideo 経路がある | doc に無い |
| 29 | L194 リプレイ: FINISHED → READY | resetGame は一旦 LOADING → READY。resetPauseState が READY_PLAY_SUPPRESS_MS=1000 の抑止窓を張る | doc に無い |
| 30 | L295「押下 → PUSHED（押下音、動画一時停止）」 | 同期処理内で pauseVideo → recordButtonPress → 効果音の順を固定（gameManager.ts:197-211） | doc に無い |
| 31 | L297 ANSWERING 遷移 | 遷移前に clearAnswerResult / updateAnswerInput('')、遷移後にカウントダウン開始 | doc に無い |
| 32 | L270-282 タイミング表 | BUTTON_CHECK_LABEL_HOLD_MS（=0）による表示層のラベル保持が未記載 | doc に無い |
| 33 | L252-267 ボタン遷移図 | PUSHED はゲーム状態変化の影響を受けない / READY でも DISABLED/RELEASED→STANDBY 昇格 | doc に無い（軽微） |
| 34 | L692「内部操作は internalAction で除外」 | フラグは同期スコープのみ有効。YouTube イベントは非同期到達のため #19/#20 の追加ガードで補完 | 挙動乖離 |
| 35 | L397-401 動的時間変数を一括管理 | TimeManager と ExternalPauseController に分散 | 配置差（軽微） |

### doc に無い新機構（監査 1）

開始ゲート（音声許諾 + priming）/ GATE_WARMUP_PLAY_MS=500 のウォームアップ実再生 / warmupStopTimer と clearWarmupStop の競合解消 / READY_PLAY_SUPPRESS_MS=1000 / ボタンチェック ON/OFF 設定と OFF 時の再生ボタン経路 / VIDEO_START_DELAY_MS=1200 / BUTTON_CHECK_LABEL_HOLD_MS / orientation External Pause + ガード / ENDED 終端確定 finalizeAtVideoEnd / shouldSkipTimeUpdate の user 例外 / ANSWERING 中のシーク強制リセットと PLAYING 即 pause / REVEALING・END 到達時の確定記録 + シーク時 skip 記録 / consumeQuestionsBySeek 後の initializeForQuestion / recordButtonPress・pendingTimesUntilPress・pendingSubmissionTypes / effectiveSettings（debug 上書き）/ FINISHED での updateVideoTime 早期 return

### 一致確認済み（監査 1）

TIME_UPDATE_INTERVAL_MS=150 / SEEK_TOLERANCE_SEC=1.0 / EPS=1e-3 と閾値比較式 / STALL_WALL_MS=1200・STALL_VIDEO_DELTA_SEC=0.05・STARTUP_GRACE_MS=1000 / YOUTUBE_REWIND_THRESHOLD_SEC=5.5 と巻き戻し検出 / BUTTON_PUSHED_DURATION_MS=100 / GameState 8 種・ButtonState 4 種 / 前方シーク重なり判定式 / disableSeekbar 実効値優先順位 / markRevealConsumed の順序 / processTimeWindow 全問走査 / recordResult 重複ガード

---

## 監査 2: コアコンポーネント（design.md L876-1242）

### 乖離一覧（要点）

- **GameManager は 4 分割ファサード**（InternalPlayerControl / ThresholdEngine / AnswerFlowController / ExternalPauseController）だが design.md に一語も登場しない（構造乖離・最大）
- interface に無いメソッド: warmupVideoPlayback / pauseExternalForOrientation / resumeExternalIfReason / setupVisibilityHandlers / setupPlayerStateHandlers / destroy / コンストラクタ 5 引数 + createGameManager ファクトリ
- pauseExternal の reason は 4 値 union（orientation 追加）
- resetGame: answerFlow.stopAnswerCountdown を先頭実行 / 委譲先変更（resetRewindThreshold / thresholdEngine.resetAll）/ gameStore.resetGame は 10 項目
- handleReplay: FINISHED ガード + seekTo(0) 後の pauseVideo
- isSeekbarDisabled()（ユーザー上書き優先）/ Analytics 押下記録 / 効果音発火順序（pauseVideo → 発音）/ ボタンチェック OFF 分岐 — いずれも doc に無い
- **YouTubePlayerManager**: onTimeUpdate は存在しない（doc のみ）。getVideoTitle / destroy / createYouTubePlayerManager ファクトリ / loadYouTubeIframeAPI のポーリング+タイムアウトが doc に無い。loadVideo は LOAD_VIDEO_SETTLE_MS の簡易待ち。host は**常時** youtube-nocookie（doc は条件付き）。events に onError と width/height 追加。Debug プロファイルのコード例は実装に無い。modestbranding「R-2 で削除予定」は削除済み
- **TimeManager**: doc の getCurrentGameState / isInQuestionPeriod / isInRevealPeriod / hasOthersAnsweringPeriodInRange は存在しない（区間判定は thresholdEngine へ移動）。7 メソッドは一致。**constructor の questions フィールドが未使用（デッドフィールド）**→ 別枠 B-3
- **AudioManager**: playSound は void（doc は Promise）。stopSound の引数未使用。setVolume は 2 乗カーブ（doc に無い）。isSoundSupported は initialized フラグ。init() / unlock() / createAudioManager / AudioManagerOptions が doc に無い。**iOS 対策一式**（無音ループ SILENT_LOOP_FILE / ensureRunningContext の作り直し戦略 / HTMLAudio 個別ファイル SOUND_FILES fallback）がすべて doc に無い。スプライト src は BASE_URL 前置。audioManager.ts:23 のコメントが旧設計（currentTime シーク + setTimeout 停止）のまま → 別枠 B-4
- スプライト数値（0/2.0, 3.0/2.0, 6.0/2.0）と SOUND_TYPE、制御ルールは一致
- **AnswerValidator**: interface でなく export 関数 3 つ。validate に normalize 引数（既定 true = Phase 3 済み。doc の「既定 OFF」は陳腐化）。AnswerValidationConfig / TextType / RE_JP_FALLBACK は存在しない。NFKC **前**に長音異体統一を先行（－ の誤変換回避）— doc の手順順序と異なる。casefold は toLowerCase。カタカナ統一は固定
- **Analytics**: Core Components に節が皆無。実装は GA4/gtag.js（Firebase ではない）。イベント 5 種（started / answered / submitted / setting_changed / completed）。doc の accuracy_rate / completion_time / correct_answer / answer_time は送っていない。セッション ID は READY→TALKING 時生成（doc はページロード時）。PII マスク + 100 文字 / snake_case 変換 / boolean 1/0 / debug_mode 自動付与 / ゲート後の動的注入 / GA_MEASUREMENT_ID 空で no-op — すべて doc に無い。エラー追跡イベントは未実装（doc のみ）

---

## 監査 3: UI（design.md L1243-1557）

### 乖離一覧（要点）

- **コンポーネント階層図がほぼ全面的に空想**: AnswerArea / AppHeader 子 / YouTubePlayer / ProgressDisplay / ScoreDisplay / AnswerMeta 系 / VolumeControl 系 / DialogSystem はコンポーネントとして存在しない（インライン実装）。実在する ResultChip / 開始ゲート / サムネイルマスク / BUTTON CHECK トグル / デバッグメニュー / composables が図に無い
- GameInfo は GamePanel の外（App 直下フルブリード）。gap 管理は .game-ui
- ヘッダ: #2563eb 青背景 → 実装はダークステージ + グラデ。FINISHED で非表示。
- 進行表示「第3問」→「Q 03 / 05」。スコア「○:2 ×:1」→ 直近 5 問チップ + ページャ（correct/incorrect/skipped/noanswer/empty の 5 種）
- READY ガイド文言「ゲームを開始」→「クイズを開始」
- 残り回数は分母付き。タイマーは conic リング + Ns + 3 秒以下 urgent 演出
- QuizButton: 4:3 計算・Rectangle 描画 → 円形物理ボタン（固定 rem・台座・LED・パルス）。PUSH/ON!/WAIT・BUTTON CHECK 2 行・再生三角の表示が doc に無い
- FinalScore: 絵文字文言 → RESULT + 大型スコア + 正解率。ResultTable: table → カード行リスト + スキップ表示。showUserAnswers は常時 true（幅による自動切替なし）
- SettingsModal: タイトル「設定」・2 段構成 + ui-switch トグル・シーク/ボタンチェック/デバッグセクション・オーバーレイクリック閉じ — doc に無い。効果音 ON/OFF チェックボックスと「収集しないデータ」明記は doc のみ
- 状態別 UI 表: LOADING はゲートが上に被る / READY はサムネマスク + ゲート / ANSWERING の「未実装」注記は陳腐化 / キーボード折りたたみ（22-1）未記載 / FINISHED は Video・GameInfo・Header すべて非表示（doc は表示のまま）
- 入力仕様: 送信ボタン type 属性なし（form 外で実害なし）/ min-width 未指定 / 「クリック瞬間 disabled」は未実装（状態遷移任せ）
- レスポンシブ: 4:3 ボタンサイズ計算 → **rem 全体スケーリング**（html font-size clamp、315×700 基準）が中核なのに doc に無い。max-height 640px の圧縮も未記載
- orientation: useOrientationGuard はコールバック注入式（GameManager を知らない）。API 名は pauseExternalForOrientation
- Visual Reference は wireframe.html → 実装の出典は wireframe-v2-case1.html

### doc に無い新機構（監査 3）

開始ゲート / サムネイルマスク / BUTTON CHECK トグル / デバッグメニュー / キーボード折りたたみ + keyboard-offset + スクロール補正 / iOS 同期 focus ハック / ResultChip 共通化（SVG）/ スコアボードページャ / answer-area 縁取りフラッシュ / タイマー線形補間（@property --timer-progress）/ デザイントークン（Tailwind v4 @theme）/ touch-action・focus-visible・prefers-reduced-motion 横断設定 / safe-area + dvh / Analytics フック群

---

## 監査 4: データ・設定・エラー・統合（design.md L1558-2283）

### 乖離一覧（要点）

- **QuizSettings は 7 項目**（buttonCheckEnabled / debug 追加）。QuestionResult は timesUntilPress / submissionTypes 追加。questionText は内部型に存在（doc の断り書きが誤り）
- Application State: pendingTimesUntilPress / pendingSubmissionTypes / effectiveSettings / isButtonCheckEnabled が doc に無い
- **SystemCapabilities / UserSettings(autoSaveProgress) / VOLUME_LEVELS / DeveloperSettings は実装に存在しない**（doc のみ）。実物は settingsStore（soundEnabled / volumeLevel 0-4 / disableSeekbarOverride / buttonCheckOverride、LocalStorage 'yqb-settings'）+ debugStore（セッション限り）
- **URL 設計: ?v/?video → ?quiz={quizId}**（slug 検証 / 既定 sample / BASE_URL 前置 / withRetry / JSON パース失敗も NOT_FOUND / videoId 一致検証は撤廃）。quizDataLoader.ts:108 に旧コメント残存 → 別枠 B-5
- metadata.json は存在しない。検証項目は doc より大幅に多い（questionText 型 / buttonCheckEnabled・debug 型 / answers 空文字 / 時刻 >= 0 / othersAnsweringPeriods 包含・昇順非重複）
- エラー: QUIZ_DATA_NOT_FOUND 文言変更済み / ERROR_TITLES + getErrorInfo のタイトル種別化 / classifyError・isRecoverable・withRetry（バックオフ [1000,2000,4000]）が doc に無い / 「暫定実装」注記は陳腐化 / IMAGE_LOAD_FAILED は参照ゼロのデッド定数 → 別枠 B-6
- E2E Playwright は不採用（tasks.md 裁定）。Environment Variables 管理は存在しない（GA ID はソース直書き）
- **Analytics 節は Firebase → GA4/gtag.js に全面書き換えが必要**（イベント 5 種・パラメータ全面変更・セッション ID 生成タイミング・PII/切り詰め）
- ディレクトリ構成: src/data/ は無い。game/ に ResultChip 追加
- playerVars: doc の 3 項目 → 実装は 9 項目 + nocookie host。autoplay の開始トリガはゲート
- 時間追跡の責務は player 側でなく App/useGameLoop
- VideoPlayer に videoId watch なし（onMounted 1 回）
- Development Configuration: base サブパス / analyze モード / Vitest 同居設定が doc に無い
- 開発フェーズ表: Phase 2/3 の完了が未反映（未実施はボタン画像スプライト※廃止済み裁定 と E2E※不採用）
- サンプルデータ: パスは data/sample/ / disableSeekbar・hideVideoPlayerDuringAnswer の値が実データと逆 / buttonCheckEnabled・debug 未記載 / quizTitle は内部型に引き継がれない（未使用の明記なし）/ ガイドラインに buttonCheckEnabled・debug・othersAnsweringPeriods の説明なし
- Future Work: LocalStorage 永続化は実装済み（音声 + シーク上書き + ボタンチェック上書き。debugStore のみ意図的に非永続）

---

## 別枠: 実装側の発見（design.md には反映しない。コード修正の判断は別途）

| ID | 内容 | 場所 | 種別 |
|---|---|---|---|
| B-1 | jumpToRevealPeriod=true かつ currentVideoTime >= revealTime の解答終了時、WAITING へ遷移するが playVideo されず動画が停止したままになる可能性 | answerFlowController.ts:132-140 | 潜在バグ（要検証） |
| B-2 | 消費済み（スキップ済み）問題でも othersAnsweringPeriods 終了で無条件に QUESTIONING 復帰し、ボタン押下可能になる | thresholdEngine.ts:211-220 | 潜在バグ（要検証） |
| B-3 | TimeManager の constructor が保持する questions がクラス内で未参照（デッドフィールド） | timeManager.ts:13 | 掃除 |
| B-4 | audioManager.ts:23 のクラスコメントが旧設計（currentTime シーク + setTimeout 停止）のまま | audioManager.ts:23 | コメント陳腐化 |
| B-5 | 「動画ID整合性チェック（sampleの場合はスキップ）」コメントが検証撤廃後も残存 | quizDataLoader.ts:108 | コメント陳腐化 |
| B-6 | IMAGE_LOAD_FAILED 定数が参照ゼロ | errorMessages.ts:6 | デッド定数（画像エラー処理は未実装） |
| B-7 | 送信ボタンに type 属性なし（form 外のため実害なし）・min-width 未指定（44px 幅保証なし） | AnswerContent.vue:109,276 | 軽微 |
