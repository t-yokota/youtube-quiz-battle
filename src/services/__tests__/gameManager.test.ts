import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { GameManager, createGameManager } from '../gameManager'
import { useGameStore } from '@/stores/gameStore'
import { GameState, ButtonState } from '@/types'
import type { QuizData, YouTubePlayerManager } from '@/types'
import { YouTubePlayerState } from '@/types'
import { STALL_WALL_MS, STALL_VIDEO_DELTA_SEC } from '@/constants/timing'

// ============================================================================
// テスト用データ・ヘルパー
// ============================================================================

/**
 * テスト用クイズデータ生成
 * Q1: start=10, reveal=20, end=25
 * Q2: start=30, reveal=40, end=45 (othersAnsweringPeriods: 32-35)
 */
function makeQuizData(overrides?: Partial<QuizData['settings']>): QuizData {
  return {
    videoId: 'test-video',
    questions: [
      {
        index: 0,
        startTime: 10,
        revealTime: 20,
        endTime: 25,
        answers: ['東京'],
      },
      {
        index: 1,
        startTime: 30,
        revealTime: 40,
        endTime: 45,
        answers: ['大阪'],
        othersAnsweringPeriods: [{ startTime: 32, endTime: 35 }],
      },
    ],
    settings: {
      maxAttempts: 3,
      answerTimeLimit: 10,
      disableSeekbar: true,
      jumpToRevealPeriod: false,
      hideVideoPlayerDuringAnswer: false,
      ...overrides,
    },
  }
}

/**
 * 複数閾値走査専用クイズデータ
 * Q1: start=10.0, reveal=10.4, end=10.8（0.8s幅）
 * Q2: start=20.0, reveal=20.4, end=20.8
 * SEEK_TOLERANCE_SEC=1.0 以内のティックで複数閾値を跨げる
 */
function makeMultiThresholdQuizData(): QuizData {
  return {
    videoId: 'test-video',
    questions: [
      { index: 0, startTime: 10.0, revealTime: 10.4, endTime: 10.8, answers: ['A'] },
      { index: 1, startTime: 20.0, revealTime: 20.4, endTime: 20.8, answers: ['B'] },
    ],
    settings: {
      maxAttempts: 3,
      answerTimeLimit: 10,
      disableSeekbar: true,
      jumpToRevealPeriod: false,
      hideVideoPlayerDuringAnswer: false,
    },
  }
}

/**
 * YouTubePlayerManager のモック生成
 */
function makePlayerMock(): YouTubePlayerManager {
  return {
    loadVideo: vi.fn(),
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    seekTo: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
    getDuration: vi.fn(() => 60),
    getPlayerState: vi.fn(() => YouTubePlayerState.PLAYING),
    onStateChange: vi.fn(),
    destroy: vi.fn(),
  }
}

/**
 * GameManager を作成し、store・player も返す
 */
function makeGameManager(quizData?: QuizData, playerMock?: YouTubePlayerManager) {
  const store = useGameStore()
  const quiz = quizData ?? makeQuizData()
  const player = playerMock ?? makePlayerMock()
  store.setQuizData(quiz)
  const gm = createGameManager(player, quiz, store)
  return { gm, store, player }
}

/**
 * 動画再生をシミュレート（0.15s刻みで to まで進める）
 * シーク検出（1秒超ジャンプ）を回避するために小刻みに進める
 */
function simulatePlayback(gm: GameManager, to: number, from = 0, step = 0.15) {
  let t = from + step
  while (t < to) {
    gm.updateVideoTime(t)
    t += step
  }
  gm.updateVideoTime(to)
}

// ============================================================================
// セットアップ
// ============================================================================

beforeEach(() => {
  setActivePinia(createPinia())
  vi.restoreAllMocks()
  // document.hidden をリセット
  Object.defineProperty(document, 'hidden', { value: false, configurable: true })
})

// ============================================================================
// 基本的な状態遷移
// ============================================================================

describe('状態遷移（時間経過起点）', () => {
  it('startTime 到達で QUESTIONING に遷移する', () => {
    const { gm, store } = makeGameManager()
    simulatePlayback(gm, 10.1)
    expect(store.currentState).toBe(GameState.QUESTIONING)
  })

  it('startTime ちょうどで QUESTIONING に遷移する（境界値）', () => {
    const { gm, store } = makeGameManager()
    simulatePlayback(gm, 10.0)
    expect(store.currentState).toBe(GameState.QUESTIONING)
  })

  it('startTime 到達前は状態変化しない', () => {
    const { gm, store } = makeGameManager()
    simulatePlayback(gm, 9.9)
    expect(store.currentState).toBe(GameState.LOADING)
  })

  it('revealTime 到達で REVEALING に遷移する', () => {
    const { gm, store } = makeGameManager()
    simulatePlayback(gm, 20.1)
    expect(store.currentState).toBe(GameState.REVEALING)
  })

  it('revealTime ちょうどで REVEALING に遷移する（境界値）', () => {
    const { gm, store } = makeGameManager()
    simulatePlayback(gm, 20.0)
    expect(store.currentState).toBe(GameState.REVEALING)
  })

  it('Q1 endTime 到達で TALKING に遷移する（次の問題あり）', () => {
    const { gm, store } = makeGameManager()
    simulatePlayback(gm, 25.1)
    expect(store.currentState).toBe(GameState.TALKING)
  })

  it('Q1 endTime ちょうどで TALKING に遷移する（境界値）', () => {
    const { gm, store } = makeGameManager()
    simulatePlayback(gm, 25.0)
    expect(store.currentState).toBe(GameState.TALKING)
  })

  it('最後の問題の endTime 到達で FINISHED に遷移する', () => {
    const { gm, store } = makeGameManager()
    simulatePlayback(gm, 45.1)
    expect(store.currentState).toBe(GameState.FINISHED)
  })
})

// ============================================================================
// OthersAnsweringPeriods
// ============================================================================

describe('OthersAnsweringPeriods', () => {
  it('期間開始で WAITING に遷移する', () => {
    const { gm, store } = makeGameManager()
    // Q2.start=30 → QUESTIONING、othersAnsweringPeriods.start=32 → WAITING
    simulatePlayback(gm, 32.1)
    expect(store.currentState).toBe(GameState.WAITING)
  })

  it('othersAnsweringPeriod の startTime ちょうどで WAITING に遷移する（境界値）', () => {
    const { gm, store } = makeGameManager()
    simulatePlayback(gm, 32.0)
    expect(store.currentState).toBe(GameState.WAITING)
  })

  it('期間終了で QUESTIONING に復帰する', () => {
    const { gm, store } = makeGameManager()
    simulatePlayback(gm, 35.1)
    expect(store.currentState).toBe(GameState.QUESTIONING)
  })

  it('othersAnsweringPeriod の endTime ちょうどで QUESTIONING に復帰する（境界値）', () => {
    const { gm, store } = makeGameManager()
    simulatePlayback(gm, 35.0)
    expect(store.currentState).toBe(GameState.QUESTIONING)
  })
})

