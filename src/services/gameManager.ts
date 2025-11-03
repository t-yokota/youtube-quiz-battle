// ゲーム管理サービス
import type { QuizData, QuizQuestion, YouTubePlayerManager } from '@/types'
import { createTimeManager, TimeManager } from './timeManager'
import { STALL_WALL_MS, STALL_VIDEO_DELTA_SEC, TIME_EPSILON_SEC } from '@/constants/timing'

/**
 * Single-Shot Guard: 問題単位のstart/reveal/end消費フラグ
 */
interface ConsumedFlags {
  start: boolean
  reveal: boolean
  end: boolean
}

/**
 * ゲーム管理システム
 * ゲーム全体の制御、状態遷移、外部要因による一時停止状態（External Pause）のハンドリングを行う
 */
export class GameManager {
  private timeManager: TimeManager
  private playerManager: YouTubePlayerManager
  private quizData: QuizData

  // External Pause関連
  private externalPaused: boolean = false
  private externalPausedReason: 'visibility' | 'user' | 'stall' | null = null
  private internalAction: boolean = false

  // 再生停滞（stall）の検出用
  private lastWallMs: number = 0
  private lastVideoTime: number = 0

  // Single-Shot Guard: 問題ごとの閾値消費フラグ
  private consumed: Record<number, ConsumedFlags> = {}

  // 状態遷移制御
  private transitionBlocked: boolean = false // disableSeekbar=false時のWAITING状態でシーク検出時にtrue
  private currentQuestionIndex: number = -1 // 現在の問題インデックス (-1: 問題開始前)

  constructor(
    playerManager: YouTubePlayerManager,
    quizData: QuizData,
  ) {
    this.playerManager = playerManager
    this.quizData = quizData
    this.timeManager = createTimeManager(quizData.questions)
  }

  /**
   * External Pause状態を取得
   */
  isExternalPaused(): boolean {
    return this.externalPaused
  }

  /**
   * External Pauseを開始
   * @param reason 一時停止の要因
   */
  pauseExternal(reason: 'visibility' | 'user' | 'stall'): void {
    if (this.externalPaused) return

    // 一時停止開始
    this.externalPaused = true
    this.externalPausedReason = reason

    // 動画を停止
    // TODO: ANSWERING状態のチェックを追加（Task 15）
    // ANSWERING中は既に停止済みなので、pauseVideo()は不要だが、現時点では常に呼び出す
    this.internalAction = true
    this.playerManager.pauseVideo()
    this.internalAction = false

    console.log('[GameManager] External pause started:', reason)
  }

  /**
   * External Pauseを解除
   */
  resumeExternal(): void {
    if (!this.externalPaused) return

    // 一時停止解除
    const prevReason = this.externalPausedReason
    this.externalPaused = false
    this.externalPausedReason = null

    // 動画を再開
    // TODO: ANSWERING状態のチェックを追加（Task 15, Task 18）
    // ANSWERING中は動画再開せず、カウントダウン再開のみ（Task 18で実装）
    this.internalAction = true
    this.playerManager.playVideo()
    this.internalAction = false

    console.log('[GameManager] External pause ended:', prevReason)
  }

