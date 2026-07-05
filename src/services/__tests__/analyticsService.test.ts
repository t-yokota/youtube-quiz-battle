import { describe, it, expect, vi, beforeEach } from 'vitest'

// FIREBASE_CONFIG をテストごとに書き換え可能にするため vi.hoisted で共有オブジェクトを用意する
const mockConfig = vi.hoisted(() => ({
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
  measurementId: '',
}))

vi.mock('@/constants/firebase', () => ({
  FIREBASE_CONFIG: mockConfig,
}))

const mockLogEvent = vi.fn()
const mockGetAnalytics = vi.fn(() => ({}))
const mockIsSupported = vi.fn(async () => true)
const mockInitializeApp = vi.fn(() => ({}))

vi.mock('firebase/app', () => ({
  initializeApp: mockInitializeApp,
}))

vi.mock('firebase/analytics', () => ({
  getAnalytics: mockGetAnalytics,
  isSupported: mockIsSupported,
  logEvent: mockLogEvent,
}))

import { createAnalyticsService, sanitizeAndTruncate } from '../analyticsService'

describe('AnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig.measurementId = ''
    mockIsSupported.mockResolvedValue(true)
    mockInitializeApp.mockImplementation(() => ({}))
  })

  describe('measurementId が空（設定なし）', () => {
    it('init後もlog*がlogEventを呼ばない（no-op）', async () => {
      const service = createAnalyticsService()
      await service.init()

      service.logQuizSessionStarted({ quizSessionId: 's1', quizId: 'q1', videoId: 'v1', totalQuestions: 5 })
      service.logAnswerSubmitted({
        quizSessionId: 's1',
        quizId: 'q1',
        videoId: 'v1',
        questionIndex: 0,
        attemptIndex: 1,
        answer: 'answer',
        isCorrect: true,
        isFinalAttempt: true,
        submissionType: 'manual',
        timeUntilPressSec: 1.0,
      })

      expect(mockLogEvent).not.toHaveBeenCalled()
    })
  })

  describe('measurementId が設定済み', () => {
    it('logQuizSessionStartedがsnake_caseパラメータで呼ばれる', async () => {
      mockConfig.measurementId = 'G-TEST'
      const service = createAnalyticsService()
      await service.init()

      service.logQuizSessionStarted({
        quizSessionId: 's1',
        quizId: 'q1',
        videoId: 'v1',
        videoTitle: 'タイトル',
        totalQuestions: 5,
      })

      expect(mockLogEvent).toHaveBeenCalledWith(
        expect.anything(),
        'quiz_session_started',
        expect.objectContaining({
          quiz_session_id: 's1',
          video_id: 'v1',
          video_title: 'タイトル',
          total_questions: 5,
        }),
      )
    })

    it('logAnswerSubmittedでbooleanが1/0に変換される', async () => {
      mockConfig.measurementId = 'G-TEST'
      const service = createAnalyticsService()
      await service.init()

      service.logAnswerSubmitted({
        quizSessionId: 's1',
        quizId: 'q1',
        videoId: 'v1',
        questionIndex: 0,
        attemptIndex: 1,
        answer: 'answer',
        isCorrect: true,
        isFinalAttempt: false,
        submissionType: 'manual',
        timeUntilPressSec: 2.4,
      })

      expect(mockLogEvent).toHaveBeenCalledWith(
        expect.anything(),
        'answer_submitted',
        expect.objectContaining({
          quiz_session_id: 's1',
          video_id: 'v1',
          question_index: 0,
          attempt_index: 1,
          answer: 'answer',
          is_correct: 1,
          is_final_attempt: 0,
          submission_type: 'manual',
          time_until_press_sec: 2.4,
        }),
      )
    })

    it('logQuestionAnsweredとlogQuizSessionCompletedも対応するイベント名で呼ばれる', async () => {
      mockConfig.measurementId = 'G-TEST'
      const service = createAnalyticsService()
      await service.init()

      service.logQuestionAnswered({
        quizSessionId: 's1',
        quizId: 'q1',
        videoId: 'v1',
        questionIndex: 0,
        result: 'correct',
        attemptsUsed: 1,
        answers: '東京',
        timesUntilPressSec: '2.4',
        firstTimeUntilPressSec: 2.4,
      })
      service.logQuizSessionCompleted({
        quizSessionId: 's1',
        quizId: 'q1',
        videoId: 'v1',
        totalQuestions: 5,
        correctCount: 3,
        incorrectCount: 1,
        skippedCount: 0,
        unansweredCount: 1,
        totalAttempts: 4,
      })

      expect(mockLogEvent).toHaveBeenCalledWith(
        expect.anything(),
        'question_answered',
        expect.objectContaining({ result: 'correct', attempts_used: 1 }),
      )
      expect(mockLogEvent).toHaveBeenCalledWith(
        expect.anything(),
        'quiz_session_completed',
        expect.objectContaining({ correct_count: 3, total_attempts: 4 }),
      )
    })

    it('videoTitle未指定時はvideo_titleパラメータを送らない', async () => {
      mockConfig.measurementId = 'G-TEST'
      const service = createAnalyticsService()
      await service.init()

      service.logQuizSessionStarted({ quizSessionId: 's1', quizId: 'q1', videoId: 'v1', totalQuestions: 5 })

      const call = mockLogEvent.mock.calls[0]
      expect(call[2]).not.toHaveProperty('video_title')
    })

    it('debug_mode設定時は全イベントにdebug_mode:1が付与される', async () => {
      mockConfig.measurementId = 'G-TEST'
      const service = createAnalyticsService()
      await service.init()
      service.setDebugMode(true)

      service.logQuizSessionStarted({ quizSessionId: 's1', quizId: 'q1', videoId: 'v1', totalQuestions: 5 })

      expect(mockLogEvent).toHaveBeenCalledWith(
        expect.anything(),
        'quiz_session_started',
        expect.objectContaining({ debug_mode: 1 }),
      )
    })

    it('debug_mode未設定時はdebug_modeパラメータを送らない', async () => {
      mockConfig.measurementId = 'G-TEST'
      const service = createAnalyticsService()
      await service.init()

      service.logQuizSessionStarted({ quizSessionId: 's1', quizId: 'q1', videoId: 'v1', totalQuestions: 5 })

      const call = mockLogEvent.mock.calls[0]
      expect(call[2]).not.toHaveProperty('debug_mode')
    })
  })

  describe('initializing 中のキューイング', () => {
    it('initializing中のlog*はenabled化後にflushされる', async () => {
      mockConfig.measurementId = 'G-TEST'
      let resolveSupported: (value: boolean) => void = () => {}
      mockIsSupported.mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            resolveSupported = resolve
          }),
      )

      const service = createAnalyticsService()
      const initPromise = service.init()

      service.logQuizSessionStarted({ quizSessionId: 's1', quizId: 'q1', videoId: 'v1', totalQuestions: 3 })
      expect(mockLogEvent).not.toHaveBeenCalled()

      // 動的import解決を待ってからisSupportedのresolveを呼ぶ（そうしないと
      // まだ差し替わっていない初期値のresolveSupportedを呼んでしまいハングする）
      await vi.waitFor(() => expect(mockIsSupported).toHaveBeenCalled())
      resolveSupported(true)
      await initPromise

      expect(mockLogEvent).toHaveBeenCalledWith(
        expect.anything(),
        'quiz_session_started',
        expect.objectContaining({ quiz_session_id: 's1' }),
      )
    })

    it('disabled確定でキューが破棄される', async () => {
      mockConfig.measurementId = 'G-TEST'
      let resolveSupported: (value: boolean) => void = () => {}
      mockIsSupported.mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            resolveSupported = resolve
          }),
      )

      const service = createAnalyticsService()
      const initPromise = service.init()

      service.logQuizSessionStarted({ quizSessionId: 's1', quizId: 'q1', videoId: 'v1', totalQuestions: 3 })

      await vi.waitFor(() => expect(mockIsSupported).toHaveBeenCalled())
      resolveSupported(false)
      await initPromise

      service.logQuizSessionStarted({ quizSessionId: 's2', quizId: 'q1', videoId: 'v1', totalQuestions: 3 })

      expect(mockLogEvent).not.toHaveBeenCalled()
    })
  })

  describe('init失敗時の挙動', () => {
    it('isSupportedがfalseの場合、例外にならずdisabledになる', async () => {
      mockConfig.measurementId = 'G-TEST'
      mockIsSupported.mockResolvedValue(false)

      const service = createAnalyticsService()
      await expect(service.init()).resolves.toBeUndefined()

      service.logQuizSessionStarted({ quizSessionId: 's1', quizId: 'q1', videoId: 'v1', totalQuestions: 1 })
      expect(mockLogEvent).not.toHaveBeenCalled()
    })

    it('initializeAppが例外を投げても例外が漏れない', async () => {
      mockConfig.measurementId = 'G-TEST'
      mockInitializeApp.mockImplementation(() => {
        throw new Error('boom')
      })

      const service = createAnalyticsService()
      await expect(service.init()).resolves.toBeUndefined()

      service.logQuizSessionStarted({ quizSessionId: 's1', quizId: 'q1', videoId: 'v1', totalQuestions: 1 })
      expect(mockLogEvent).not.toHaveBeenCalled()
    })
  })

  describe('sanitizeAndTruncate', () => {
    it('メールアドレスをマスクする', () => {
      expect(sanitizeAndTruncate('contact: foo@example.com です')).toBe('contact: [masked] です')
    })

    it('電話番号をマスクする', () => {
      expect(sanitizeAndTruncate('電話: 090-1234-5678')).toBe('電話: [masked]')
    })

    it('URLをマスクする', () => {
      expect(sanitizeAndTruncate('see https://example.com/path?x=1 for details')).toBe(
        'see [masked] for details',
      )
    })

    it('100文字超は切り詰める', () => {
      const long = 'a'.repeat(150)
      expect(sanitizeAndTruncate(long)).toBe('a'.repeat(100))
      expect(sanitizeAndTruncate(long).length).toBe(100)
    })

    it('100文字以内はそのまま返す', () => {
      expect(sanitizeAndTruncate('東京')).toBe('東京')
    })
  })
})