// ============================================================================
// 1ティック内の複数閾値走査 (prev, curr] 窓
// ============================================================================

describe('(prev, curr] 窓での複数閾値走査', () => {
  it('1ティックで startTime と revealTime を同時に跨いだ場合は REVEALING に遷移する', () => {
    // Q1: start=10.0, reveal=10.4, end=10.8
    // prev=9.9 → curr=10.5 (差0.6 ≤ 1.0, シーク未検出): start(10.0) と reveal(10.4) を同時に跨ぐ
    const { gm, store } = makeGameManager(makeMultiThresholdQuizData())
    simulatePlayback(gm, 9.9) // prev=9.9, seek 未検出
    gm.updateVideoTime(10.5) // (9.9, 10.5]: start(10.0) と reveal(10.4) を含む
    expect(store.currentState).toBe(GameState.REVEALING)
  })

  it('1ティックで start/reveal/end を同時に跨いだ場合は TALKING に遷移する', () => {
    // prev=9.9 → curr=10.9 (差1.0, NOT > 1.0, シーク未検出): 3閾値すべてを跨ぐ
    const { gm, store } = makeGameManager(makeMultiThresholdQuizData())
    simulatePlayback(gm, 9.9)
    gm.updateVideoTime(10.9) // (9.9, 10.9]: start(10.0), reveal(10.4), end(10.8) を含む
    expect(store.currentState).toBe(GameState.TALKING)
  })
})

// ============================================================================
// Single-Shot Guard（consumedフラグの一回性）
// ============================================================================

