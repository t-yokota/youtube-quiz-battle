import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useGameStore } from '../../stores/gameStore'
import { GameState } from '@/types'
import type { QuizData } from '@/types'

// ============================================================================
// テスト用データ
// ============================================================================

function makeQuizData(maxAttempts = 2): QuizData {
  return {
    videoId: 'test-video',
    questions: [
      {
        index: 0,
        startTime: 10,
        revealTime: 20,
        endTime: 25,
        answers: ['東京', 'とうきょう'],
      },
      {
        index: 1,
        startTime: 30,
        revealTime: 40,
        endTime: 45,
        answers: ['大阪'],
      },
    ],
    settings: {
      maxAttempts,
      answerTimeLimit: 10,
      disableSeekbar: true,
      jumpToRevealPeriod: false,
      hideVideoPlayerDuringAnswer: false,
    },
  }
}

// ============================================================================
// handleAnswerSubmit: 基本動作
// ============================================================================

describe('handleAnswerSubmit: 基本動作', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('ANSWERING以外の状態では何もしない', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData())
    store.transitionToState(GameState.QUESTIONING)
    store.currentQuestionIndex = 0

    store.handleAnswerSubmit('東京')

    expect(store.correctCount).toBe(0)
    expect(store.currentState).toBe(GameState.QUESTIONING)
  })

  it('ANSWERING状態で正解を送信するとcorrectCountが増加する', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData())
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    store.handleAnswerSubmit('東京')

    expect(store.correctCount).toBe(1)
    expect(store.incorrectCount).toBe(0)
  })

  it('正解後はWAITING状態へ遷移する', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData())
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    store.handleAnswerSubmit('東京')

    expect(store.currentState).toBe(GameState.WAITING)
  })

  it('正解後はanswerResultが"correct"になる', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData())
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    store.handleAnswerSubmit('東京')

    expect(store.answerResult).toBe('correct')
  })

  it('正解後はanswerInputがクリアされる', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData())
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)
    store.updateAnswerInput('東京')

    store.handleAnswerSubmit('東京')

    expect(store.answerInput).toBe('')
  })
})

// ============================================================================
// handleAnswerSubmit: 複数正解パターン
// ============================================================================

describe('handleAnswerSubmit: 複数正解パターン', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('2つ目の正解パターンでも正解と判定される', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData())
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    store.handleAnswerSubmit('とうきょう')

    expect(store.correctCount).toBe(1)
    expect(store.answerResult).toBe('correct')
  })
})

// ============================================================================
// handleAnswerSubmit: 不正解・残り回数管理
// ============================================================================

describe('handleAnswerSubmit: 不正解・残り回数管理', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('不正解でremainingAttemptsが1減る', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData(2))
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    store.handleAnswerSubmit('不正解の答え')

    expect(store.remainingAttempts).toBe(1)
    expect(store.answerResult).toBe('incorrect')
  })

  it('残り回数がある不正解ではANSWERING状態が維持される', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData(2))
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    store.handleAnswerSubmit('不正解の答え')

    expect(store.currentState).toBe(GameState.ANSWERING)
  })

  it('残り回数が0になるとincorrectCountが増加しWAITINGへ遷移する', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData(1))
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    store.handleAnswerSubmit('不正解の答え')

    expect(store.incorrectCount).toBe(1)
    expect(store.correctCount).toBe(0)
    expect(store.currentState).toBe(GameState.WAITING)
  })

  it('残り2回で2回不正解するとWAITINGへ遷移する', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData(2))
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    store.handleAnswerSubmit('不正解1')
    expect(store.currentState).toBe(GameState.ANSWERING)

    store.handleAnswerSubmit('不正解2')
    expect(store.incorrectCount).toBe(1)
    expect(store.currentState).toBe(GameState.WAITING)
  })
})

// ============================================================================
// handleAnswerSubmit: 結果記録（results配列）
// ============================================================================

describe('handleAnswerSubmit: 結果記録', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('正解時にresultsに記録される', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData())
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    store.handleAnswerSubmit('東京')

    expect(store.results).toHaveLength(1)
    expect(store.results[0]).toEqual({
      questionNumber: 1,
      isCorrect: true,
      correctAnswer: '東京',
      userAnswer: '東京',
    })
  })

  it('回数切れ不正解時にresultsに記録される', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData(1))
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    store.handleAnswerSubmit('間違い')

    expect(store.results).toHaveLength(1)
    expect(store.results[0]).toEqual({
      questionNumber: 1,
      isCorrect: false,
      correctAnswer: '東京',
      userAnswer: '間違い',
    })
  })

  it('残り回数がある不正解では結果はまだ記録されない', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData(2))
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    store.handleAnswerSubmit('間違い')

    expect(store.results).toHaveLength(0)
  })

  it('questionNumberは1-indexedで記録される', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData())
    store.currentQuestionIndex = 1
    store.transitionToState(GameState.ANSWERING)

    store.handleAnswerSubmit('大阪')

    expect(store.results[0].questionNumber).toBe(2)
  })
})

// ============================================================================
// initializeForQuestion: 問題開始時の状態初期化
// ============================================================================

describe('initializeForQuestion: 問題開始時の状態初期化', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('remainingAttemptsをquizDataのmaxAttemptsにリセットする', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData(3))
    store.transitionToState(GameState.ANSWERING)
    store.handleAnswerSubmit('不正解') // remainingAttempts を 2 に減らす

    store.initializeForQuestion()

    expect(store.remainingAttempts).toBe(3)
  })

  it('answerResultをnullにリセットする', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData(2))
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)
    store.handleAnswerSubmit('不正解') // answerResult を 'incorrect' にする

    store.initializeForQuestion()

    expect(store.answerResult).toBeNull()
  })

  it('answerInputをクリアする', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData())
    store.updateAnswerInput('入力中')

    store.initializeForQuestion()

    expect(store.answerInput).toBe('')
  })

  it('answerTimeRemainingをquizDataのanswerTimeLimitにリセットする', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData())

    store.initializeForQuestion()

    expect(store.answerTimeRemaining).toBe(10)
  })

  it('1問目で誤答後、2問目のinitializeForQuestionでremainingAttemptsがリセットされる', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData(2))
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    // 1問目: 誤答 → 再入力 → 誤答 → WAITING
    store.handleAnswerSubmit('不正解1')
    store.handleAnswerSubmit('不正解2')
    expect(store.currentState).toBe(GameState.WAITING)
    expect(store.remainingAttempts).toBe(0)

    // 2問目開始時の初期化
    store.initializeForQuestion()

    expect(store.remainingAttempts).toBe(2)
    expect(store.answerResult).toBeNull()
  })
})
