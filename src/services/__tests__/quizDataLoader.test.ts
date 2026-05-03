import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { extractVideoIdFromUrl, loadQuizData } from '../quizDataLoader'

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

describe('extractVideoIdFromUrl', () => {
  let originalSearch: string

  beforeEach(() => {
    originalSearch = window.location.search
  })

  afterEach(() => {
    window.history.replaceState({}, '', `${window.location.pathname}${originalSearch}`)
  })

  it('?v=<id> 形式から videoId を抽出する', () => {
    window.history.replaceState({}, '', '?v=abc123')
    expect(extractVideoIdFromUrl()).toBe('abc123')
  })

  it('?video=<id> 形式から videoId を抽出する', () => {
    window.history.replaceState({}, '', '?video=xyz789')
    expect(extractVideoIdFromUrl()).toBe('xyz789')
  })

  it('?v= と ?video= が両方あるときは v= を優先する', () => {
    window.history.replaceState({}, '', '?v=foo&video=bar')
    expect(extractVideoIdFromUrl()).toBe('foo')
  })

  it('クエリパラメータがなければ null を返す', () => {
    window.history.replaceState({}, '', '/')
    expect(extractVideoIdFromUrl()).toBeNull()
  })

  it('関連しないクエリのみのときは null を返す', () => {
    window.history.replaceState({}, '', '?other=1')
    expect(extractVideoIdFromUrl()).toBeNull()
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

  it('expectedVideoId が "sample" 以外でも data.videoId と一致すれば成功する', async () => {
    mockFetchOk(makeRawData({ videoId: 'realId' }))
    const result = await loadQuizData('realId')

    expect(result.videoId).toBe('realId')
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

  it('expectedVideoId と data.videoId が不一致ならエラー（sample 以外）', async () => {
    mockFetchOk(makeRawData({ videoId: 'A' }))
    await expect(loadQuizData('B')).rejects.toThrow(/Video ID mismatch/)
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