describe('Single-Shot Guard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('startTime を 2 回通過してもスキップ済みとして WAITING になる（disableSeekbar=false）', () => {
    const { gm, store } = makeGameManager(makeQuizData({ disableSeekbar: false }))

    // Q1 通常再生: start(10) と reveal(20) を消費 → REVEALING
    simulatePlayback(gm, 20.1)
    expect(store.currentState).toBe(GameState.REVEALING)

    // 後方シーク: prev=20.1（Q1区間内: 10-25）→ Q1 を消費済みにして TALKING
    // シーク先(9.0)はQ1区間外なのでTALKING
    gm.updateVideoTime(9.0)
    expect(store.currentState).toBe(GameState.TALKING)

    // startTime(10) を再通過: consumed.start=true → WAITING（スキップ）
    simulatePlayback(gm, 10.1, 9.0)
    expect(store.currentState).toBe(GameState.WAITING)
  })

  it('revealTime を 2 回通過すると REVEALING に遷移する（副作用なし）', () => {
    const { gm, store } = makeGameManager(makeQuizData({ disableSeekbar: false }))

    // Q1 通常再生: start/reveal 消費
    simulatePlayback(gm, 20.1)
    expect(store.currentState).toBe(GameState.REVEALING)

    // 後方シーク (prev=20.1 が Q1区間内 → consumed 維持) → TALKING（シーク先が問題区間外）
    gm.updateVideoTime(9.0)

    // Q1 消費済みの状態で revealTime を再通過 → 副作用なしで REVEALING へ
    simulatePlayback(gm, 20.1, 9.0)
    expect(store.currentState).toBe(GameState.REVEALING)
  })

  it('前方シークで飛ばした問題がスキップとしてresultsに記録される（disableSeekbar=false）', () => {
    const { gm, store } = makeGameManager(makeQuizData({ disableSeekbar: false }))

    // Q1(start=10, end=25) を丸ごと飛び越える前方シーク
    simulatePlayback(gm, 5.0)
    gm.updateVideoTime(27.0) // |27.0 - 5.0| = 22.0 > 1.0 → シーク検出

    // Q1がスキップとして結果に記録されている
    const q1Result = store.results.find((r) => r.questionNumber === 1)
    expect(q1Result).toBeDefined()
    expect(q1Result!.skipped).toBe(true)
    expect(q1Result!.isCorrect).toBe(false)
    expect(q1Result!.userAnswers).toEqual([])
  })

  it('一部の問題だけ飛ばした場合はTALKINGに遷移する（disableSeekbar=false）', () => {
    const { gm, store } = makeGameManager(makeQuizData({ disableSeekbar: false }))

    // Q1(10-25)だけ飛び越え、Q2(30-45)の手前に着地
    simulatePlayback(gm, 5.0)
    gm.updateVideoTime(27.0)

    expect(store.results).toHaveLength(1)
    expect(store.results[0].skipped).toBe(true)
    // Q2がまだ残っているが問題区間外なのでTALKING
    expect(store.currentState).toBe(GameState.TALKING)
  })

  it('前方シークで複数問題を飛ばすと全てresultsに記録される（disableSeekbar=false）', () => {
    const { gm, store } = makeGameManager(makeQuizData({ disableSeekbar: false }))

    // Q1(10-25)とQ2(30-45)を両方飛び越える
    simulatePlayback(gm, 5.0)
    gm.updateVideoTime(46.0)

    expect(store.results).toHaveLength(2)
    expect(store.results[0].questionNumber).toBe(1)
    expect(store.results[0].skipped).toBe(true)
    expect(store.results[1].questionNumber).toBe(2)
    expect(store.results[1].skipped).toBe(true)

    // 全問飛ばしたのでFINISHED状態へ遷移
    expect(store.currentState).toBe(GameState.FINISHED)
  })

  it('問題区間外へのシークではTALKINGに遷移する（disableSeekbar=false）', () => {
    const { gm, store } = makeGameManager(makeQuizData({ disableSeekbar: false }))

    // Q1(10-25)手前の区間内でシーク（5→8）: 問題を跨がない
    simulatePlayback(gm, 5.0)
    gm.updateVideoTime(8.0) // |8 - 5| = 3.0 > 1.0 → シーク検出

    expect(store.results).toHaveLength(0)
    expect(store.currentState).toBe(GameState.TALKING)
  })

  it('全問シークで最終問題のendTimeちょうどに着地するとFINISHEDに遷移する（disableSeekbar=false）', () => {
    const { gm, store } = makeGameManager(makeQuizData({ disableSeekbar: false }))

    // 全問を飛び越え、最終問題のendTime(45)ちょうどに着地
    simulatePlayback(gm, 5.0)
    gm.updateVideoTime(45.0)

    expect(store.results).toHaveLength(2)
    expect(store.currentState).toBe(GameState.FINISHED)
  })

  it('消費済み問題区間内へのシークではTALKINGに遷移する（disableSeekbar=false）', () => {
    const { gm, store } = makeGameManager(makeQuizData({ disableSeekbar: false }))

    // Q1(10-25)を通常再生で通過し、Q2(30-45)手前の27に到達
    simulatePlayback(gm, 27.0)
    expect(store.results).toHaveLength(1) // Q1は通常再生で結果記録済み

    // Q2の区間内（35）へシーク: Q2はシークにより消費される
    gm.updateVideoTime(35.0) // |35 - 27| = 8.0 > 1.0 → シーク検出

    expect(store.results).toHaveLength(2) // Q1(通常) + Q2(スキップ)
    expect(store.currentState).toBe(GameState.TALKING)
  })

  it('解答中に前方シークすると解答履歴は現在の問題にのみ紐付く（disableSeekbar=false）', () => {
    const { gm, store } = makeGameManager(makeQuizData({ disableSeekbar: false, maxAttempts: 3 }))

    // Q1 start(10)通過 → QUESTIONING → ボタン → ANSWERING → 不正解
    simulatePlayback(gm, 11, 0)
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)
    gm.handleAnswerSubmit('間違い')
    // QUESTIONING状態（残り2回）

    // Q1とQ2を飛び越える前方シーク
    gm.updateVideoTime(46.0)

    // Q1: currentQuestionなので解答履歴が紐付く
    const q1 = store.results.find((r) => r.questionNumber === 1)
    expect(q1).toBeDefined()
    expect(q1!.userAnswers).toEqual(['間違い'])
    expect(q1!.skipped).toBe(false)

    // Q2: 別の問題なので解答履歴なし、スキップ扱い
    const q2 = store.results.find((r) => r.questionNumber === 2)
    expect(q2).toBeDefined()
    expect(q2!.userAnswers).toEqual([])
    expect(q2!.skipped).toBe(true)

    // incorrectCountはQ1の1回のみ
    expect(store.incorrectCount).toBe(1)
  })

  it('ANSWERING中のシークは元の位置に戻されて解答が続行する（disableSeekbar=false）', () => {
    const { gm, store, player } = makeGameManager(makeQuizData({ disableSeekbar: false }))

    // Q1 start(10)通過 → QUESTIONING → ボタン → ANSWERING
    simulatePlayback(gm, 11, 0)
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)
    expect(store.currentState).toBe(GameState.ANSWERING)

    // ANSWERING中にシークを試みる（11 → 46）
    gm.updateVideoTime(46.0)

    // シークが戻されてANSWERING状態が維持される
    expect(store.currentState).toBe(GameState.ANSWERING)
    expect(player.seekTo).toHaveBeenCalledWith(11)

    // 問題は消費されていない
    expect(store.results).toHaveLength(0)

    // カウントダウンは継続中 — 解答できる
    gm.handleAnswerSubmit('東京')
    expect(store.results).toHaveLength(1)
    expect(store.results[0].isCorrect).toBe(true)
  })

  it('ANSWERING中にシーク後に解答してもjumpToRevealPeriodが正しく動作する（disableSeekbar=false）', () => {
    const { gm, store, player } = makeGameManager(
      makeQuizData({ disableSeekbar: false, jumpToRevealPeriod: true }),
    )

    // Q1 start(10)通過 → QUESTIONING → ボタン → ANSWERING
    simulatePlayback(gm, 11, 0)
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)
    expect(store.currentState).toBe(GameState.ANSWERING)

    // ANSWERING中にシークを試みる（11 → 46）→ 強制リセット
    gm.updateVideoTime(46.0)
    expect(store.currentState).toBe(GameState.ANSWERING)

    // 正解を送信 → revealTimeにジャンプ → REVEALING
    gm.handleAnswerSubmit('東京')
    expect(store.currentState).toBe(GameState.REVEALING)
    // revealTime(20)にシークされている
    expect(player.seekTo).toHaveBeenCalledWith(20)
  })

  it('リトライのボタン押下で前回の不正解表示がクリアされる（Task 21-3）', () => {
    const { gm, store } = makeGameManager(makeQuizData({ maxAttempts: 3 }))

    // Q1 start(10)通過 → QUESTIONING → ボタン → ANSWERING → 不正解
    simulatePlayback(gm, 11, 0)
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)
    gm.handleAnswerSubmit('不正解')
    expect(store.currentState).toBe(GameState.QUESTIONING)
    expect(store.answerResult).toBe('incorrect') // リトライ中は表示維持

    // 再度ボタン押下（解答アクション開始）→ 表示クリア
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)
    expect(store.currentState).toBe(GameState.ANSWERING)
    expect(store.answerResult).toBeNull()
  })

  it('正解時は WAITING を経由せず直接 REVEALING へ遷移する（jumpToRevealPeriod=true・ちらつき解消）', () => {
    const { gm, store } = makeGameManager(makeQuizData({ jumpToRevealPeriod: true }))

    // Q1 start(10)通過 → QUESTIONING → ボタン → ANSWERING（currentVideoTime < revealTime=20）
    simulatePlayback(gm, 11, 0)
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)
    expect(store.currentState).toBe(GameState.ANSWERING)

    const transitionSpy = vi.spyOn(store, 'transitionToState')

    // 正解を送信 → 直接 REVEALING（WAITING を挟まない）
    gm.handleAnswerSubmit('東京')

    expect(store.currentState).toBe(GameState.REVEALING)
    const transitionedStates = transitionSpy.mock.calls.map((call) => call[0])
    expect(transitionedStates).toContain(GameState.REVEALING)
    expect(transitionedStates).not.toContain(GameState.WAITING)
  })
})

// ============================================================================
// FINISHED 状態の固定
// ============================================================================

describe('FINISHED 状態の固定', () => {
  it('FINISHED 後に updateVideoTime を呼んでも状態が変化しない', () => {
    const { gm, store } = makeGameManager()
    simulatePlayback(gm, 45.1)
    expect(store.currentState).toBe(GameState.FINISHED)

    gm.updateVideoTime(50)
    gm.updateVideoTime(0)
    expect(store.currentState).toBe(GameState.FINISHED)
  })

  it('resetGame() で FINISHED が解除され LOADING に戻る', () => {
    const { gm, store } = makeGameManager()
    simulatePlayback(gm, 45.1)
    expect(store.currentState).toBe(GameState.FINISHED)

    gm.resetGame()
    expect(store.currentState).toBe(GameState.LOADING)
  })

  it('resetGame() 後に updateVideoTime が再び処理される', () => {
    const { gm, store } = makeGameManager()
    simulatePlayback(gm, 45.1)
    gm.resetGame()

    // リセット後に最初の問題を再通過 → QUESTIONING
    simulatePlayback(gm, 10.1)
    expect(store.currentState).toBe(GameState.QUESTIONING)
  })
})

