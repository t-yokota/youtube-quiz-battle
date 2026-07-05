// Google Analytics（GA4 / gtag.js）連携サービス
// 設定が無い環境（GA_MEASUREMENT_ID 空）では完全に no-op にする。
// gtag.js は init 時に動的注入する（ゲート通過まで外部リクエストを発生させない）。
// dataLayer スタブがスクリプト読込前のイベントをネイティブにバッファするため、
// init 後は即座に log* を受け付けられる
import { GA_MEASUREMENT_ID, ANALYTICS_PARAM_MAX_LENGTH } from '@/constants/analytics'
import { logger } from '@/utils/logger'

// gtag.js のグローバル定義
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

/** セッション開始イベント（quiz_session_started） */
export interface QuizSessionStartedEvent {
  quizSessionId: string
  quizId: string
  videoId: string
  videoTitle?: string
  totalQuestions: number
  // ゲーム開始時点の実効設定スナップショット（ユーザー上書き・デバッグ上書き適用後）
  buttonCheckEnabled: boolean
  seekAllowed: boolean
  jumpToRevealPeriod: boolean
  hideVideoPlayerDuringAnswer: boolean
  answerTimeLimit: number
  maxAttempts: number
}

/** 1 問の最終結果サマリ（question_answered） */
export interface QuestionAnsweredEvent {
  quizSessionId: string
  quizId: string
  videoId: string
  videoTitle?: string
  questionIndex: number
  result: 'correct' | 'incorrect' | 'skipped' | 'unanswered'
  attemptsUsed: number
  answers: string
  timesUntilPressSec: string
  firstTimeUntilPressSec?: number
  questionText?: string
}

/** 解答 1 試行の明細（answer_submitted。1 行 = 1 試行、BigQuery 分析用） */
export interface AnswerSubmittedEvent {
  quizSessionId: string
  quizId: string
  videoId: string
  videoTitle?: string
  questionIndex: number
  attemptIndex: number
  answer: string
  isCorrect: boolean
  isFinalAttempt: boolean
  submissionType: 'manual' | 'timeout'
  timeUntilPressSec: number
  questionText?: string
}

/** セッション完走イベント（quiz_session_completed） */
export interface QuizSessionCompletedEvent {
  quizSessionId: string
  quizId: string
  videoId: string
  videoTitle?: string
  totalQuestions: number
  correctCount: number
  incorrectCount: number
  skippedCount: number
  unansweredCount: number
  totalAttempts: number
}

// サービスの内部状態
// disabled: measurementId 空 → 以後すべて no-op
// enabled: gtag スタブ設置済み（スクリプト読込前でも dataLayer がバッファする）
type AnalyticsState = 'disabled' | 'enabled'

// GA送信パラメータ値（変換後）
type GaParamValue = string | number
type GaParams = Record<string, GaParamValue>

// キュー投入前の入力値（boolean/undefinedを許容し、buildGaParamsで変換する）
type RawParamValue = string | number | boolean | undefined
type RawParams = Record<string, RawParamValue>


// PIIマスク用パターン（軽量な正規表現ベース実装）
const URL_REGEX = /https?:\/\/[^\s]+/gi
const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[\w.-]+/g
const PHONE_REGEX = /\b0\d{1,4}-\d{1,4}-\d{3,4}\b|\b0\d{9,10}\b/g

/**
 * 自由入力文字列をGA4送信前にサニタイズする
 * - メールアドレス・電話番号・URLを [masked] に置換
 * - 100文字超は切り詰め
 */
export function sanitizeAndTruncate(value: string): string {
  const masked = value
    .replace(URL_REGEX, '[masked]')
    .replace(EMAIL_REGEX, '[masked]')
    .replace(PHONE_REGEX, '[masked]')
  return masked.length > ANALYTICS_PARAM_MAX_LENGTH
    ? masked.slice(0, ANALYTICS_PARAM_MAX_LENGTH)
    : masked
}

// camelCase → snake_case（単純な機械変換）
function camelToSnakeKey(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

// TSフィールド名 → GAパラメータ名の変換 + boolean→1/0 変換。undefinedのフィールドは送らない
function buildGaParams(input: RawParams): GaParams {
  const result: GaParams = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue
    const gaKey = camelToSnakeKey(key)
    result[gaKey] = typeof value === 'boolean' ? (value ? 1 : 0) : value
  }
  return result
}

class AnalyticsService {
  private state: AnalyticsState = 'disabled'
  private debugMode = false
  private readonly measurementId: string

  constructor(measurementId: string = GA_MEASUREMENT_ID) {
    this.measurementId = measurementId
  }

