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
    onTimeUpdate: vi.fn(),
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

  it('Q1 endTime 到達で TALKING に遷移する（次の問題あり）', () => {
    const { gm, store } = makeGameManager()
    simulatePlayback(gm, 25.1)
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

  it('期間終了で QUESTIONING に復帰する', () => {
    const { gm, store } = makeGameManager()
    simulatePlayback(gm, 35.1)
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
    simulatePlayback(gm, 9.9)    // prev=9.9, seek 未検出
    gm.updateVideoTime(10.5)     // (9.9, 10.5]: start(10.0) と reveal(10.4) を含む
    expect(store.currentState).toBe(GameState.REVEALING)
  })

  it('1ティックで start/reveal/end を同時に跨いだ場合は TALKING に遷移する', () => {
    // prev=9.9 → curr=10.9 (差1.0, NOT > 1.0, シーク未検出): 3閾値すべてを跨ぐ
    const { gm, store } = makeGameManager(makeMultiThresholdQuizData())
    simulatePlayback(gm, 9.9)
    gm.updateVideoTime(10.9)     // (9.9, 10.9]: start(10.0), reveal(10.4), end(10.8) を含む
    expect(store.currentState).toBe(GameState.TALKING)
  })
})

// ============================================================================
// Single-Shot Guard（consumedフラグの一回性）
// ============================================================================

describe('Single-Shot Guard', () => {
  it('startTime を 2 回通過してもスキップ済みとして WAITING になる（disableSeekbar=false）', () => {
    const { gm, store } = makeGameManager(makeQuizData({ disableSeekbar: false }))

    // Q1 通常再生: start(10) と reveal(20) を消費 → REVEALING
    simulatePlayback(gm, 20.1)
    expect(store.currentState).toBe(GameState.REVEALING)

    // 後方シーク: prev=20.1（Q1区間内: 10-25）→ Q1 を消費済みにして WAITING
    // |9.0 - 20.1| = 11.1 > 1.0 → シーク検出
    gm.updateVideoTime(9.0)
    expect(store.currentState).toBe(GameState.WAITING)

    // startTime(10) を再通過: consumed.start=true → WAITING（スキップ）
    simulatePlayback(gm, 10.1, 9.0)
    expect(store.currentState).toBe(GameState.WAITING)
  })

  it('revealTime を 2 回通過すると REVEALING に遷移する（副作用なし）', () => {
    const { gm, store } = makeGameManager(makeQuizData({ disableSeekbar: false }))

    // Q1 通常再生: start/reveal 消費
    simulatePlayback(gm, 20.1)
    expect(store.currentState).toBe(GameState.REVEALING)

    // 後方シーク (prev=20.1 が Q1区間内 → consumed 維持) → WAITING
    gm.updateVideoTime(9.0)

    // Q1 消費済みの状態で revealTime を再通過 → 副作用なしで REVEALING へ
    simulatePlayback(gm, 20.1, 9.0)
    expect(store.currentState).toBe(GameState.REVEALING)
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
