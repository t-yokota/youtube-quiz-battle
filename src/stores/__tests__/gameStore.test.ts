import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useGameStore } from '../gameStore'
import { useDebugStore } from '../debugStore'
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
      debug: false,
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

  it('正解後は解答確定(isFinal)を返す（遷移は controller が担う）', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData())
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    const result = store.handleAnswerSubmit('東京')

    expect(result).toEqual({ isCorrect: true, isFinal: true })
  })

  it('正解後はanswerResultが"correct"になる', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData())
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    store.handleAnswerSubmit('東京')

    expect(store.answerResult).toBe('correct')
  })

  it('正解後もanswerInputは結果表示のため残る（次問題開始でクリア）', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData())
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)
    store.updateAnswerInput('東京')

    store.handleAnswerSubmit('東京')
    expect(store.answerInput).toBe('東京')

    store.initializeForQuestion()
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
    expect(store.answerResult).toBe('incorrect') // リトライ中も不正解表示を維持（Task 21-3）
  })

  it('残り回数がある不正解ではリトライ可能(isFinal=false)を返す', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData(2))
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    const result = store.handleAnswerSubmit('不正解の答え')

    expect(result).toEqual({ isCorrect: false, isFinal: false })
  })

  it('残り回数が0になるとincorrectCountが増加し解答確定(isFinal)を返す', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData(1))
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    const result = store.handleAnswerSubmit('不正解の答え')

    expect(store.incorrectCount).toBe(1)
    expect(store.correctCount).toBe(0)
    expect(result).toEqual({ isCorrect: false, isFinal: true })
  })

  it('残り2回で2回不正解すると2回目で解答確定(isFinal)を返す', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData(2))
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    const first = store.handleAnswerSubmit('不正解1')
    expect(first).toEqual({ isCorrect: false, isFinal: false })

    // 再度ANSWERING状態に入って2回目の解答
    store.transitionToState(GameState.ANSWERING)
    const second = store.handleAnswerSubmit('不正解2')
    expect(store.incorrectCount).toBe(1)
    expect(second).toEqual({ isCorrect: false, isFinal: true })
  })

  it('残り回数がある不正解ではanswerResultがincorrectのまま維持される（Task 21-3）', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData(2))
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    const result = store.handleAnswerSubmit('不正解')

    expect(result).toEqual({ isCorrect: false, isFinal: false })
    expect(store.answerResult).toBe('incorrect')
  })

  it('リトライで正解すると answerResult が correct に上書きされる（Task 21-3）', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData(2))
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    store.handleAnswerSubmit('不正解')
    expect(store.answerResult).toBe('incorrect')

    store.transitionToState(GameState.ANSWERING)
    store.handleAnswerSubmit('東京')
    expect(store.answerResult).toBe('correct')
  })

  it('clearAnswerResult で正誤表示がクリアされる（Task 21-3）', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData(2))
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    store.handleAnswerSubmit('不正解')
    expect(store.answerResult).toBe('incorrect')

    store.clearAnswerResult()
    expect(store.answerResult).toBeNull()
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
      userAnswers: ['東京'],
      skipped: false,
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
      userAnswers: ['間違い'],
      skipped: false,
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
    store.setQuizData(makeQuizData(1))
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    // 1問目: 誤答 → 解答確定（maxAttempts=1なので1回で確定）
    const result = store.handleAnswerSubmit('不正解')
    expect(result).toEqual({ isCorrect: false, isFinal: true })
    expect(store.remainingAttempts).toBe(0)

    // 2問目開始時の初期化
    store.initializeForQuestion()

    expect(store.remainingAttempts).toBe(1)
    expect(store.answerResult).toBeNull()
  })

  it('pendingUserAnswersをクリアする', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData(2))
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)
    store.handleAnswerSubmit('不正解') // pendingUserAnswers に追加される

    store.initializeForQuestion()

    // 次の問題で解答しても前の問題の解答が含まれない
    store.currentQuestionIndex = 1
    store.transitionToState(GameState.ANSWERING)
    store.handleAnswerSubmit('大阪')
    expect(store.results[0].userAnswers).toEqual(['大阪'])
  })
})

// ============================================================================
// handleAnswerSubmit: userAnswers 蓄積（複数回解答）
// ============================================================================

