# Task 25 実行spec: Firebase Analytics 統合

> 作成: 2026-07-05（Fable 5 による設計）。外部レビュー（GA4/BigQuery 観点）を反映済み。
> 完了条件: `npm run test` / `type-check` / `lint` / `build` パス + 手動確認（DebugView でイベント受信）。

## 概要

Firebase Analytics（GA4）でプレイ状況を匿名収集する。**設定が無い環境では完全に no-op**（開発・フォーク時に外部送信しない）。送信内容は SettingsModal の PrivacyInfo 文言（「入力した解答内容も統計処理の対象」「個人を直接識別できる形では保存しない」）と整合させる。

設計方針: GA4 UI ではサマリ（登録ディメンション/メトリクスのみ）、BigQuery では明細（1 行 = 1 試行）を見る二層構成。自由入力・高カーディナリティのパラメータは**送るが GA4 UI には登録しない**。

## 25-1. 依存と設定

- `npm install firebase`（modular SDK。`firebase/app` + `firebase/analytics` のみ使用）
- 新規 `src/constants/firebase.ts`:
  ```ts
  // Firebase Web 設定（Analytics 用。Web の apiKey/measurementId は公開前提の識別子であり秘密ではない）
  // measurementId が空文字のときは Analytics を初期化しない（no-op）
  export const FIREBASE_CONFIG = {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: '',
  } as const
  ```
- 手動手順（ユーザー作業）: Firebase Console でプロジェクト + Web アプリを作成し、表示された config を上記に貼り付ける。コミットしてよい（GA4 の Web 設定は公開識別子）
- SDK は **動的 import**（`await import('firebase/app')`）で初期化時のみ読み込む。バンドル本体を肥大化させない

## 25-2. イベント定義（analyticsService: 新規 `src/services/analyticsService.ts`）

TypeScript の型は camelCase、**GA 送信時のパラメータ名は snake_case に変換**する（25-4 の対応表参照）。

```ts
export interface QuizSessionStartedEvent {
  quizSessionId: string          // プレイセッション ID（UUID v4。GA のセッション概念と区別する命名）
  videoId: string
  totalQuestions: number
}

/** 1 問の最終結果サマリ */
export interface QuestionAnsweredEvent {
  quizSessionId: string
  videoId: string
  questionIndex: number          // 0-origin
  result: 'correct' | 'incorrect' | 'skipped' | 'unanswered'
  attemptsUsed: number
  answers: string                // 全解答履歴を '|' 連結（例 "とうきょう|東京"。空可）
  timesUntilPressSec: string     // 各試行で解答権を得るまでの秒（小数1桁）を '|' 連結（例 "2.4|5.1"。未押下は空）
  firstTimeUntilPressSec?: number // 初回押下の秒（未押下なら送らない。メトリクス集計用）
  questionText?: string          // データが問題文を持つ場合のみ
}

/** 解答 1 試行の明細（1 行 = 1 試行。BigQuery 分析用） */
export interface AnswerSubmittedEvent {
  quizSessionId: string
  videoId: string
  questionIndex: number
  attemptIndex: number           // 1-origin
  answer: string                 // この試行の解答文字列
  isCorrect: boolean
  isFinalAttempt: boolean        // この試行で問題結果が確定したか（= attemptIndex === attemptsUsed）
  submissionType: 'manual' | 'timeout'  // 手動送信 / 制限時間切れによる自動確定
  timeUntilPressSec: number      // この試行で解答権を得るまでの秒（問題開始から・小数1桁）
  questionText?: string
}

export interface QuizSessionCompletedEvent {
  quizSessionId: string
  videoId: string
  totalQuestions: number
  correctCount: number
  incorrectCount: number
  skippedCount: number
  unansweredCount: number
  totalAttempts: number          // 全問題の attemptsUsed 合計
}

class AnalyticsService {
  /** measurementId が空 / 初期化失敗時は無効のまま以後すべて no-op */
  async init(): Promise<void>
  logQuizSessionStarted(event: QuizSessionStartedEvent): void
  logQuestionAnswered(event: QuestionAnsweredEvent): void
  logAnswerSubmitted(event: AnswerSubmittedEvent): void
  logQuizSessionCompleted(event: QuizSessionCompletedEvent): void
}
export function createAnalyticsService(): AnalyticsService
```

- サービスは 3 状態を持つ: `disabled`（measurementId 空 / isSupported=false / 初期化失敗）/
  `initializing`（init の Promise 進行中）/ `enabled`（logEvent 可能）
- `init()`: `FIREBASE_CONFIG.measurementId === ''` なら即 disabled。`isSupported()` が false でも disabled。
  例外は logger.warn に留めアプリを止めない（disabled へ）