// ============================================================================
// シーク検出（disableSeekbar=true）
// ============================================================================

describe('シーク検出（disableSeekbar=true）', () => {
  it('1秒を超えるジャンプで seekTo が呼ばれ、リセット先は previousVideoTime', () => {
    const player = makePlayerMock()
    const { gm } = makeGameManager(makeQuizData(), player)

    // 5.0 まで正常再生（prev=5.0 になる）
    simulatePlayback(gm, 5.0)
    // 5.0 → 20.0: |20.0-5.0|=15 > 1.0 → シーク検出
    gm.updateVideoTime(20.0)

    expect(player.seekTo).toHaveBeenCalledWith(5.0)
  })

  it('1秒以内のジャンプでは seekTo が呼ばれない', () => {
    const player = makePlayerMock()
    const { gm } = makeGameManager(makeQuizData(), player)

    simulatePlayback(gm, 5.0)
    // 5.0 → 5.9: |5.9-5.0|=0.9 ≤ 1.0 → シーク未検出
    gm.updateVideoTime(5.9)

    expect(player.seekTo).not.toHaveBeenCalled()
  })

  it('SEEK_TOLERANCE_SEC の境界値（ちょうど 1.0）ではシーク検出されない', () => {
    const player = makePlayerMock()
    const { gm } = makeGameManager(makeQuizData(), player)

    simulatePlayback(gm, 5.0)
    gm.updateVideoTime(6.0) // |6.0-5.0|=1.0, NOT > 1.0

    expect(player.seekTo).not.toHaveBeenCalled()
  })
})

// ============================================================================
// External Pause: 可視性変化
// ============================================================================

describe('External Pause: 可視性変化', () => {
  it('document.hidden=true で pauseVideo が呼ばれる', () => {
    const player = makePlayerMock()
    ;(player.getPlayerState as ReturnType<typeof vi.fn>).mockReturnValue(YouTubePlayerState.PLAYING)
    const { gm } = makeGameManager(makeQuizData(), player)
    gm.setupVisibilityHandlers()

    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(player.pauseVideo).toHaveBeenCalled()
  })

  it('visibility pause 後に document.hidden=false で playVideo が呼ばれる', () => {
    const player = makePlayerMock()
    ;(player.getPlayerState as ReturnType<typeof vi.fn>).mockReturnValue(YouTubePlayerState.PLAYING)
    const { gm } = makeGameManager(makeQuizData(), player)
    gm.setupVisibilityHandlers()

    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(player.playVideo).toHaveBeenCalled()
  })

  it('visibility pause 中は updateVideoTime がスキップされる', () => {
    const player = makePlayerMock()
    ;(player.getPlayerState as ReturnType<typeof vi.fn>).mockReturnValue(YouTubePlayerState.PLAYING)
    const { gm, store } = makeGameManager(makeQuizData(), player)
    gm.setupVisibilityHandlers()

    // Q1.startTime 手前で一時停止
    simulatePlayback(gm, 9.9)

    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    // pause 中に startTime を超えても状態変化しない
    gm.updateVideoTime(10.1)
    expect(store.currentState).toBe(GameState.LOADING)
  })
})

// ============================================================================
// destroy(): リソースリーク防止
// ============================================================================