describe('handleAnswerSubmit: userAnswers 蓄積', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('1回正解でuserAnswersに1要素記録される', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData())
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    store.handleAnswerSubmit('東京')

    expect(store.results[0].userAnswers).toEqual(['東京'])
  })

  it('1回不正解→再挑戦で正解の場合、userAnswersに2要素記録される', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData(2))
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    store.handleAnswerSubmit('間違い')
    expect(store.results).toHaveLength(0) // まだ記録されない

    // 再度ANSWERINGに入って正解
    store.transitionToState(GameState.ANSWERING)
    store.handleAnswerSubmit('東京')

    expect(store.results).toHaveLength(1)
    expect(store.results[0].userAnswers).toEqual(['間違い', '東京'])
    expect(store.results[0].isCorrect).toBe(true)
  })

  it('2回不正解でuserAnswersに2要素記録される', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData(2))
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    store.handleAnswerSubmit('間違い1')

    store.transitionToState(GameState.ANSWERING)
    store.handleAnswerSubmit('間違い2')

    expect(store.results).toHaveLength(1)
    expect(store.results[0].userAnswers).toEqual(['間違い1', '間違い2'])
    expect(store.results[0].isCorrect).toBe(false)
  })

  it('タイムアウト（空文字送信）でもuserAnswersに記録される', () => {
    const store = useGameStore()
    store.setQuizData(makeQuizData(1))
    store.currentQuestionIndex = 0
    store.transitionToState(GameState.ANSWERING)

    store.handleAnswerSubmit('') // タイムアウト想定

    expect(store.results[0].userAnswers).toEqual([''])
    expect(store.results[0].skipped).toBe(false)
  })
})

// ============================================================================
// effectiveSettings（Task 29: デバッグモードによるクイズ設定の実行時上書き）
// ============================================================================

function makeDebugQuizData(): QuizData {
  const base = makeQuizData(2)
  return {
    ...base,
    settings: {
      ...base.settings,
      debug: true,
    },
  }
}

describe('effectiveSettings', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('debug=false では debugStore の上書きを無視する', () => {
    const store = useGameStore()
    const debugStore = useDebugStore()
    store.setQuizData(makeQuizData(2)) // debug: false

    debugStore.setAnswerTimeLimitOverride(3)
    debugStore.setMaxAttemptsOverride(1)

    expect(store.effectiveSettings?.answerTimeLimit).toBe(10)
    expect(store.effectiveSettings?.maxAttempts).toBe(2)
  })

  it('debug=true では debugStore の上書きが優先される', () => {
    const store = useGameStore()
    const debugStore = useDebugStore()
    store.setQuizData(makeDebugQuizData())

    debugStore.setAnswerTimeLimitOverride(3)
    debugStore.setMaxAttemptsOverride(1)
    debugStore.setJumpToRevealPeriodOverride(true)
    debugStore.setHideVideoPlayerDuringAnswerOverride(true)

    expect(store.effectiveSettings?.answerTimeLimit).toBe(3)
    expect(store.effectiveSettings?.maxAttempts).toBe(1)
    expect(store.effectiveSettings?.jumpToRevealPeriod).toBe(true)
    expect(store.effectiveSettings?.hideVideoPlayerDuringAnswer).toBe(true)
  })

  it('debug=true かつ上書きなしではデータ本来の値を返す', () => {
    const store = useGameStore()
    store.setQuizData(makeDebugQuizData())

    expect(store.effectiveSettings?.answerTimeLimit).toBe(10)
    expect(store.effectiveSettings?.maxAttempts).toBe(2)
  })

  it('initializeForQuestion で override が反映される（次の問題から）', () => {
    const store = useGameStore()
    const debugStore = useDebugStore()
    store.setQuizData(makeDebugQuizData())

    // 上書き前に問題開始した場合は反映されない
    store.initializeForQuestion()
    expect(store.remainingAttempts).toBe(2)
    expect(store.answerTimeRemaining).toBe(10)

    // 上書き後、次の問題開始で反映される
    debugStore.setAnswerTimeLimitOverride(3)
    debugStore.setMaxAttemptsOverride(1)
    store.initializeForQuestion()

    expect(store.remainingAttempts).toBe(1)
    expect(store.answerTimeRemaining).toBe(3)
  })
})