- `log*` の挙動（**「未初期化なら常に no-op」にはしない**）:
  - enabled: 即 logEvent
  - initializing: **小さなキュー（上限 50 件程度）に積み、enabled 化時に flush** する。
    ゲート解除直後に即ゲーム開始しても quiz_session_started が落ちない（init は fire-and-forget のままで良い）
  - disabled: no-op（キューも破棄）
- **quiz_session_started は必須**（開始したが完走しなかったセッション＝離脱率の計測に必要。completed だけでは完走者しか見えない）
- question_started は今回見送り（必要になったら追加）

### result の定義（明文化）

| 値 | 定義 |
|---|---|
| correct | 1 回以上解答し、最終的に正解 |
| incorrect | 1 回以上解答し、最終的に不正解（**押下後の時間切れ確定を含む** — 本アプリは時間切れでもその時点の入力で判定し userAnswers に記録するため、試行が発生している） |
| skipped | シーク等でその問題に参加しなかった |
| unanswered | 問題区間に到達したが**一度も押下しなかった** |

導出規則: `skipped → 'skipped'` / `isCorrect → 'correct'` / `userAnswers.length === 0 → 'unanswered'` / 残り → `'incorrect'`

## 25-3. 前提整備（記録機構の追加）

### 押下タイミング（命名はイベントと統一）

- gameStore: `pendingTimesUntilPress = ref<number[]>([])` と action `recordButtonPress(timeUntilPress: number)` を新設。
  `pendingUserAnswers` と同じライフサイクルでクリア（initializeForQuestion / シーク離脱 / recordResult 時）
- `QuestionResult`（src/types/result.ts）に `timesUntilPress: number[]` を追加し、`recordResult` 内で
  `[...pendingTimesUntilPress.value]` を取り込む（呼び出し側のシグネチャは変えない）
- gameManager の早押し処理（QUESTIONING の同期分岐、pauseVideo の直後）で
  `Math.max(0, playerControl.getCurrentTime() - 現在の問題.startTime)` を小数 1 桁に丸めて recordButtonPress する

### 送信種別（manual / timeout）

- gameStore: `pendingSubmissionTypes = ref<('manual' | 'timeout')[]>([])` を pendingUserAnswers と並行して保持。
  解答を積む action（現行の submit 経路）に種別引数を追加するか、専用 action を分ける（実装の自然な方に合わせる）
- 手動送信（送信ボタン / Enter）は 'manual'、answerFlowController のカウントダウン満了による確定は 'timeout' を積む
- `QuestionResult` に `submissionTypes: ('manual' | 'timeout')[]` を追加（timesUntilPress と同様に取り込み・クリア）

### questionText

- `QuizQuestion` 型（src/types/quizData.ts）に `questionText?: string` を追加し、quizDataLoader の convert で引き継ぐ
  （存在時のみ。validate は string 型チェックを任意項目として追加）

### 既存テストへの影響

- QuestionResult 生成箇所に `timesUntilPress` / `submissionTypes` が加わる。期待値オブジェクトを toMatchObject 比較にするか
  空配列を追記して対応（値の変更はしない）

## 25-4. GA 送信時の変換（analyticsService 内）

- パラメータ名は **snake_case**。TS フィールド名は GA パラメータ名と機械的に対応するよう命名済み
  （camelCase → snake_case の単純変換のみ。`quizSessionId → quiz_session_id` / `timeUntilPressSec → time_until_press_sec`）
- boolean は **1 / 0 に変換**（BigQuery の int_value で扱いやすくする）
- **デバッグデータの識別**: クイズデータが `settings.debug === true` の場合、**全イベントに GA4 標準の
  `debug_mode: 1` を付与**する（false のときはパラメータ自体を送らない）。
  これにより ①DebugView にリアルタイム表示される ②本番レポート/BigQuery でデバッグプレイを除外できる。
  実装は analyticsService に `setDebugMode(enabled: boolean)` を持たせ、App がクイズデータ読込時に設定する
- 自由入力（`answer` / `answers` / `question_text`）は送信前に **sanitizeAndTruncate** を通す:
  - PII マスク: メールアドレス・電話番号・URL のパターンを `[masked]` に置換（正規表現ベースの軽量実装で良い）
  - 100 文字超は切り詰め（GA4 のパラメータ値上限）

対応表（answer_submitted の例）:

| TS フィールド | GA パラメータ |
|---|---|
| quizSessionId | quiz_session_id |
| videoId | video_id |
| questionIndex | question_index |
| attemptIndex | attempt_index |
| answer | answer（sanitize + truncate） |
| isCorrect | is_correct（1/0） |
| isFinalAttempt | is_final_attempt（1/0） |
| submissionType | submission_type |
| timeUntilPressSec | time_until_press_sec |
| questionText | question_text（sanitize + truncate） |

他イベントも同じ規則で変換（times_until_press_sec / first_time_until_press_sec / attempts_used / total_questions / correct_count 等）。

