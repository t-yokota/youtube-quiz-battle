import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createAnalyticsService, sanitizeAndTruncate } from '../analyticsService'
import { ANALYTICS_PARAM_MAX_LENGTH } from '@/constants/analytics'

const TEST_MEASUREMENT_ID = 'G-TEST123'

// dataLayer に積まれた gtag 呼び出しから event エントリのみ抽出する
function eventEntries(): Array<[string, string, Record<string, unknown>]> {
  const layer = (window.dataLayer ?? []) as Array<ArrayLike<unknown>>
  return layer
    .map((entry) => Array.from(entry))
    .filter((args): args is [string, string, Record<string, unknown>] => args[0] === 'event')
}

function makeStartedEvent() {
  return {
    quizSessionId: 's1',
    quizId: 'q1',
    videoId: 'v1',
    totalQuestions: 5,
    buttonCheckEnabled: true,
    seekAllowed: false,
    jumpToRevealPeriod: false,
    hideVideoPlayerDuringAnswer: true,
    answerTimeLimit: 10,
    maxAttempts: 3,
  }
}

describe('AnalyticsService（gtag.js 送信層）', () => {
  beforeEach(() => {
    delete window.dataLayer
    delete window.gtag
  })

  afterEach(() => {
    document.querySelectorAll('script[src*="googletagmanager"]').forEach((el) => el.remove())
    delete window.dataLayer
    delete window.gtag
  })

  describe('measurementId が空（no-op）', () => {
    it('init しても gtag/dataLayer を設置せず、log* も no-op', async () => {
      const service = createAnalyticsService('')
      await service.init()

      service.logQuizSessionStarted(makeStartedEvent())

      expect(window.gtag).toBeUndefined()
      expect(window.dataLayer).toBeUndefined()
      expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull()
    })
  })

  describe('measurementId が設定済み', () => {
    it('init で gtag スタブ設置 + config 送信 + gtag.js スクリプトを注入する', async () => {
      const service = createAnalyticsService(TEST_MEASUREMENT_ID)
      await service.init()

      expect(window.gtag).toBeTypeOf('function')
      const layer = (window.dataLayer ?? []) as Array<ArrayLike<unknown>>
      const calls = layer.map((entry) => Array.from(entry))
      expect(calls.some((c) => c[0] === 'config' && c[1] === TEST_MEASUREMENT_ID)).toBe(true)

      const script = document.querySelector<HTMLScriptElement>('script[src*="googletagmanager"]')
      expect(script?.src).toContain(TEST_MEASUREMENT_ID)
    })

    it('二重 init でもスクリプトは 1 つだけ注入される', async () => {
      const service = createAnalyticsService(TEST_MEASUREMENT_ID)
      await service.init()
      await service.init()

      expect(document.querySelectorAll('script[src*="googletagmanager"]')).toHaveLength(1)
    })

    it('logQuizSessionStarted が snake_case パラメータで event を積む', async () => {
      const service = createAnalyticsService(TEST_MEASUREMENT_ID)
      await service.init()

      service.logQuizSessionStarted({ ...makeStartedEvent(), videoTitle: 'タイトル' })

      const [entry] = eventEntries()
      expect(entry[1]).toBe('quiz_session_started')
      expect(entry[2]).toEqual({
        quiz_session_id: 's1',
        quiz_id: 'q1',
        video_id: 'v1',
        video_title: 'タイトル',
        total_questions: 5,
        // 実効設定スナップショット（boolean は 1/0）
        button_check_enabled: 1,
        seek_allowed: 0,
        jump_to_reveal_period: 0,
        hide_video_player_during_answer: 1,
        answer_time_limit: 10,
        max_attempts: 3,
        // テスト実行環境は DEV のため debug_mode が強制付与される
        debug_mode: 1,
      })
    })

    it('logAnswerSubmitted で boolean が 1/0 に変換される', async () => {
      const service = createAnalyticsService(TEST_MEASUREMENT_ID)
      await service.init()

      service.logAnswerSubmitted({
        quizSessionId: 's1',
        quizId: 'q1',
        videoId: 'v1',
        questionIndex: 0,
        attemptIndex: 1,
        answer: 'とうきょう',
        isCorrect: true,
        isFinalAttempt: false,
        submissionType: 'manual',
        timeUntilPressSec: 2.4,
      })

      const [entry] = eventEntries()
      expect(entry[1]).toBe('answer_submitted')
      expect(entry[2]).toMatchObject({
        is_correct: 1,
        is_final_attempt: 0,
        submission_type: 'manual',
        time_until_press_sec: 2.4,
      })
    })

    it('logQuestionAnswered / logQuizSessionCompleted も対応するイベント名で積まれる', async () => {
      const service = createAnalyticsService(TEST_MEASUREMENT_ID)
      await service.init()

      service.logQuestionAnswered({
        quizSessionId: 's1',
        quizId: 'q1',
        videoId: 'v1',
        questionIndex: 0,
        result: 'correct',
        attemptsUsed: 1,
        answers: 'とうきょう',
        timesUntilPressSec: '2.4',
      })
      service.logQuizSessionCompleted({
        quizSessionId: 's1',
        quizId: 'q1',
        videoId: 'v1',
        totalQuestions: 2,
        correctCount: 1,
        incorrectCount: 0,
        skippedCount: 1,
        unansweredCount: 0,
        totalAttempts: 1,
      })

      const names = eventEntries().map((e) => e[1])
      expect(names).toEqual(['question_answered', 'quiz_session_completed'])
    })

    it('logSettingChanged が setting_changed イベントを積む', async () => {
      const service = createAnalyticsService(TEST_MEASUREMENT_ID)
      await service.init()

      service.logSettingChanged({
        quizSessionId: 's1',
        quizId: 'q1',
        videoId: 'v1',
        settingName: 'seek_allowed',
        settingValue: true,
        questionIndex: 2,
      })

      const [entry] = eventEntries()
      expect(entry[1]).toBe('setting_changed')
      expect(entry[2]).toMatchObject({
        setting_name: 'seek_allowed',
        setting_value: 1,
        question_index: 2,
      })
    })

    it('undefined のフィールドはパラメータに含めない', async () => {
      const service = createAnalyticsService(TEST_MEASUREMENT_ID)
      await service.init()

      service.logQuizSessionStarted(makeStartedEvent())

      const [entry] = eventEntries()
      expect(entry[2]).not.toHaveProperty('video_title')
    })

    it('setDebugMode(true) で全イベントに debug_mode: 1 が付く', async () => {
      const service = createAnalyticsService(TEST_MEASUREMENT_ID)
      await service.init()
      service.setDebugMode(true)

      service.logQuizSessionStarted(makeStartedEvent())

      const [entry] = eventEntries()
      expect(entry[2]).toMatchObject({ debug_mode: 1 })
    })

    it('DEV 環境では setDebugMode(false) でも debug_mode が強制付与される（ローカル実行の混入防止）', async () => {
      const service = createAnalyticsService(TEST_MEASUREMENT_ID)
      await service.init()
      service.setDebugMode(false)

      service.logQuizSessionStarted(makeStartedEvent())

      const [entry] = eventEntries()
      expect(entry[2]).toMatchObject({ debug_mode: 1 })
    })

    it('init 前の log* は no-op（イベントを積まない）', async () => {
      const service = createAnalyticsService(TEST_MEASUREMENT_ID)

      service.logQuizSessionStarted(makeStartedEvent())

      expect(window.dataLayer).toBeUndefined()
    })
  })
})

describe('sanitizeAndTruncate', () => {
  it('メールアドレスをマスクする', () => {
    expect(sanitizeAndTruncate('answer test@example.com here')).toBe('answer [masked] here')
  })

  it('電話番号をマスクする', () => {
    expect(sanitizeAndTruncate('03-1234-5678')).toBe('[masked]')
    expect(sanitizeAndTruncate('09012345678')).toBe('[masked]')
  })

  it('URL をマスクする', () => {
    expect(sanitizeAndTruncate('see https://example.com/path')).toBe('see [masked]')
  })

  it('100 文字超は切り詰める', () => {
    const long = 'あ'.repeat(150)
    expect(sanitizeAndTruncate(long)).toHaveLength(ANALYTICS_PARAM_MAX_LENGTH)
  })

  it('通常の解答文字列はそのまま', () => {
    expect(sanitizeAndTruncate('とうきょう')).toBe('とうきょう')
  })
})
