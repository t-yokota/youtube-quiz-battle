# Task 25 実行spec: Firebase Analytics 統合

> 作成: 2026-07-05（Fable 5 による設計）。
> 完了条件: `npm run test` / `type-check` / `lint` / `build` パス + 手動確認（DebugView でイベント受信）。

## 概要

Firebase Analytics（GA4）でプレイ状況を匿名収集する。**設定が無い環境では完全に no-op**（開発・フォーク時に外部送信しない）。送信内容は SettingsModal の PrivacyInfo 文言（「入力した解答内容も統計処理の対象」「個人を直接識別できる形では保存しない」）と整合させる。

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

## 25-2. analyticsService（新規 `src/services/analyticsService.ts`）

```ts
export interface QuestionAnsweredEvent {
  sessionId: string
  questionIndex: number          // 0-origin
  result: 'correct' | 'incorrect' | 'skipped' | 'unanswered'
  attemptsUsed: number           // 使用した解答回数（skipped/unanswered は 0 もあり得る）
  answers: string                // 全解答履歴を '|' 連結した文字列（例 "とうきょう|東京"。空可）
                                 // GA4 のイベントパラメータは配列不可・値 100 文字上限のため、
                                 // 連結後 100 文字を超える場合は末尾を切り詰める
  questionText?: string          // データが問題文を持つ場合のみ送る（100 文字超は切り詰め）
  pressOffsets: string           // その問題の開始から何秒後にボタンを押したかの履歴（秒・小数1桁）を
                                 // '|' 連結した文字列（例 "2.4|5.1"。未押下は空文字。100 文字超は切り詰め）
}

/** 解答 1 試行ごとに送る（分析で 1 行 = 1 試行にするため。サマリの question_answered と併送） */
export interface AnswerSubmittedEvent {
  sessionId: string
  questionIndex: number
  attemptIndex: number           // 1-origin（何回目の試行か）
  answer: string                 // この試行の解答文字列（100 文字超は切り詰め）
  isCorrect: boolean
  pressOffset: number | null     // この試行の押下タイミング（問題開始からの秒・小数1桁）。対応が取れない場合 null
}

export interface QuizSessionCompletedEvent {
  sessionId: string
  videoId: string
  totalQuestions: number
  correctCount: number
  incorrectCount: number
  skippedCount: number
  unansweredCount: number
}

class AnalyticsService {
  /** measurementId が空 / 初期化失敗時は isEnabled=false のまま以後すべて no-op */
  async init(): Promise<void>
  logQuestionAnswered(event: QuestionAnsweredEvent): void
  logAnswerSubmitted(event: AnswerSubmittedEvent): void
  logQuizSessionCompleted(event: QuizSessionCompletedEvent): void
}
export function createAnalyticsService(): AnalyticsService
```

- `init()`: `FIREBASE_CONFIG.measurementId === ''` なら即 return。`isSupported()`（firebase/analytics）が false でも return。例外は logger.warn に留めアプリを止めない
- `log*`: 未初期化なら no-op。`logEvent(analytics, 'question_answered', {...})` / `'quiz_session_completed'`
- GA4 の予約プレフィックス（`firebase_` 等）を避けたスネークケースのパラメータ名を使う

## 25-3. セッション ID とフック位置（App.vue）

- セッション ID: `crypto.randomUUID()`。**ゲーム開始（READY → TALKING 遷移）ごとに新規発行**（リプレイは別セッション）。App の ref に保持
- 送信フックは **App.vue の watcher に集約**する（ストア・サービスの純度を保つ。gameStore への Analytics 依存の混入は不可）:
  1. `watch(() => gameStore.currentState, (next, prev) => ...)`: **prev === READY && next === TALKING** のときのみ sessionId 再発行 + 送信済みカウンタ 0 リセット
     （問題間の TALKING 再突入は REVEALING 等からの遷移なので発火しない。ゲーム開始のみを捕捉できる）
  2. `watch(() => gameStore.results.length)`: `results` は `ref<QuestionResult[]>` に **push で追記**される（参照は変わらない）ため、
     **length を監視**して増分のみ送る。送信済み件数を `lastSentCount` ref（number）で保持し、
     `results[lastSentCount..length-1]` を logQuestionAnswered して更新する（Set は不要）
  3. 増分の各 QuestionResult について、`userAnswers` の各要素を logAnswerSubmitted で個別送信する
     （attemptIndex は 1-origin。pressOffset は `pressOffsets[attemptIndex-1] ?? null` — 押下と解答は
     通常 1:1 だが、タイムアウト確定などでズレた場合は null 側に倒す）。
     その後サマリの logQuestionAnswered を 1 件送る（パイプ連結フィールドは分析の利便用に維持）
  4. FINISHED 遷移で logQuizSessionCompleted（集計は `results` から算出）