  /**
   * デバッグモードの有効/無効を設定する
   * true の場合、全イベントに GA4 標準の debug_mode: 1 を付与する
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled
  }

  /**
   * Analytics を初期化する。measurementId が空なら disabled のまま以後すべて no-op。
   * gtag スタブと dataLayer を設置し、gtag.js スクリプトを動的注入する。
   * dataLayer が読込前のイベントをバッファするため、この時点から log* を受け付けられる
   */
  async init(): Promise<void> {
    if (this.measurementId === '') {
      this.state = 'disabled'
      return
    }

    try {
      // gtag スタブの設置（公式スニペット相当）
      // 注意: gtag.js は dataLayer 内の Arguments オブジェクトのみをコマンドとして
      // 処理するため、rest 引数の配列ではなく arguments をそのまま push する必要がある
      window.dataLayer = window.dataLayer ?? []
      window.gtag =
        window.gtag ??
        function gtag() {
          // eslint-disable-next-line prefer-rest-params
          window.dataLayer!.push(arguments)
        }
      window.gtag('js', new Date())
      window.gtag('config', this.measurementId)

      // gtag.js を動的注入（多重注入は防ぐ）
      const src = `https://www.googletagmanager.com/gtag/js?id=${this.measurementId}`
      if (!document.querySelector(`script[src="${src}"]`)) {
        const script = document.createElement('script')
        script.async = true
        script.src = src
        script.onerror = () => {
          logger.warn('[AnalyticsService] Failed to load gtag.js')
        }
        document.head.appendChild(script)
      }

      this.state = 'enabled'
    } catch (error) {
      logger.warn('[AnalyticsService] Failed to initialize:', error)
      this.state = 'disabled'
    }
  }

  logQuizSessionStarted(event: QuizSessionStartedEvent): void {
    const params = buildGaParams({
      quizSessionId: event.quizSessionId,
      quizId: event.quizId,
      videoId: event.videoId,
      videoTitle: event.videoTitle ? sanitizeAndTruncate(event.videoTitle) : undefined,
      totalQuestions: event.totalQuestions,
      buttonCheckEnabled: event.buttonCheckEnabled,
      seekAllowed: event.seekAllowed,
      jumpToRevealPeriod: event.jumpToRevealPeriod,
      hideVideoPlayerDuringAnswer: event.hideVideoPlayerDuringAnswer,
      answerTimeLimit: event.answerTimeLimit,
      maxAttempts: event.maxAttempts,
    })
    this.dispatch('quiz_session_started', params)
  }

  logQuestionAnswered(event: QuestionAnsweredEvent): void {
    const params = buildGaParams({
      quizSessionId: event.quizSessionId,
      quizId: event.quizId,
      videoId: event.videoId,
      videoTitle: event.videoTitle ? sanitizeAndTruncate(event.videoTitle) : undefined,
      questionIndex: event.questionIndex,
      result: event.result,
      attemptsUsed: event.attemptsUsed,
      answers: sanitizeAndTruncate(event.answers),
      timesUntilPressSec: event.timesUntilPressSec,
      firstTimeUntilPressSec: event.firstTimeUntilPressSec,
      questionText: event.questionText ? sanitizeAndTruncate(event.questionText) : undefined,
    })
    this.dispatch('question_answered', params)
  }

  logAnswerSubmitted(event: AnswerSubmittedEvent): void {
    const params = buildGaParams({
      quizSessionId: event.quizSessionId,
      quizId: event.quizId,
      videoId: event.videoId,
      videoTitle: event.videoTitle ? sanitizeAndTruncate(event.videoTitle) : undefined,
      questionIndex: event.questionIndex,
      attemptIndex: event.attemptIndex,
      answer: sanitizeAndTruncate(event.answer),
      isCorrect: event.isCorrect,
      isFinalAttempt: event.isFinalAttempt,
      submissionType: event.submissionType,
      timeUntilPressSec: event.timeUntilPressSec,
      questionText: event.questionText ? sanitizeAndTruncate(event.questionText) : undefined,
    })
    this.dispatch('answer_submitted', params)
  }

  logQuizSessionCompleted(event: QuizSessionCompletedEvent): void {
    const params = buildGaParams({
      quizSessionId: event.quizSessionId,
      quizId: event.quizId,
      videoId: event.videoId,
      videoTitle: event.videoTitle ? sanitizeAndTruncate(event.videoTitle) : undefined,
      totalQuestions: event.totalQuestions,
      correctCount: event.correctCount,
      incorrectCount: event.incorrectCount,
      skippedCount: event.skippedCount,
      unansweredCount: event.unansweredCount,
      totalAttempts: event.totalAttempts,
    })
    this.dispatch('quiz_session_completed', params)
  }

  // 状態に応じてイベントを送信 / 破棄する
  private dispatch(name: string, params: GaParams): void {
    if (this.state !== 'enabled' || !window.gtag) return

    // 開発ビルド（ローカル実行）では常に debug_mode を付与し、本番レポートを汚さない
    const isDebug = this.debugMode || import.meta.env.DEV
    const finalParams = isDebug ? { ...params, debug_mode: 1 } : params
    window.gtag('event', name, finalParams)
  }
}

export type { AnalyticsService }

export function createAnalyticsService(measurementId?: string): AnalyticsService {
  return new AnalyticsService(measurementId)
}