describe('destroy()', () => {
  it('destroy() 後は visibilitychange リスナーが発火せず pauseVideo が呼ばれない', () => {
    const player = makePlayerMock()
    ;(player.getPlayerState as ReturnType<typeof vi.fn>).mockReturnValue(YouTubePlayerState.PLAYING)
    const { gm } = makeGameManager(makeQuizData(), player)
    gm.setupVisibilityHandlers()

    gm.destroy()

    // destroy() 後にタブを隠してもリスナーは解除済みなので反応しない
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(player.pauseVideo).not.toHaveBeenCalled()
  })

  it('destroy() 後は pagehide / pageshow リスナーが発火しない', () => {
    const player = makePlayerMock()
    ;(player.getPlayerState as ReturnType<typeof vi.fn>).mockReturnValue(YouTubePlayerState.PLAYING)
    const { gm } = makeGameManager(makeQuizData(), player)
    gm.setupVisibilityHandlers()

    gm.destroy()

    window.dispatchEvent(new Event('pagehide'))
    window.dispatchEvent(new Event('pageshow'))

    expect(player.pauseVideo).not.toHaveBeenCalled()
    expect(player.playVideo).not.toHaveBeenCalled()
  })

  it('destroy() 後はカウントダウンタイマーが進行しない', () => {
    vi.useFakeTimers()
    try {
      const player = makePlayerMock()
      ;(player.getPlayerState as ReturnType<typeof vi.fn>).mockReturnValue(
        YouTubePlayerState.PAUSED,
      )
      const { gm, store } = makeGameManager(makeQuizData({ answerTimeLimit: 10 }), player)

      // Q1 start(10)通過 → QUESTIONING → ボタン → ANSWERING（カウントダウン開始）
      simulatePlayback(gm, 11, 0)
      gm.handleButtonPress()
      vi.advanceTimersByTime(100)
      expect(store.currentState).toBe(GameState.ANSWERING)
      expect(store.answerTimeRemaining).toBe(10)

      // destroy() でカウントダウンを停止
      gm.destroy()

      // 5秒経過してもカウントダウンは進行しない
      vi.advanceTimersByTime(5000)
      expect(store.answerTimeRemaining).toBe(10)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('External Pause: ANSWERING中の可視性変化', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ANSWERING中にタブを隠すとカウントダウンが停止し、戻ると再開する', () => {
    const player = makePlayerMock()
    // ANSWERING中は動画がPAUSED状態
    ;(player.getPlayerState as ReturnType<typeof vi.fn>).mockReturnValue(YouTubePlayerState.PAUSED)
    const { gm, store } = makeGameManager(makeQuizData({ answerTimeLimit: 10 }), player)
    gm.setupVisibilityHandlers()

    // Q1 start(10)通過 → QUESTIONING → ボタン → ANSWERING
    simulatePlayback(gm, 11, 0)
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)
    expect(store.currentState).toBe(GameState.ANSWERING)
    expect(store.answerTimeRemaining).toBe(10)

    // 2秒経過 → 8
    vi.advanceTimersByTime(2000)
    expect(store.answerTimeRemaining).toBe(8)

    // タブを隠す → カウントダウン停止
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    // 3秒経過してもカウントダウンは停止したまま
    vi.advanceTimersByTime(3000)
    expect(store.answerTimeRemaining).toBe(8)

    // タブを戻す → カウントダウン再開
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    // 2秒経過 → 6
    vi.advanceTimersByTime(2000)
    expect(store.answerTimeRemaining).toBe(6)
  })
})

// ============================================================================
// External Pause: 再生停滞（stall）検出
// ============================================================================

describe('External Pause: 再生停滞（stall）検出', () => {
  it('壁時計が STALL_WALL_MS 以上経過し動画時間が進まない場合に pauseVideo が呼ばれる', () => {
    const player = makePlayerMock()
    ;(player.getPlayerState as ReturnType<typeof vi.fn>).mockReturnValue(YouTubePlayerState.PLAYING)
    const { gm } = makeGameManager(makeQuizData(), player)

    const initWall = performance.now()
    gm.initializeExternalPauseHandling()
    // lastWallMs ≈ initWall, lastVideoTime = 0

    // 壁時計が STALL_WALL_MS+1 経過、動画時間はほぼ未進
    gm.checkStall(initWall + STALL_WALL_MS + 1, STALL_VIDEO_DELTA_SEC - 0.01)

    expect(player.pauseVideo).toHaveBeenCalled()
    expect(gm.isExternalPaused()).toBe(true)
  })

  it('stall 後に動画時間が STALL_VIDEO_DELTA_SEC 以上進むと playVideo が呼ばれる', () => {
    const player = makePlayerMock()
    ;(player.getPlayerState as ReturnType<typeof vi.fn>).mockReturnValue(YouTubePlayerState.PLAYING)
    const { gm } = makeGameManager(makeQuizData(), player)

    const initWall = performance.now()
    gm.initializeExternalPauseHandling()

    // stall 状態にする
    gm.checkStall(initWall + STALL_WALL_MS + 1, STALL_VIDEO_DELTA_SEC - 0.01)
    expect(gm.isExternalPaused()).toBe(true)

    // 動画時間が十分進む → stall から復帰
    gm.checkStall(initWall + STALL_WALL_MS + 2, STALL_VIDEO_DELTA_SEC + 0.1)
    expect(gm.isExternalPaused()).toBe(false)
    expect(player.playVideo).toHaveBeenCalled()
  })
})

// ============================================================================
// ボタン押下時の状態遷移（handleButtonPress）
// ============================================================================

describe('handleButtonPress: ボタン状態遷移', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('READY状態で押下: PUSHED → 100ms後 RELEASED → 1500ms後 TALKING遷移 + playVideo', () => {
    const player = makePlayerMock()
    const { gm, store } = makeGameManager(makeQuizData(), player)
    store.transitionToState(GameState.READY)

    gm.handleButtonPress()

    // 即座に PUSHED
    expect(store.buttonState).toBe(ButtonState.PUSHED)
    expect(store.currentState).toBe(GameState.READY)

    // 100ms後: RELEASED
    vi.advanceTimersByTime(100)
    expect(store.buttonState).toBe(ButtonState.RELEASED)
    expect(store.currentState).toBe(GameState.READY)

    // 1500ms後: TALKING遷移 + playVideo
    // transitionToState(TALKING) 内の updateButtonStateForGameState が STANDBY → DISABLED にする
    vi.advanceTimersByTime(1500)
    expect(store.buttonState).toBe(ButtonState.DISABLED)
    expect(store.currentState).toBe(GameState.TALKING)
    expect(player.playVideo).toHaveBeenCalledTimes(1)
  })

  it('QUESTIONING状態で押下: PUSHED → 100ms後 RELEASED + ANSWERING遷移 + pauseVideo', () => {
    const player = makePlayerMock()
    const { gm, store } = makeGameManager(makeQuizData(), player)
    // QUESTIONING に進める
    simulatePlayback(gm, 10.1)
    expect(store.currentState).toBe(GameState.QUESTIONING)

    gm.handleButtonPress()

    // 即座に PUSHED
    expect(store.buttonState).toBe(ButtonState.PUSHED)

    // 100ms後: RELEASED + ANSWERING + pauseVideo
    vi.advanceTimersByTime(100)
    expect(store.buttonState).toBe(ButtonState.RELEASED)
    expect(store.currentState).toBe(GameState.ANSWERING)
    expect(player.pauseVideo).toHaveBeenCalled()
  })

  it('ボタン無効時（isButtonEnabled=false）は何もしない', () => {
    const player = makePlayerMock()
    const { gm, store } = makeGameManager(makeQuizData(), player)
    // LOADING状態（初期状態）はボタン無効
    expect(store.isButtonEnabled).toBe(false)

    gm.handleButtonPress()

    expect(store.buttonState).toBe(ButtonState.STANDBY)
    vi.advanceTimersByTime(200)
    // 状態変化なし
    expect(store.buttonState).toBe(ButtonState.STANDBY)
  })

  it('PUSHED中の連打は無視される（isButtonEnabled=falseになるため）', () => {
    const player = makePlayerMock()
    const { gm, store } = makeGameManager(makeQuizData(), player)
    store.transitionToState(GameState.READY)

    gm.handleButtonPress()
    expect(store.buttonState).toBe(ButtonState.PUSHED)

    // 連打: isButtonEnabled は buttonState===STANDBY のみ true なので無視される
    gm.handleButtonPress()

    // 正常遷移が壊れていないことを確認
    vi.advanceTimersByTime(100)
    expect(store.buttonState).toBe(ButtonState.RELEASED)

    vi.advanceTimersByTime(1500)
    // transitionToState(TALKING) 内の updateButtonStateForGameState が DISABLED にする
    expect(store.buttonState).toBe(ButtonState.DISABLED)
    expect(store.currentState).toBe(GameState.TALKING)
    // playVideo は1回だけ
    expect(player.playVideo).toHaveBeenCalledTimes(1)
  })

  it('DISABLED状態では押下できない', () => {
    const player = makePlayerMock()
    const { gm, store } = makeGameManager(makeQuizData(), player)
    // TALKING状態に遷移させるとボタンは DISABLED になる
    store.transitionToState(GameState.TALKING)
    expect(store.buttonState).toBe(ButtonState.DISABLED)

    gm.handleButtonPress()

    // 状態変化なし
    expect(store.buttonState).toBe(ButtonState.DISABLED)
    vi.advanceTimersByTime(200)
    expect(store.buttonState).toBe(ButtonState.DISABLED)
  })
})

// ============================================================================
// 解答カウントダウンタイマー
// ============================================================================