## 25-5. セッション ID とフック位置（App.vue）

- セッション ID: `crypto.randomUUID()`。**READY → TALKING 遷移ごとに新規発行**（リプレイは別セッション。
  問題間の TALKING 再突入は REVEALING 等からの遷移なので発火しない）
- 送信フックは **App.vue の watcher に集約**（ストア・サービスの純度を保つ。gameStore への Analytics 依存の混入は不可）:
  1. `watch(() => gameStore.currentState, (next, prev))`: prev === READY && next === TALKING で
     sessionId 再発行 + 送信済みカウンタ 0 リセット + **logQuizSessionStarted**
  2. `watch(() => gameStore.results.length)`: `results` は push 追記のため **length を監視**。
     送信済み件数 `lastSentCount` ref を持ち、増分の各 QuestionResult について:
     - `userAnswers` の各要素を logAnswerSubmitted（attemptIndex は 1-origin、
       `timeUntilPressSec = timesUntilPress[attemptIndex - 1]`、`submissionType = submissionTypes[attemptIndex - 1]`、
       `isFinalAttempt = attemptIndex === result.userAnswers.length`（その QuestionResult の試行配列の末尾か）。
       押下と解答は原則 1:1 対応するが、保険として `timesUntilPress[attemptIndex - 1]` が undefined の場合は
       **その answer_submitted は送らず logger.warn**（0 埋めより分析データの意味が壊れにくい））
     - その後サマリの logQuestionAnswered を 1 件（`answers = userAnswers.join('|')`、
       `timesUntilPressSec = 各値.toFixed(1).join('|')`、`firstTimeUntilPressSec = timesUntilPress[0]`）
  3. FINISHED 遷移で logQuizSessionCompleted（集計は `results` から算出。totalAttempts = attemptsUsed の総和）
- `analyticsService.init()` は **`App.vue` の `handleGateTap` 内**（ゲート解除直後）に fire-and-forget（`void init()`）で呼ぶ

## 25-6. GA4 UI 登録ガイド（手動作業・実装対象外）

- カスタムディメンション（イベントスコープ）: `video_id` / `result` / `submission_type` のみ
- カスタムメトリクス: `question_index` / `attempt_index` / `attempts_used` / `time_until_press_sec` /
  `total_questions` / `correct_count` / `incorrect_count` / `skipped_count` / `unanswered_count` / `total_attempts`
- **登録しない**（BigQuery 専用）: `quiz_session_id` / `answer` / `answers` / `question_text` / `times_until_press_sec`
  （高カーディナリティで (other) 丸めの原因になる。BigQuery export では未登録でも event_params に保持される）

## 25-7. PrivacyInfo との整合（D-15）

- 送信するのは上記 4 イベントのみ。個人識別子（uid・氏名・連絡先）は送らない + 自由入力は PII マスク
- 解答文字列の送信は PrivacyInfo に既述（「入力した解答内容も統計処理の対象」）— 文言変更不要
- GA4 の自動収集（page_view 等）はデフォルトのままで良い

## 25-8. テスト

- `src/services/__tests__/analyticsService.test.ts`（新規）:
  - measurementId 空 → init 後も log* が logEvent を呼ばない（`vi.mock('firebase/app')` / `vi.mock('firebase/analytics')`）
  - 設定あり → 各 log* が対応するイベント名 + snake_case パラメータで logEvent を呼ぶ（boolean が 1/0 になること）
  - initializing 中に log* した分が enabled 化後に flush される / disabled 確定で破棄される
  - sanitizeAndTruncate: メール/電話/URL がマスクされる・100 文字で切れる
  - init 失敗（isSupported=false / initializeApp throw）でも例外が漏れない
- gameStore: recordButtonPress / submissionTypes の記録・クリアのテストを追補
- App のフックは watcher 中心のため単体テスト対象外（手動確認: Firebase DebugView）

## 手動確認

- [ ] 設定なし（空 config）で従来どおり動作し、ネットワークに gtag 系リクエストが出ない
- [ ] 設定あり + debug データで 1 ゲーム通しプレイ → DebugView に quiz_session_started × 1、
      answer_submitted × 試行数、question_answered × 問題数、quiz_session_completed × 1（debug_mode 付き）
- [ ] debug でないデータのイベントに debug_mode が付かない
- [ ] 途中離脱（リロード）で started のみ記録される
- [ ] リプレイで quiz_session_id が変わる

## やらないこと

- 同意バナー / オプトアウト UI（PrivacyInfo の告知で運用。将来必要なら設定画面にトグル追加）
- questionId パラメータ（データに安定 ID が無い。question_index で足りる）
- question_started イベント（必要になったら追加）
- Firebase Hosting への移行・他 Firebase サービスの導入