  /**
   * 可視性変化（visibility）イベントハンドラーを設定
   */
  setupVisibilityHandlers(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseExternal('visibility')
      } else {
        this.resumeExternal()
      }
    })

    window.addEventListener('pagehide', () => {
      this.pauseExternal('visibility')
    })

    window.addEventListener('pageshow', () => {
      this.resumeExternal()
    })
  }

  /**
   * プレイヤー状態変化イベントハンドラーを設定
   */
  setupPlayerStateHandlers(): void {
    this.playerManager.onStateChange((state) => {
      // 内部操作による状態変化は除外
      if (this.internalAction) return

      // ユーザ操作による状態変化（user）をハンドリング
      // PAUSED状態になった場合
      if (state === 2) { // YouTubePlayerState.PAUSED
        this.pauseExternal('user')
      }

      // PLAYING状態になった場合
      if (state === 1) { // YouTubePlayerState.PLAYING
        // TODO: ANSWERING状態のチェックを追加（Task 15）
        // if (currentState === ANSWERING) {
        //   // ANSWERING中にユーザーが再生ボタンを押した場合、即座に停止
        //   this.internalAction = true
        //   this.playerManager.pauseVideo()
        //   this.internalAction = false
        //   return
        // }

        // External Pauseから復帰
        if (this.externalPaused) {
          this.resumeExternal()
        }
      }
    })
  }

  /**
   * 再生停滞（stall）を検出
   * @param currentWallMs 現在の壁時計時間（ミリ秒）
   * @param currentVideoTime 現在の動画時間（秒）
   */
  checkStall(currentWallMs: number, currentVideoTime: number): void {
    const wallDelta = currentWallMs - this.lastWallMs
    const videoDelta = currentVideoTime - this.lastVideoTime

    // プレイヤー状態を確認
    const playerState = this.playerManager.getPlayerState()
    const playbackIntended = playerState === 1 || playerState === 3 // PLAYING or BUFFERING

    // 再生停滞検出
    if (
      !this.externalPaused &&
      playbackIntended &&
      wallDelta >= STALL_WALL_MS &&
      videoDelta < STALL_VIDEO_DELTA_SEC
    ) {
      this.pauseExternal('stall')
    }

    // 再生停滞から復帰
    if (
      this.externalPaused &&
      this.externalPausedReason === 'stall' &&
      videoDelta >= STALL_VIDEO_DELTA_SEC
    ) {
      this.resumeExternal()
    }

    // 次回の比較用に記録
    this.lastWallMs = currentWallMs
    this.lastVideoTime = currentVideoTime
  }

  /**
   * External Pauseのハンドリングを初期化
   */
  initializeExternalPauseHandling(): void {
    this.setupVisibilityHandlers()
    this.setupPlayerStateHandlers()
    this.lastWallMs = performance.now()
    this.lastVideoTime = this.playerManager.getCurrentTime()
  }

  /**
   * 動画時間の更新とシーク検出・状態遷移処理
   * @param current 現在の動画時間（秒）
   */
  updateVideoTime(current: number): void {
    const prev = this.timeManager.getWatchedVideoTime()

    // 現在時刻を更新
    this.timeManager.updateCurrentVideoTime(current)

    // シーク検出
    if (this.timeManager.isSeekDetected(current)) {
      console.log('[GameManager] Seek detected:', prev, '->', current)

      if (this.quizData.settings.disableSeekbar) {
        // disableSeekbar=true: 動画時間を強制リセット
        this.internalAction = true
        this.playerManager.seekTo(prev)
        this.internalAction = false
        console.log('[GameManager] Forced reset to:', prev)
      } else {
        // disableSeekbar=false: WAITING状態へ遷移、状態遷移を停止
        // TODO: Task 18でWAITING状態への遷移を実装
        this.transitionBlocked = true
        this.timeManager.updateWatchedVideoTime(current)
        console.log('[GameManager] Transition blocked, waiting for next QUIZ start')
      }

      return
    }

    // 通常の時間更新: watchedVideoTimeを更新
    this.timeManager.updateWatchedVideoTime(current)

    // (prev, curr] 窓内の閾値を走査して状態遷移を処理
    this.processTimeWindow(prev, current)
  }

  /**
   * (prev, curr] 窓内の閾値を走査して処理する
   * @param prev 前回の watchedVideoTime
   * @param curr 現在の watchedVideoTime
   */
  private processTimeWindow(prev: number, curr: number): void {
    // 状態遷移が停止中の場合、未消費の閾値を処理してソフトロック回避
    if (this.transitionBlocked) {
      this.processBlockedTransition(prev, curr)
      return
    }

    // 通常の状態遷移: 現在の問題の閾値を処理
    if (this.currentQuestionIndex >= 0 && this.currentQuestionIndex < this.quizData.questions.length) {
      const question = this.quizData.questions[this.currentQuestionIndex]
      this.applyThresholds(prev, curr, question)
    }

    // 問題開始前（currentQuestionIndex === -1）の場合、最初の問題の start を監視
    if (this.currentQuestionIndex === -1 && this.quizData.questions.length > 0) {
      const firstQuestion = this.quizData.questions[0]
      this.applyThresholds(prev, curr, firstQuestion)
    }
  }

  /**
   * 状態遷移停止中の処理: 未消費の reveal/end を処理し、次の QUIZ 開始で復帰
   * @param prev 前回の watchedVideoTime
   * @param curr 現在の watchedVideoTime
   */
  private processBlockedTransition(prev: number, curr: number): void {
    // すべての問題で未消費の閾値を走査
    for (const question of this.quizData.questions) {
      const c = this.consumed[question.index] ?? (this.consumed[question.index] = { start: false, reveal: false, end: false })

      // reveal/end の未消費閾値があれば処理
      if (!c.reveal && prev + TIME_EPSILON_SEC < question.revealTime && curr + TIME_EPSILON_SEC >= question.revealTime) {
        c.reveal = true
        console.log('[GameManager] Consumed reveal threshold (blocked):', question.index)
      }
      if (!c.end && prev + TIME_EPSILON_SEC < question.endTime && curr + TIME_EPSILON_SEC >= question.endTime) {
        c.end = true
        console.log('[GameManager] Consumed end threshold (blocked):', question.index)
      }

      // 次のQUIZ区間（startTime）に到達したら状態遷移を再開
      if (!c.start && prev + TIME_EPSILON_SEC < question.startTime && curr + TIME_EPSILON_SEC >= question.startTime) {
        this.transitionBlocked = false
        this.applyThresholds(prev, curr, question)
        console.log('[GameManager] Transition unblocked at question start:', question.index)
        return
      }
    }

    // すべての問題で start が消費済みかつ未消費の end が残っていない場合、FINISHED へ遷移
    const allStartConsumed = this.quizData.questions.every((q) => this.consumed[q.index]?.start === true)
    const noUnconsumedEnd = this.quizData.questions.every((q) => this.consumed[q.index]?.end !== false)
    if (allStartConsumed && noUnconsumedEnd) {
      // TODO: Task 18 で FINISHED 状態への遷移を実装
      console.log('[GameManager] All questions completed, transitioning to FINISHED')
    }
  }

  /**
   * (prev, curr] 窓内の閾値を適用（Single-Shot Guard）
   * @param prev 前回の watchedVideoTime
   * @param curr 現在の watchedVideoTime
   * @param question 対象の問題
   */
  private applyThresholds(prev: number, curr: number, question: QuizQuestion): void {
    const c = this.consumed[question.index] ?? (this.consumed[question.index] = { start: false, reveal: false, end: false })

    // start 閾値
    if (!c.start && prev + TIME_EPSILON_SEC < question.startTime && curr + TIME_EPSILON_SEC >= question.startTime) {
      c.start = true
      this.onStart(question)
    }

    // reveal 閾値
    if (!c.reveal && prev + TIME_EPSILON_SEC < question.revealTime && curr + TIME_EPSILON_SEC >= question.revealTime) {
      c.reveal = true
      this.onReveal(question)
    }

    // end 閾値
    if (!c.end && prev + TIME_EPSILON_SEC < question.endTime && curr + TIME_EPSILON_SEC >= question.endTime) {
      c.end = true
      this.onEnd(question)
    }
  }

  /**
   * 問題開始ハンドラ（時間経過起点）
   * @param question 問題データ
   */
  private onStart(question: QuizQuestion): void {
    console.log('[GameManager] onStart:', question.index)
    this.currentQuestionIndex = question.index
    // TODO: Task 18 で QUESTIONING 状態への遷移とゲームストア更新を実装
  }

  /**
   * 正解発表開始ハンドラ（時間経過起点）
   * @param question 問題データ
   */
  private onReveal(question: QuizQuestion): void {
    console.log('[GameManager] onReveal:', question.index)
    // TODO: Task 18 で REVEALING 状態への遷移とゲームストア更新を実装
  }

  /**
   * 正解発表終了ハンドラ（時間経過起点）
   * @param question 問題データ
   */
  private onEnd(question: QuizQuestion): void {
    console.log('[GameManager] onEnd:', question.index)

    // 次の問題に進む（または最後の問題ならそのまま）
    if (question.index < this.quizData.questions.length - 1) {
      // 次の問題のstartを監視するために、インデックスを次に進める
      this.currentQuestionIndex = question.index + 1
      console.log('[GameManager] Moving to next question:', this.currentQuestionIndex)
    } else {
      console.log('[GameManager] Last question completed')
    }

    // TODO: Task 18 で TALKING/FINISHED 状態への遷移とゲームストア更新を実装
  }

  /**
   * 解答送信後の処理（jumpToRevealPeriod対応）
   * @param questionIndex 問題インデックス
   * @param isCorrect 正解かどうか
   */
  submitAnswer(questionIndex: number, isCorrect: boolean): void {
    // TODO: Task 18 で解答検証とスコア更新を実装
    console.log('[GameManager] submitAnswer:', questionIndex, 'isCorrect:', isCorrect)

    if (!this.quizData.settings.jumpToRevealPeriod) {
      // jumpToRevealPeriod=false の場合、何もしない
      return
    }

    const question = this.quizData.questions[questionIndex]
    const currentVideoTime = this.timeManager.getCurrentVideoTime()

    // currentVideoTime < revealTime の場合のみシーク
    if (currentVideoTime < question.revealTime) {
      // consumed[questionIndex].reveal を先に設定して二重発火を防ぐ
      const c = this.consumed[questionIndex] ?? (this.consumed[questionIndex] = { start: false, reveal: false, end: false })
      c.reveal = true

      // revealTime にシーク
      this.internalAction = true
      this.playerManager.seekTo(question.revealTime)
      this.playerManager.playVideo()
      this.internalAction = false

      console.log('[GameManager] Jumped to reveal period:', question.revealTime)

      // TODO: Task 18 で REVEALING 状態への遷移を実装
    }
  }
}

/**
 * GameManagerインスタンスを作成
 */
export function createGameManager(
  playerManager: YouTubePlayerManager,
  quizData: QuizData,
): GameManager {
  return new GameManager(playerManager, quizData)
}
