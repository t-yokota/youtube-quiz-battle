import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { extractQuizIdFromUrl, loadQuizData } from '../quizDataLoader'

interface RawQuestion {
  questionNumber?: number
  questionText?: string
  answers?: unknown
  startTime?: unknown
  revealTime?: unknown
  endTime?: unknown
  othersAnsweringPeriods?: unknown
}

interface RawData {
  videoId?: unknown
  quizTitle?: unknown
  settings?: unknown
  questions?: unknown
}

function makeRawData(overrides: Partial<RawData> = {}): RawData {
  return {
    videoId: 'sample',
    settings: {
      maxAttempts: 3,
      answerTimeLimit: 10,
    },
    questions: [
      {
        questionNumber: 1,
        answers: ['東京'],
        startTime: 0,
        revealTime: 5,
        endTime: 10,
      },
    ],
    ...overrides,
  }
}

function makeRawQuestion(overrides: Partial<RawQuestion> = {}): RawQuestion {
  return {
    questionNumber: 1,
    answers: ['東京'],
    startTime: 0,
    revealTime: 5,
    endTime: 10,
    ...overrides,
  }
}

function mockFetchOk(data: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => data,
    })),
  )
}

function mockFetchError(status: number): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: false,
      status,
      json: async () => ({}),
    })),
  )
}

describe('extractQuizIdFromUrl', () => {
  let originalSearch: string

  beforeEach(() => {
    originalSearch = window.location.search
  })

  afterEach(() => {
    window.history.replaceState({}, '', `${window.location.pathname}${originalSearch}`)
  })

  it('?quiz=<id> 形式から quizId を抽出する', () => {
    window.history.replaceState({}, '', '?quiz=abc123')
    expect(extractQuizIdFromUrl()).toBe('abc123')
  })

  it('クエリパラメータがなければ sample を返す', () => {
    window.history.replaceState({}, '', '/')
    expect(extractQuizIdFromUrl()).toBe('sample')
  })

  it('関連しないクエリのみのときは sample を返す', () => {
    window.history.replaceState({}, '', '?other=1')
    expect(extractQuizIdFromUrl()).toBe('sample')
  })
})

describe('loadQuizData: 正常系（JSON→内部型の変換契約）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('JSON のキーを内部型にマップする（videoId, settings, questions）', async () => {
    mockFetchOk(makeRawData())
    const result = await loadQuizData('sample')

    expect(result.videoId).toBe('sample')
    expect(result.questions).toHaveLength(1)
    expect(result.settings.maxAttempts).toBe(3)
    expect(result.settings.answerTimeLimit).toBe(10)
  })

  it('questionNumber（1-indexed）から index（0-indexed）に変換される', async () => {
    mockFetchOk(
      makeRawData({
        questions: [
          makeRawQuestion({ questionNumber: 1, startTime: 0, revealTime: 5, endTime: 10 }),
          makeRawQuestion({ questionNumber: 2, startTime: 11, revealTime: 15, endTime: 20 }),
        ],
      }),
    )
    const result = await loadQuizData('sample')

    expect(result.questions[0].index).toBe(0)
    expect(result.questions[1].index).toBe(1)
  })

  it('questionNumber 省略時も index は配列順で割り当てられる', async () => {
    mockFetchOk(
      makeRawData({
        questions: [
          makeRawQuestion({ questionNumber: undefined, startTime: 0, revealTime: 5, endTime: 10 }),
          makeRawQuestion({
            questionNumber: undefined,
            startTime: 11,
            revealTime: 15,
            endTime: 20,
          }),
        ],
      }),
    )
    const result = await loadQuizData('sample')

    expect(result.questions[0].index).toBe(0)
    expect(result.questions[1].index).toBe(1)
  })

  it('settings の任意フィールドが省略時に既定値で補完される', async () => {
    mockFetchOk(makeRawData())
    const result = await loadQuizData('sample')

    expect(result.settings.disableSeekbar).toBe(true)
    expect(result.settings.jumpToRevealPeriod).toBe(false)
    expect(result.settings.hideVideoPlayerDuringAnswer).toBe(false)
  })

  it('settings の任意フィールドが指定されている場合はその値を保持する', async () => {
    mockFetchOk(
      makeRawData({
        settings: {
          maxAttempts: 3,
          answerTimeLimit: 10,
          disableSeekbar: false,
          jumpToRevealPeriod: true,
          hideVideoPlayerDuringAnswer: true,
        },
      }),
    )
    const result = await loadQuizData('sample')

    expect(result.settings.disableSeekbar).toBe(false)
    expect(result.settings.jumpToRevealPeriod).toBe(true)
    expect(result.settings.hideVideoPlayerDuringAnswer).toBe(true)
  })

  it('othersAnsweringPeriods が保持される', async () => {
    mockFetchOk(
      makeRawData({
        questions: [
          makeRawQuestion({
            othersAnsweringPeriods: [{ startTime: 1, endTime: 2 }],
          }),
        ],
      }),
    )
    const result = await loadQuizData('sample')

    expect(result.questions[0].othersAnsweringPeriods).toEqual([{ startTime: 1, endTime: 2 }])
  })

  it('quizId と data.videoId は独立している（一致不要）', async () => {
    mockFetchOk(makeRawData({ videoId: 'someVideoId' }))
    const result = await loadQuizData('my-quiz')

    expect(result.videoId).toBe('someVideoId')
  })

  it('quizId から data/<quizId>/data.json の URL を組み立てる', async () => {
    const data = makeRawData()
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => data }))
    vi.stubGlobal('fetch', fetchMock)
    await loadQuizData('my-quiz')

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('data/my-quiz/data.json'))
  })
})

