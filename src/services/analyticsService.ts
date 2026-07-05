// Firebase Analytics（GA4）連携サービス
// 設定が無い環境（measurementId 空）では完全に no-op にする。
// firebase SDK は動的 import で読み込み、本体バンドルを肥大化させない
import type { Analytics } from 'firebase/analytics'
import { FIREBASE_CONFIG } from '@/constants/firebase'
import { ANALYTICS_QUEUE_MAX_SIZE, ANALYTICS_PARAM_MAX_LENGTH } from '@/constants/analytics'
import { logger } from '@/utils/logger'

/** セッション開始イベント（quiz_session_started） */
export interface QuizSessionStartedEvent {
  quizSessionId: string
  quizId: string
  videoId: string
  videoTitle?: string
  totalQuestions: number
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
// disabled: measurementId空 / isSupported=false / 初期化失敗 → 以後すべてno-op
// initializing: init()のPromise進行中 → log*はキューに積む
// enabled: logEvent可能
type AnalyticsState = 'disabled' | 'initializing' | 'enabled'

// GA送信パラメータ値（変換後）
type GaParamValue = string | number
type GaParams = Record<string, GaParamValue>

// キュー投入前の入力値（boolean/undefinedを許容し、buildGaParamsで変換する）
type RawParamValue = string | number | boolean | undefined
type RawParams = Record<string, RawParamValue>

interface QueuedEvent {
  name: string
  params: GaParams
}

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
  private analytics: Analytics | null = null
  private logEventFn: ((analytics: Analytics, name: string, params?: GaParams) => void) | null =
    null
  private queue: QueuedEvent[] = []
  private debugMode = false

  /**
   * デバッグモードの有効/無効を設定する
   * true の場合、全イベントに GA4 標準の debug_mode: 1 を付与する
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled
  }

  /**
   * Analytics を初期化する。measurementId が空 / isSupported=false / 初期化失敗時は
   * disabled のまま以後すべて no-op になる。例外は logger.warn に留めアプリを止めない
   */
  async init(): Promise<void> {
    if (FIREBASE_CONFIG.measurementId === '') {
      this.state = 'disabled'
      return
    }

    this.state = 'initializing'

    try {
      const [{ initializeApp }, { getAnalytics, isSupported, logEvent }] = await Promise.all([
        import('firebase/app'),
        import('firebase/analytics'),
      ])

      const supported = await isSupported()
      if (!supported) {
        this.discardAsDisabled()
        return
      }

      const app = initializeApp(FIREBASE_CONFIG)
      this.analytics = getAnalytics(app)
      this.logEventFn = logEvent
      this.state = 'enabled'
      this.flushQueue()
    } catch (error) {
      logger.warn('[AnalyticsService] Failed to initialize:', error)
      this.discardAsDisabled()
    }
  }

  logQuizSessionStarted(event: QuizSessionStartedEvent): void {
    const params = buildGaParams({
      quizSessionId: event.quizSessionId,
      quizId: event.quizId,
      videoId: event.videoId,
      videoTitle: event.videoTitle ? sanitizeAndTruncate(event.videoTitle) : undefined,
      totalQuestions: event.totalQuestions,
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

  // 状態に応じてイベントを送信 / キューへ積む / 破棄する
  private dispatch(name: string, params: GaParams): void {
    const finalParams = this.debugMode ? { ...params, debug_mode: 1 } : params

    if (this.state === 'enabled') {
      this.sendEvent(name, finalParams)
      return
    }

    if (this.state === 'initializing') {
      if (this.queue.length < ANALYTICS_QUEUE_MAX_SIZE) {
        this.queue.push({ name, params: finalParams })
      }
      return
    }

    // disabled: no-op（キューも破棄）
  }

  private sendEvent(name: string, params: GaParams): void {
    if (!this.analytics || !this.logEventFn) return
    this.logEventFn(this.analytics, name, params)
  }

  private flushQueue(): void {
    const pending = this.queue
    this.queue = []
    for (const item of pending) {
      this.sendEvent(item.name, item.params)
    }
  }

  private discardAsDisabled(): void {
    this.state = 'disabled'
    this.queue = []
  }
}

export type { AnalyticsService }

export function createAnalyticsService(): AnalyticsService {
  return new AnalyticsService()
}