describe('解答カウントダウンタイマー', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ANSWERING遷移後にanswerTimeRemainingが毎秒デクリメントされる', () => {
    const { gm, store } = makeGameManager(makeQuizData({ answerTimeLimit: 10 }))

    // Q1 start(10)通過 → QUESTIONING
    simulatePlayback(gm, 11, 0)
    expect(store.currentState).toBe(GameState.QUESTIONING)

    // ボタン押下 → 100ms後にANSWERING + カウントダウン開始
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)
    expect(store.currentState).toBe(GameState.ANSWERING)
    expect(store.answerTimeRemaining).toBe(10)

    // 1秒経過 → 9
    vi.advanceTimersByTime(1000)
    expect(store.answerTimeRemaining).toBe(9)

    // さらに2秒経過 → 7
    vi.advanceTimersByTime(2000)
    expect(store.answerTimeRemaining).toBe(7)
  })

  it('カウントダウンが0になるとタイムアウト処理が発動する', () => {
    const { gm, store } = makeGameManager(makeQuizData({ answerTimeLimit: 3, maxAttempts: 1 }))

    simulatePlayback(gm, 11, 0)
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)
    expect(store.answerTimeRemaining).toBe(3)

    // 3秒経過 → タイムアウト → 不正解確定
    vi.advanceTimersByTime(3000)
    expect(store.answerTimeRemaining).toBe(0)
    expect(store.currentState).toBe(GameState.WAITING)
    expect(store.results).toHaveLength(1)
    expect(store.results[0].isCorrect).toBe(false)
  })

  it('タイムアウトでincorrectCountが増加する', () => {
    const { gm, store } = makeGameManager(makeQuizData({ answerTimeLimit: 3, maxAttempts: 1 }))

    simulatePlayback(gm, 11, 0)
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)

    // 3秒経過 → タイムアウト → 不正解確定
    vi.advanceTimersByTime(3000)
    expect(store.incorrectCount).toBe(1)
    expect(store.results[0].userAnswers).toEqual([''])
  })

  it('タイムアウト時は入力途中の内容で正誤判定される（正解なら正解扱い）', () => {
    const { gm, store } = makeGameManager(makeQuizData({ answerTimeLimit: 3, maxAttempts: 1 }))

    simulatePlayback(gm, 11, 0)
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)

    // 正解を入力したまま送信せずタイムアウト
    store.updateAnswerInput('東京')
    vi.advanceTimersByTime(3000)

    expect(store.correctCount).toBe(1)
    expect(store.results[0].isCorrect).toBe(true)
    expect(store.results[0].userAnswers).toEqual(['東京'])
  })

  it('GameManager.handleAnswerSubmit経由で解答するとカウントダウンが停止する', () => {
    const { gm, store } = makeGameManager(makeQuizData({ answerTimeLimit: 10, maxAttempts: 1 }))

    simulatePlayback(gm, 11, 0)
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)

    vi.advanceTimersByTime(2000)
    expect(store.answerTimeRemaining).toBe(8)

    // GameManager経由で解答（App.vueのフローと同じ）
    gm.handleAnswerSubmit('東京')

    // 解答後さらに2秒待っても値が変わらない（カウントダウン停止済み）
    vi.advanceTimersByTime(2000)
    expect(store.answerTimeRemaining).toBe(8)
  })

  it('ANSWERING中にonStateChange(PAUSED)が非同期到達してもカウントダウンは停止しない', () => {
    const player = makePlayerMock()
    const { gm, store } = makeGameManager(makeQuizData({ answerTimeLimit: 10 }), player)

    // onStateChangeコールバックを補足
    let stateChangeCallback: ((state: number) => void) | null = null
    player.onStateChange = vi.fn((cb: (state: number) => void) => {
      stateChangeCallback = cb
    })
    gm.initializeExternalPauseHandling()

    simulatePlayback(gm, 11, 0)
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)
    expect(store.currentState).toBe(GameState.ANSWERING)
    expect(store.answerTimeRemaining).toBe(10)

    // YouTube IFrame APIからPAUSEDイベントが非同期で到達（internalActionは既にfalse）
    stateChangeCallback!(2) // PAUSED

    // カウントダウンが停止していないことを確認
    vi.advanceTimersByTime(2000)
    expect(store.answerTimeRemaining).toBe(8)
  })

  it('READY中にonStateChange(PAUSED)が非同期到達してもExternal Pauseにならない', () => {
    const player = makePlayerMock()
    const { gm, store } = makeGameManager(makeQuizData(), player)

    // onStateChangeコールバックを補足
    let stateChangeCallback: ((state: number) => void) | null = null
    player.onStateChange = vi.fn((cb: (state: number) => void) => {
      stateChangeCallback = cb
    })
    gm.initializeExternalPauseHandling()

    // FINISHEDまで進めてリプレイ → READYで動画停止（pauseVideo）
    simulatePlayback(gm, 46, 0)
    expect(store.currentState).toBe(GameState.FINISHED)
    gm.handleReplay()
    expect(store.currentState).toBe(GameState.READY)

    // リプレイ時のpauseVideo()由来のPAUSEDイベントが非同期で到達
    stateChangeCallback!(2) // PAUSED

    expect(gm.isExternalPaused()).toBe(false)
  })
})

// ============================================================================
// recordSkippedQuestion（onEnd経由でのスキップ記録）
// ============================================================================