describe('loadQuizData: HTTP エラー', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('404 のときは QUIZ_DATA_NOT_FOUND を投げる', async () => {
    mockFetchError(404)
    await expect(loadQuizData('sample')).rejects.toThrow('QUIZ_DATA_NOT_FOUND')
  })

  it('その他のエラーステータスは QUIZ_DATA_LOAD_FAILED を投げる', async () => {
    mockFetchError(500)
    await expect(loadQuizData('sample')).rejects.toThrow('QUIZ_DATA_LOAD_FAILED')
  })
})

describe('loadQuizData: withRetry 統合（ネットワークエラーからの復旧）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('fetch が TypeError を2回投げた後に成功すればリトライして読み込みに成功する', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeRawData(),
      })
    vi.stubGlobal('fetch', fetchMock)

    const promise = loadQuizData('sample')

    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)

    const result = await promise
    expect(result.videoId).toBe('sample')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('404（QUIZ_DATA_NOT_FOUND）は復旧不可能エラーのためリトライされず fetch は1回のみ', async () => {
    mockFetchError(404)
    await expect(loadQuizData('sample')).rejects.toThrow('QUIZ_DATA_NOT_FOUND')
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })
})

describe('loadQuizData: バリデーション（必須フィールド・スキーマ）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('videoId が欠落していたらエラー', async () => {
    mockFetchOk(makeRawData({ videoId: undefined }))
    await expect(loadQuizData('sample')).rejects.toThrow(/Missing videoId/)
  })

  it('questions が配列でなければエラー', async () => {
    mockFetchOk(makeRawData({ questions: 'not-array' }))
    await expect(loadQuizData('sample')).rejects.toThrow(/Missing or invalid questions array/)
  })

  it('questions が空配列ならエラー', async () => {
    mockFetchOk(makeRawData({ questions: [] }))
    await expect(loadQuizData('sample')).rejects.toThrow(/Questions array is empty/)
  })

  it('slug 形式でない quizId は fetch せずに QUIZ_DATA_NOT_FOUND', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(loadQuizData('../etc')).rejects.toThrow('QUIZ_DATA_NOT_FOUND')
    await expect(loadQuizData('UPPER')).rejects.toThrow('QUIZ_DATA_NOT_FOUND')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('settings が欠落していたらエラー', async () => {
    mockFetchOk(makeRawData({ settings: undefined }))
    await expect(loadQuizData('sample')).rejects.toThrow(/Missing settings/)
  })

  it('settings.answerTimeLimit が数値でなければエラー', async () => {
    mockFetchOk(
      makeRawData({ settings: { maxAttempts: 3, answerTimeLimit: 'x' } as unknown as object }),
    )
    await expect(loadQuizData('sample')).rejects.toThrow(/Invalid answerTimeLimit/)
  })

  it('settings.answerTimeLimit が 0 以下ならエラー', async () => {
    mockFetchOk(makeRawData({ settings: { maxAttempts: 3, answerTimeLimit: 0 } }))
    await expect(loadQuizData('sample')).rejects.toThrow(/Invalid answerTimeLimit/)
  })

  it('settings.maxAttempts が数値でなければエラー', async () => {
    mockFetchOk(
      makeRawData({ settings: { maxAttempts: 'x', answerTimeLimit: 10 } as unknown as object }),
    )
    await expect(loadQuizData('sample')).rejects.toThrow(/Invalid maxAttempts/)
  })

  it('settings.maxAttempts が 0 以下ならエラー', async () => {
    mockFetchOk(makeRawData({ settings: { maxAttempts: 0, answerTimeLimit: 10 } }))
    await expect(loadQuizData('sample')).rejects.toThrow(/Invalid maxAttempts/)
  })
})