- `QuestionResult`（isCorrect / skipped / userAnswers を持つ）からのイベント値の導出規則:
  - `result`: `skipped → 'skipped'` / `isCorrect → 'correct'` / それ以外で `userAnswers.length === 0 → 'unanswered'` / 残り → `'incorrect'`
  - `attemptsUsed = userAnswers.length` / `answers = userAnswers.join('|')`（100 文字超は切り詰め）
  - `questionText = quizData.questions[questionIndex].questionText`（未定義なら送らない。100 文字超は切り詰め）
  - `pressOffsets = result.pressOffsets.map(v => v.toFixed(1)).join('|')`（100 文字超は切り詰め）
- **前提整備（押下タイミングの記録）**: 現状、押下時刻は未記録のため以下を追加する:
  - gameStore: `pendingPressOffsets = ref<number[]>([])` と action `recordButtonPress(offsetSec: number)` を新設。
    `pendingUserAnswers` と同じライフサイクルでクリア（initializeForQuestion / シーク離脱 / recordResult 時）
  - `QuestionResult`（src/types/result.ts）に `pressOffsets: number[]` を追加し、`recordResult` 内で
    `[...pendingPressOffsets.value]` を取り込む（呼び出し側のシグネチャは変えない）
  - gameManager の早押し処理（QUESTIONING の同期分岐、pauseVideo の直後）で
    `Math.max(0, playerControl.getCurrentTime() - 現在の問題.startTime)` を小数 1 桁に丸めて recordButtonPress する
  - 既存テストへの影響: QuestionResult 生成箇所に `pressOffsets` が加わる。期待値オブジェクトを
    toMatchObject 比較にするか `pressOffsets: []` を追記して対応（値の変更はしない）
- **前提整備**: `questionText` は RawQuizData には存在するが変換時に捨てられているため、
  `QuizQuestion` 型（src/types/quizData.ts）に `questionText?: string` を追加し、
  quizDataLoader の convert で引き継ぐ（存在時のみ。validate は string 型チェックを任意項目として追加）
- `analyticsService.init()` は **`App.vue` の `handleGateTap` 内**（ゲート解除直後）に fire-and-forget（`void init()`）で呼ぶ（初期表示を阻害しない・プレイ意思のあるユーザーのみ計測開始）

## 25-4. PrivacyInfo との整合（D-15）

- 送信するのは上記 3 イベント（answer_submitted / question_answered / quiz_session_completed）のみ。個人識別子（uid・氏名・連絡先）は送らない
- `answers`（解答文字列の履歴）を送ることは PrivacyInfo に既述（「入力した解答内容も統計処理の対象」）— 文言変更不要
- GA4 の自動収集（page_view 等）はデフォルトのままで良い

## 25-5. テスト

- `src/services/__tests__/analyticsService.test.ts`（新規）:
  - measurementId 空 → init 後も log* が logEvent を呼ばない（`vi.mock('firebase/app')` / `vi.mock('firebase/analytics')`）
  - 設定あり → init 後 logQuestionAnswered / logAnswerSubmitted がそれぞれ
    logEvent('question_answered' / 'answer_submitted', params) を呼ぶ
  - init 失敗（isSupported=false / initializeApp throw）でも例外が漏れない
- App のフックは watcher 中心のため単体テスト対象外（Task 26 の E2E ではなく手動確認: Firebase DebugView）

## 手動確認

- [ ] 設定なし（空 config）で従来どおり動作し、ネットワークに gtag 系リクエストが出ない
- [ ] 設定ありで 1 ゲーム通しプレイ → DebugView に question_answered × 問題数、quiz_session_completed × 1
- [ ] リプレイで sessionId が変わる

## やらないこと

- 同意バナー / オプトアウト UI（PrivacyInfo の告知で運用。将来必要なら設定画面にトグル追加）
- Firebase Hosting への移行・他 Firebase サービスの導入