describe('recordSkippedQuestion', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('未解答のままendTimeを通過するとskipped=falseで記録される（問題は聞いた）', () => {
    const { gm, store } = makeGameManager()

    // Q1: start=10 → endTime=25 を通過（ボタン押さず）
    simulatePlayback(gm, 26, 0)

    const result = store.results.find((r) => r.questionNumber === 1)
    expect(result).toBeDefined()
    expect(result!.skipped).toBe(false)
    expect(result!.isCorrect).toBe(false)
    expect(result!.userAnswers).toEqual([])
  })

  it('未解答のまま問題終了してもincorrectCountは増えない', () => {
    const { gm, store } = makeGameManager()

    // Q1を未解答のまま通過
    simulatePlayback(gm, 26, 0)

    expect(store.incorrectCount).toBe(0)
  })

  it('consumed start経由のスキップはskipped=trueで記録される', () => {
    const { gm, store } = makeGameManager(makeQuizData({ disableSeekbar: false }))

    // Q1を通常通過（消費）
    simulatePlayback(gm, 26, 0)

    // 後方シーク → Q1の startTime を再通過（consumed start）
    gm.updateVideoTime(9.0)
    simulatePlayback(gm, 11, 9.0)

    // consumed start由来のスキップも含めて確認
    // 最初のonEnd由来の結果があるので2件目は記録されない（alreadyRecordedガード）
    const q1Results = store.results.filter((r) => r.questionNumber === 1)
    expect(q1Results).toHaveLength(1)
  })

  it('スキップ記録ではincorrectCountが増えない', () => {
    const { gm, store } = makeGameManager()

    // Q1をスキップ
    simulatePlayback(gm, 26, 0)

    expect(store.incorrectCount).toBe(0)
  })

  it('解答済みの問題はスキップ記録されない', () => {
    const { gm, store } = makeGameManager(makeQuizData({ maxAttempts: 1 }))

    // Q1 start(10)を通過 → QUESTIONING
    simulatePlayback(gm, 11, 0)
    expect(store.currentState).toBe(GameState.QUESTIONING)

    // ボタン押下 → 100ms後にANSWERING
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)
    expect(store.currentState).toBe(GameState.ANSWERING)
    // 正解を送信 → WAITING
    gm.handleAnswerSubmit('東京')

    // endTime通過
    simulatePlayback(gm, 26, 11)

    // 結果は1つだけ（正解のもの）
    const q1Results = store.results.filter((r) => r.questionNumber === 1)
    expect(q1Results).toHaveLength(1)
    expect(q1Results[0].isCorrect).toBe(true)
    expect(q1Results[0].skipped).toBe(false)
  })

  it('不正解後にリトライせずendTimeを通過すると解答が記録される', () => {
    const { gm, store } = makeGameManager(makeQuizData({ maxAttempts: 3 }))

    // Q1 start(10)通過 → QUESTIONING
    simulatePlayback(gm, 11, 0)

    // ボタン押下 → ANSWERING → 不正解（残り2回）→ QUESTIONING
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)
    gm.handleAnswerSubmit('間違い')
    expect(store.currentState).toBe(GameState.QUESTIONING)

    // リトライせずにendTime(25)を通過
    simulatePlayback(gm, 26, 11)

    const result = store.results.find((r) => r.questionNumber === 1)
    expect(result).toBeDefined()
    expect(result!.skipped).toBe(false) // 解答しているのでスキップではない
    expect(result!.isCorrect).toBe(false)
    expect(result!.userAnswers).toEqual(['間違い']) // 解答が記録されている
    expect(store.incorrectCount).toBe(1) // 不正解カウントが増える
  })

  it('複数回不正解後にendTimeを通過すると全ての解答が記録される', () => {
    const { gm, store } = makeGameManager(makeQuizData({ maxAttempts: 3 }))

    // Q1 start(10)通過 → QUESTIONING
    simulatePlayback(gm, 11, 0)

    // 1回目不正解
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)
    gm.handleAnswerSubmit('間違い1')

    // 2回目不正解
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)
    gm.handleAnswerSubmit('間違い2')

    // リトライせずにendTime通過
    simulatePlayback(gm, 26, 11)

    const result = store.results.find((r) => r.questionNumber === 1)
    expect(result).toBeDefined()
    expect(result!.skipped).toBe(false)
    expect(result!.userAnswers).toEqual(['間違い1', '間違い2'])
    expect(store.incorrectCount).toBe(1)
  })
})

// ============================================================================
// handleReplay
// ============================================================================

describe('handleReplay', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('FINISHED状態からリプレイするとREADY状態になる', () => {
    const { gm, store } = makeGameManager()

    // 全問通過してFINISHEDへ
    simulatePlayback(gm, 46, 0)
    expect(store.currentState).toBe(GameState.FINISHED)

    gm.handleReplay()

    expect(store.currentState).toBe(GameState.READY)
  })

  it('リプレイするとスコア・結果がリセットされる', () => {
    const { gm, store } = makeGameManager()

    simulatePlayback(gm, 46, 0)
    expect(store.results.length).toBeGreaterThan(0)

    gm.handleReplay()

    expect(store.results).toHaveLength(0)
    expect(store.correctCount).toBe(0)
    expect(store.incorrectCount).toBe(0)
  })

  it('リプレイすると動画が0秒にシークされる', () => {
    const player = makePlayerMock()
    const { gm } = makeGameManager(makeQuizData(), player)

    simulatePlayback(gm, 46, 0)
    gm.handleReplay()

    expect(player.seekTo).toHaveBeenCalledWith(0)
  })

  it('リプレイすると動画が一時停止される（READY でボタンチェック開始を待つ）', () => {
    const player = makePlayerMock()
    const { gm, store } = makeGameManager(makeQuizData(), player)

    simulatePlayback(gm, 46, 0)
    gm.handleReplay()

    expect(player.pauseVideo).toHaveBeenCalled()
    expect(store.currentState).toBe(GameState.READY)
  })

  it('FINISHED以外の状態ではリプレイが無視される', () => {
    const { gm, store } = makeGameManager()

    // LOADING状態のままリプレイを呼んでも無視される
    gm.handleReplay()

    expect(store.currentState).toBe(GameState.LOADING)
  })
})

// ============================================================================
// userAnswers蓄積（GameManager経由のフロー）
// ============================================================================

describe('userAnswers蓄積（GameManager経由）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('1回正解でuserAnswersに1要素が記録される', () => {
    const { gm, store } = makeGameManager(makeQuizData({ maxAttempts: 1 }))

    // Q1 start(10)通過 → QUESTIONING
    simulatePlayback(gm, 11, 0)

    // ボタン押下 → 100ms後にANSWERING
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)

    // 正解を送信
    gm.handleAnswerSubmit('東京')

    const result = store.results.find((r) => r.questionNumber === 1)
    expect(result).toBeDefined()
    expect(result!.userAnswers).toEqual(['東京'])
    expect(result!.skipped).toBe(false)
  })

  it('不正解→再挑戦→正解でuserAnswersに2要素が記録される', () => {
    const { gm, store } = makeGameManager(makeQuizData({ maxAttempts: 2 }))

    // Q1 start(10)通過 → QUESTIONING
    simulatePlayback(gm, 11, 0)

    // ボタン押下 → 100ms後にANSWERING
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)

    // 不正解を送信 → QUESTIONING（残り1回）
    gm.handleAnswerSubmit('間違い')
    expect(store.currentState).toBe(GameState.QUESTIONING)

    // 再度ボタン押下 → 100ms後にANSWERING
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)

    // 正解を送信
    gm.handleAnswerSubmit('東京')
    expect(store.currentState).toBe(GameState.WAITING)

    const recorded = store.results.find((r) => r.questionNumber === 1)
    expect(recorded).toBeDefined()
    expect(recorded!.userAnswers).toEqual(['間違い', '東京'])
    expect(recorded!.isCorrect).toBe(true)
  })

  it('initializeForQuestionでpendingUserAnswersがリセットされる', () => {
    const { gm, store } = makeGameManager(makeQuizData({ maxAttempts: 1 }))

    // Q1 start(10)通過 → QUESTIONING → ボタン → ANSWERING → 正解
    simulatePlayback(gm, 11, 0)
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)
    gm.handleAnswerSubmit('東京')

    // Q1のend(25)通過 → TALKING
    simulatePlayback(gm, 26, 11)

    // Q2 start(30)通過 → initializeForQuestion → QUESTIONING
    simulatePlayback(gm, 31, 26)

    // Q2のボタン押下 → 100ms後にANSWERING → 正解
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)
    gm.handleAnswerSubmit('大阪')

    // Q2の結果にQ1の解答が混入していないことを確認
    const q2Result = store.results.find((r) => r.questionNumber === 2)
    expect(q2Result).toBeDefined()
    expect(q2Result!.userAnswers).toEqual(['大阪'])
  })
})