describe('loadQuizData: バリデーション（各 question の中身）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('answers が空配列ならエラー', async () => {
    mockFetchOk(makeRawData({ questions: [makeRawQuestion({ answers: [] })] }))
    await expect(loadQuizData('sample')).rejects.toThrow(/Question 1 has invalid answers/)
  })

  it('answers が配列でなければエラー', async () => {
    mockFetchOk(makeRawData({ questions: [makeRawQuestion({ answers: 'foo' })] }))
    await expect(loadQuizData('sample')).rejects.toThrow(/Question 1 has invalid answers/)
  })

  it('answers に空文字列が含まれていればエラー', async () => {
    mockFetchOk(makeRawData({ questions: [makeRawQuestion({ answers: ['東京', ''] })] }))
    await expect(loadQuizData('sample')).rejects.toThrow(/Question 1 has empty answer/)
  })

  it('answers に空白のみの文字列が含まれていればエラー', async () => {
    mockFetchOk(makeRawData({ questions: [makeRawQuestion({ answers: ['東京', '   '] })] }))
    await expect(loadQuizData('sample')).rejects.toThrow(/Question 1 has empty answer/)
  })

  it('startTime が負値ならエラー', async () => {
    mockFetchOk(makeRawData({ questions: [makeRawQuestion({ startTime: -1 })] }))
    await expect(loadQuizData('sample')).rejects.toThrow(/Question 1 has invalid startTime/)
  })

  it('startTime が数値でなければエラー', async () => {
    mockFetchOk(makeRawData({ questions: [makeRawQuestion({ startTime: 'x' })] }))
    await expect(loadQuizData('sample')).rejects.toThrow(/Question 1 has invalid startTime/)
  })

  it('revealTime が負値ならエラー', async () => {
    mockFetchOk(makeRawData({ questions: [makeRawQuestion({ revealTime: -1 })] }))
    await expect(loadQuizData('sample')).rejects.toThrow(/Question 1 has invalid revealTime/)
  })

  it('endTime が負値ならエラー', async () => {
    mockFetchOk(makeRawData({ questions: [makeRawQuestion({ endTime: -1 })] }))
    await expect(loadQuizData('sample')).rejects.toThrow(/Question 1 has invalid endTime/)
  })

  it('startTime < revealTime < endTime を満たさなければエラー', async () => {
    mockFetchOk(
      makeRawData({
        questions: [makeRawQuestion({ startTime: 5, revealTime: 5, endTime: 10 })],
      }),
    )
    await expect(loadQuizData('sample')).rejects.toThrow(/invalid time sequence/)
  })

  it('othersAnsweringPeriods の startTime/endTime が数値でなければエラー', async () => {
    mockFetchOk(
      makeRawData({
        questions: [
          makeRawQuestion({
            othersAnsweringPeriods: [{ startTime: 1, endTime: 'x' }],
          }),
        ],
      }),
    )
    await expect(loadQuizData('sample')).rejects.toThrow(/has invalid time/)
  })

  it('othersAnsweringPeriods の startTime >= endTime ならエラー', async () => {
    mockFetchOk(
      makeRawData({
        questions: [
          makeRawQuestion({
            othersAnsweringPeriods: [{ startTime: 3, endTime: 3 }],
          }),
        ],
      }),
    )
    await expect(loadQuizData('sample')).rejects.toThrow(/has startTime >= endTime/)
  })

  it('othersAnsweringPeriods が question 区間（startTime〜revealTime）を超えていればエラー', async () => {
    mockFetchOk(
      makeRawData({
        questions: [
          makeRawQuestion({
            startTime: 0,
            revealTime: 5,
            endTime: 10,
            othersAnsweringPeriods: [{ startTime: 1, endTime: 6 }],
          }),
        ],
      }),
    )
    await expect(loadQuizData('sample')).rejects.toThrow(/is outside question period/)
  })

  it('othersAnsweringPeriods の複数期間が重複していればエラー', async () => {
    mockFetchOk(
      makeRawData({
        questions: [
          makeRawQuestion({
            startTime: 0,
            revealTime: 5,
            endTime: 10,
            othersAnsweringPeriods: [
              { startTime: 1, endTime: 3 },
              { startTime: 2, endTime: 4 },
            ],
          }),
        ],
      }),
    )
    await expect(loadQuizData('sample')).rejects.toThrow(/overlapping othersAnsweringPeriods/)
  })

  it('othersAnsweringPeriods の複数期間で end == 次の start は許容される（境界値）', async () => {
    mockFetchOk(
      makeRawData({
        questions: [
          makeRawQuestion({
            startTime: 0,
            revealTime: 5,
            endTime: 10,
            othersAnsweringPeriods: [
              { startTime: 1, endTime: 2 },
              { startTime: 2, endTime: 3 },
            ],
          }),
        ],
      }),
    )
    const result = await loadQuizData('sample')
    expect(result.questions[0].othersAnsweringPeriods).toHaveLength(2)
  })
})