// ============================================================================
// consumed リセット（External Pause時のskipped考慮）
// ============================================================================

describe('consumed リセット（skipped考慮）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('未解答の問題はリプレイ後にconsumedがリセットされ再挑戦可能', () => {
    const { gm, store } = makeGameManager()

    // Q1を未解答のまま通過（ボタン押さず）
    simulatePlayback(gm, 26, 0)
    expect(
      store.results.some((r) => r.questionNumber === 1 && !r.skipped && r.userAnswers.length === 0),
    ).toBe(true)

    // 全問通過してFINISHED
    simulatePlayback(gm, 46, 26)
    expect(store.currentState).toBe(GameState.FINISHED)

    // リプレイでリセット
    gm.handleReplay()

    // Q1を再度通過 → QUESTIONINGに入れることを確認
    simulatePlayback(gm, 11, 0)
    expect(store.currentState).toBe(GameState.QUESTIONING)
  })
})

// ============================================================================
// YouTube巻き戻り補正でskipped結果を削除
// ============================================================================

describe('YouTube巻き戻り補正でskipped結果を削除', () => {
  /**
   * Q1.startTimeが5.5s閾値以内にあるクイズデータ
   * disableSeekbar=false でシーク操作が可能
   */
  function makeRewindQuizData(): QuizData {
    return {
      videoId: 'test-video',
      questions: [
        { index: 0, startTime: 4, revealTime: 14, endTime: 19, answers: ['東京'] },
        { index: 1, startTime: 30, revealTime: 40, endTime: 45, answers: ['大阪'] },
      ],
      settings: {
        maxAttempts: 3,
        answerTimeLimit: 10,
        disableSeekbar: false,
        jumpToRevealPeriod: false,
        hideVideoPlayerDuringAnswer: false,
      },
    }
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('巻き戻り補正でskipped結果が削除され、再解答が記録される', () => {
    const player = makePlayerMock()
    ;(player.getPlayerState as ReturnType<typeof vi.fn>).mockReturnValue(YouTubePlayerState.PLAYING)
    const quizData = makeRewindQuizData()
    const { gm, store } = makeGameManager(quizData, player)
    gm.setupVisibilityHandlers()

    // 0s→1sまで通常再生（hasPassedRewindThreshold=false のまま）
    simulatePlayback(gm, 1, 0)

    // 前方シーク: 1s→5s（Q1 startTime=4を跨ぐ）
    // → consumeQuestionsBySeek で Q1 が skipped として記録される
    gm.updateVideoTime(5)
    expect(store.results.some((r) => r.questionNumber === 1 && r.skipped)).toBe(true)

    // タブ非表示 → External Pause
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    // YouTubeのシステム巻き戻り: getCurrentTime() が 0s を返す（5→0に巻き戻り）
    ;(player.getCurrentTime as ReturnType<typeof vi.fn>).mockReturnValue(0)

    // タブ表示 → resumeExternal → 巻き戻り補正
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    // skipped結果が削除されていることを確認
    expect(store.results.some((r) => r.questionNumber === 1)).toBe(false)

    // 0sから再度通常再生でQ1 startTime(4)を通過 → QUESTIONING に入れること
    simulatePlayback(gm, 5, 0)
    expect(store.currentState).toBe(GameState.QUESTIONING)

    // ボタン押下 → ANSWERING
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)
    expect(store.currentState).toBe(GameState.ANSWERING)

    // GameManager経由で正解を送信 → 結果が記録される
    gm.handleAnswerSubmit('東京')
    expect(store.results.some((r) => r.questionNumber === 1 && r.isCorrect)).toBe(true)
  })

  it('巻き戻り補正で正答済み結果は削除されない', () => {
    const player = makePlayerMock()
    ;(player.getPlayerState as ReturnType<typeof vi.fn>).mockReturnValue(YouTubePlayerState.PLAYING)
    const quizData = makeRewindQuizData()
    const { gm, store } = makeGameManager(quizData, player)
    gm.setupVisibilityHandlers()

    // 0s→1sまで通常再生（hasPassedRewindThreshold=false のまま）
    simulatePlayback(gm, 1, 0)

    // 前方シーク: 1s→5s（Q1 startTime=4を跨ぐ）→ Q1 が skipped として記録
    gm.updateVideoTime(5)
    expect(store.results.some((r) => r.questionNumber === 1 && r.skipped)).toBe(true)

    // タブ非表示 → External Pause
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    // YouTubeのシステム巻き戻り: getCurrentTime() が 0s を返す（5→0に巻き戻り）
    ;(player.getCurrentTime as ReturnType<typeof vi.fn>).mockReturnValue(0)

    // タブ表示 → resumeExternal → 巻き戻り補正で skipped 結果を削除 + consumed リセット
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(store.results.some((r) => r.questionNumber === 1)).toBe(false)

    // 再度通常再生で Q1 を通過し、正解する
    simulatePlayback(gm, 5, 0)
    expect(store.currentState).toBe(GameState.QUESTIONING)
    gm.handleButtonPress()
    vi.advanceTimersByTime(100)
    gm.handleAnswerSubmit('東京')
    expect(store.results.some((r) => r.questionNumber === 1 && r.isCorrect)).toBe(true)
    expect(store.correctCount).toBe(1)

    // 再度 External Pause + 巻き戻り → 正答済みの Q1 は削除されない
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    ;(player.getCurrentTime as ReturnType<typeof vi.fn>).mockReturnValue(0)
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    // 正答済み結果が維持されていることを確認
    expect(store.results.find((r) => r.questionNumber === 1)?.isCorrect).toBe(true)
    expect(store.correctCount).toBe(1)
  })
})