describe('loadQuizData: バリデーション（QUIZ 区間の被り）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('連続する question で endTime > 次の startTime ならエラー', async () => {
    mockFetchOk(
      makeRawData({
        questions: [
          makeRawQuestion({ questionNumber: 1, startTime: 0, revealTime: 5, endTime: 10 }),
          makeRawQuestion({ questionNumber: 2, startTime: 9, revealTime: 12, endTime: 15 }),
        ],
      }),
    )
    await expect(loadQuizData('sample')).rejects.toThrow(/overlapping time periods/)
  })

  it('endTime == 次の startTime は許容される（境界値）', async () => {
    mockFetchOk(
      makeRawData({
        questions: [
          makeRawQuestion({ questionNumber: 1, startTime: 0, revealTime: 5, endTime: 10 }),
          makeRawQuestion({ questionNumber: 2, startTime: 10, revealTime: 15, endTime: 20 }),
        ],
      }),
    )
    const result = await loadQuizData('sample')
    expect(result.questions).toHaveLength(2)
  })
})

describe('loadQuizData: questionNumber と配列順の整合性', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('questionNumber が配列インデックス + 1 と不一致ならエラー', async () => {
    mockFetchOk(
      makeRawData({
        questions: [
          makeRawQuestion({ questionNumber: 5, startTime: 0, revealTime: 5, endTime: 10 }),
        ],
      }),
    )
    await expect(loadQuizData('sample')).rejects.toThrow(/questionNumber mismatch/)
  })
})
