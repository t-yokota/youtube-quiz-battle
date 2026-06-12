// ゲーム管理サービス
import type { QuizData, QuizQuestion, YouTubePlayerManager } from '@/types'
import { GameState, ButtonState } from '@/types'
import { YouTubePlayerState } from '@/types/youtubePlayer'
import { createTimeManager, TimeManager } from './timeManager'
import {
  STALL_WALL_MS,
  STALL_VIDEO_DELTA_SEC,
  TIME_EPSILON_SEC,
  BUTTON_PUSHED_DURATION_MS,
  BUTTON_CHECK_RELEASE_MS,
  ANSWER_COUNTDOWN_INTERVAL_MS,
  YOUTUBE_REWIND_THRESHOLD_SEC,
} from '@/constants/timing'
import type { useGameStore } from '@/stores/gameStore'
import { logger } from '@/utils/logger'

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
  private gameStore: ReturnType<typeof useGameStore>

  // External Pause関連
  private externalPaused: boolean = false
  private externalPausedReason: 'visibility' | 'user' | 'stall' | null = null
  private internalAction: boolean = false

  // 再生停滞（stall）の検出用
  private lastWallMs: number = 0
  private lastVideoTime: number = 0

  // Single-Shot Guard: 問題ごとの閾値消費フラグ
  private consumed: Record<number, ConsumedFlags> = {}

  // YouTube Playerによる巻き戻し関連
  private hasPassedRewindThreshold: boolean = false // 閾値通過フラグ

  // 解答カウントダウンタイマー（ANSWERING中の制限時間管理）
  private answerCountdownInterval: number | null = null

  // 登録済みイベントリスナーの参照（destroy() で解除するために保持）
  private visibilityChangeHandler: (() => void) | null = null
  private pageHideHandler: (() => void) | null = null
  private pageShowHandler: (() => void) | null = null

  constructor(
    playerManager: YouTubePlayerManager,
    quizData: QuizData,
    gameStore: ReturnType<typeof useGameStore>,
  ) {
    this.playerManager = playerManager
    this.quizData = quizData
    this.gameStore = gameStore
    this.timeManager = createTimeManager(quizData.questions)
  }

  /**
   * ゲームをリセットして最初から開始できるようにする
   * 「もう一度プレイ」ボタン押下時に呼び出される
   */
  resetGame(): void {
    // カウントダウンタイマーを停止
    this.stopAnswerCountdown()

    // YouTube Player巻き戻しフラグをリセット
    this.hasPassedRewindThreshold = false

    // 問題の消費フラグをリセット
    this.consumed = {}

    // ゲームストアの状態をリセット
    this.gameStore.resetGame()

    // 時間管理システムの時間変数をリセット（currentVideoTime, previousVideoTimeを0に）
    this.timeManager.resetTimeValues()

    logger.log('[GameManager] Game reset')
  }

  /**
   * もう一度プレイ
   * FINISHED状態からゲームリセット → 動画を0秒にシーク → READY状態へ遷移
   */
  handleReplay(): void {
    if (this.gameStore.currentState !== GameState.FINISHED) return

    logger.log('[GameManager] Replay requested')

    // External Pause状態もクリア
    this.externalPaused = false
    this.externalPausedReason = null

    // ゲームリセット
    this.resetGame()

    // 動画を0秒にシーク
    this.internalAction = true
    this.playerManager.seekTo(0)
    this.internalAction = false

    // READY状態へ遷移
    this.gameStore.transitionToState(GameState.READY)
  }

  /**
   * 解答カウントダウンタイマーを開始
   * ANSWERING状態に入った時に呼び出す
   */
  private startAnswerCountdown(): void {
    this.stopAnswerCountdown()

    // answerTimeRemainingをリセット（再入場時のため）
    this.gameStore.resetAnswerTime()

    this.resumeAnswerCountdown()
  }

  /**
   * 解答カウントダウンタイマーを再開（External Pause復帰時用）
   * answerTimeRemainingはリセットせず、現在値から継続する
   */
  private resumeAnswerCountdown(): void {
    this.stopAnswerCountdown()

    this.answerCountdownInterval = window.setInterval(() => {
      const remaining = this.gameStore.decrementAnswerTime()

      if (remaining <= 0) {
        this.handleAnswerTimeout()
      }
    }, ANSWER_COUNTDOWN_INTERVAL_MS)

    logger.log('[GameManager] Answer countdown started:', this.gameStore.answerTimeRemaining)
  }

  /**
   * 解答カウントダウンタイマーを停止
   */
  private stopAnswerCountdown(): void {
    if (this.answerCountdownInterval !== null) {
      window.clearInterval(this.answerCountdownInterval)
      this.answerCountdownInterval = null
    }
  }

  /**
   * 解答制限時間切れ処理
   * カウントダウンが0になった時に呼ばれる。空文字で送信して不正解扱いにする。
   */
  private handleAnswerTimeout(): void {
    this.stopAnswerCountdown()
    logger.log('[GameManager] Answer timeout')

    // 空文字で送信（不正解扱い）
    const result = this.gameStore.handleAnswerSubmit('')
    if (result) {
      this.resumeVideoAfterAnswer(result)
    }
  }

  /**
   * 解答送信処理（App.vueから呼び出される）
   * gameStoreの判定を呼び出し、結果に応じて動画再開・タイマー停止を行う
   */
  handleAnswerSubmit(answer: string): void {
    this.stopAnswerCountdown()

    const result = this.gameStore.handleAnswerSubmit(answer)
    if (!result) return

    this.resumeVideoAfterAnswer(result)
  }

  /**
   * 解答結果に応じて動画を再開する
   * @param result handleAnswerSubmitの戻り値
   */
  private resumeVideoAfterAnswer(result: { isCorrect: boolean; isFinal: boolean }): void {
    if (result.isFinal) {
      // 正解 or 最終不正解 → 動画再開（jumpToRevealPeriod対応）
      const questionIndex = this.gameStore.currentQuestionIndex
      this.submitAnswer(questionIndex, result.isCorrect)

      // jumpToRevealPeriodでない場合は通常の動画再開
      if (!this.quizData.settings.jumpToRevealPeriod) {
        this.internalAction = true
        this.playerManager.playVideo()
        this.internalAction = false
      }
    } else {
      // リトライ可能（QUESTIONING に戻った） → 動画再開
      this.internalAction = true
      this.playerManager.playVideo()
      this.internalAction = false
    }
  }

  /**
   * ボタン押下処理
   * QuizButton の press イベントから App 経由で呼び出される
   * ボタン状態遷移・ゲーム状態遷移・動画制御を統合的に処理する
   */
  handleButtonPress(): void {
    if (!this.gameStore.isButtonEnabled) return

    logger.log(`[GameManager] Button pressed in state: ${this.gameStore.currentState}`)

    const stateAtPress = this.gameStore.currentState

    // ボタン状態遷移: STANDBY -> PUSHED -> RELEASED
    this.gameStore.setButtonState(ButtonState.PUSHED)
    setTimeout(() => {
      this.gameStore.setButtonState(ButtonState.RELEASED)

      if (stateAtPress === GameState.READY) {
        // ボタンチェック: BUTTON_CHECK_RELEASE_MS後にTALKING状態へ遷移し、動画再生開始
        setTimeout(() => {
          this.gameStore.setButtonState(ButtonState.STANDBY)
          this.gameStore.transitionToState(GameState.TALKING)
          // 動画再生開始
          this.internalAction = true
          this.playerManager.playVideo()
          this.internalAction = false
        }, BUTTON_CHECK_RELEASE_MS)
      } else if (stateAtPress === GameState.QUESTIONING) {
        // 早押し: ANSWERING状態へ遷移し、動画一時停止
        this.gameStore.transitionToState(GameState.ANSWERING)
        // 動画一時停止
        this.internalAction = true
        this.playerManager.pauseVideo()
        this.internalAction = false
        // カウントダウンタイマー開始
        this.startAnswerCountdown()
      }
    }, BUTTON_PUSHED_DURATION_MS)
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

    const currentVideoTime = this.playerManager.getCurrentTime()
    const previousVideoTime = this.timeManager.getPreviousVideoTime()

    logger.log('[GameManager] External pause started:', reason, {
      current: currentVideoTime,
      previous: previousVideoTime,
    })

    // 動画を停止
    // ANSWERING中は既に動画停止済みなのでpauseVideo()不要、カウントダウンのみ停止
    if (this.gameStore.currentState === GameState.ANSWERING) {
      this.stopAnswerCountdown()
    } else {
      this.internalAction = true
      this.playerManager.pauseVideo()
      this.internalAction = false
    }
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

    const previousVideoTime = this.timeManager.getPreviousVideoTime()
    const currentVideoTime = this.playerManager.getCurrentTime()

    // YouTube Playerの巻き戻し仕様への対応
    // - 5秒未満の位置から動画の再生を開始し、5秒を超える前に一度タブを移動・戻って動画を再開すると、タブ移動前の再生開始位置まで動画が巻き戻る
    // - 冒頭0秒からの再生開始時/5秒未満の位置にシークバーで移動したあとの再生開始時に、上記現象の発生条件を満たす
    // - タブに戻って動画の再開をする前にシークバーを操作すると、タブ移動前の再生開始位置ではなくシークバー操作後の位置から動画が再生される
    if (
      previousVideoTime < YOUTUBE_REWIND_THRESHOLD_SEC &&
      currentVideoTime < YOUTUBE_REWIND_THRESHOLD_SEC &&
      currentVideoTime < previousVideoTime
    ) {
      // 冒頭5秒以内の範囲でシステムによる動画の巻き戻りが発生した場合

      // 巻き戻り閾値を一度通過済みかをチェック
      // - 通過していない：冒頭からの再生開始直後
      // - 通過している　：シークバーで閾値以降から冒頭に戻ってきて動画を再開中
      if (!this.hasPassedRewindThreshold) {
        // 冒頭からの再生開始直後の場合：問題を最初からやり直せるようにconsumedフラグをリセット
        logger.log('[GameManager] System rewind detected immediately after starting playback')
        for (const question of this.quizData.questions) {
          const c = this.consumed[question.index]
          if (c) {
            // 解答記録がない場合のみリセット（既に結果が記録された問題はリセットしない）
            const recorded = this.gameStore.results.find(
              (r) => r.questionNumber === question.index + 1,
            )
            if (!recorded || recorded.skipped) {
              // skipped結果が残っていると重複ガードで再記録できないため削除
              if (recorded?.skipped) {
                this.gameStore.removeResult(question.index + 1)
              }
              this.consumed[question.index] = { start: false, reveal: false, end: false }
              logger.log('[GameManager] Reset consumed flags for question:', question.index)
            }
          }
        }
      }

      // シーク検知の回避のためにpreviousVideoTimeを更新
      this.timeManager.updatePreviousVideoTime(currentVideoTime)
      logger.log(
        '[GameManager] Updated previousVideoTime to avoid seek detection caused by system rewind:',
        {
          previous: this.timeManager.getPreviousVideoTime(),
        },
      )
    }

    logger.log('[GameManager] External pause ended:', prevReason, {
      current: currentVideoTime,
      previous: this.timeManager.getPreviousVideoTime(),
    })

    // 動画を再開
    // ANSWERING中は動画再開せず、カウントダウン再開のみ
    if (this.gameStore.currentState === GameState.ANSWERING) {
      this.resumeAnswerCountdown()
    } else {
      this.internalAction = true
      this.playerManager.playVideo()
      this.internalAction = false
    }
  }

  /**
   * 可視性変化（visibility）イベントハンドラーを設定
   */
  setupVisibilityHandlers(): void {
    this.visibilityChangeHandler = () => {
      if (document.hidden) {
        // タブが非表示になった時：動画が再生中またはANSWERING中にpause
        const playerState = this.playerManager.getPlayerState()
        if (
          playerState === YouTubePlayerState.PLAYING ||
          this.gameStore.currentState === GameState.ANSWERING
        ) {
          this.pauseExternal('visibility')
        }
      } else {
        // タブが表示された時：visibility pauseの場合のみresume
        if (this.externalPausedReason === 'visibility') {
          this.resumeExternal()
        }
      }
    }
    document.addEventListener('visibilitychange', this.visibilityChangeHandler)

    this.pageHideHandler = () => {
      const playerState = this.playerManager.getPlayerState()
      const isAnswering = this.gameStore.currentState === GameState.ANSWERING
      logger.log('[GameManager] Page hide', {
        playerState,
        isAnswering,
        willPause: playerState === YouTubePlayerState.PLAYING || isAnswering,
      })
      if (playerState === YouTubePlayerState.PLAYING || isAnswering) {
        this.pauseExternal('visibility')
      }
    }
    window.addEventListener('pagehide', this.pageHideHandler)

    this.pageShowHandler = () => {
      logger.log('[GameManager] Page show', {
        externalPausedReason: this.externalPausedReason,
        willResume: this.externalPausedReason === 'visibility',
      })
      if (this.externalPausedReason === 'visibility') {
        this.resumeExternal()
      }
    }
    window.addEventListener('pageshow', this.pageShowHandler)
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
      if (state === YouTubePlayerState.PAUSED) {
        // ANSWERING中の一時停止は内部操作（handleButtonPress由来）の
        // 非同期到達なので無視する
        if (this.gameStore.currentState === GameState.ANSWERING) return
        this.pauseExternal('user')
      }

      // PLAYING状態になった場合
      if (state === YouTubePlayerState.PLAYING) {
        // ANSWERING中にユーザーが再生ボタンを押した場合、即座に停止
        if (this.gameStore.currentState === GameState.ANSWERING) {
          this.internalAction = true
          this.playerManager.pauseVideo()
          this.internalAction = false
          return
        }

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
    const playbackIntended =
      playerState === YouTubePlayerState.PLAYING || playerState === YouTubePlayerState.BUFFERING

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
    // External Pause中は時間更新をスキップ
    if (this.externalPaused) {
      return
    }

    // FINISHED状態の場合は時間更新・状態遷移をスキップ（resetGame()でのみ解除）
    if (this.gameStore.currentState === GameState.FINISHED) {
      return
    }

    const prev = this.timeManager.getPreviousVideoTime()

    // 現在時刻を更新
    this.timeManager.updateCurrentVideoTime(current)

    // YouTube Player巻き戻り閾値の通過チェック
    if (!this.hasPassedRewindThreshold && current >= YOUTUBE_REWIND_THRESHOLD_SEC) {
      this.hasPassedRewindThreshold = true
      logger.log('[GameManager] Passed YouTube rewind threshold:', YOUTUBE_REWIND_THRESHOLD_SEC)
    }

    // シーク検出
    if (this.timeManager.isSeekDetected(current)) {
      logger.log('[GameManager] Seek detected:', prev, '->', current)

      if (
        this.gameStore.currentState === GameState.ANSWERING ||
        this.quizData.settings.disableSeekbar
      ) {
        // ANSWERING中 or disableSeekbar=true: 動画時間を強制リセット
        this.internalAction = true
        this.playerManager.seekTo(prev)
        this.internalAction = false
        // currentVideoTimeも元に戻す（submitAnswer内のrevealTime比較に影響するため）
        this.timeManager.updateCurrentVideoTime(prev)
        logger.log('[GameManager] Forced reset to:', prev)
        // previousVideoTimeは維持（更新しない）
      } else {
        // disableSeekbar=false: シークで飛ばした問題を消費（不参加）扱いに
        this.consumeQuestionsBySeek(prev, current)
        // previousVideoTimeを更新
        this.timeManager.updatePreviousVideoTime(current)
      }

      return
    }

    // 通常の時間更新: (prev, curr] 窓内の閾値を走査して状態遷移を処理
    this.processTimeWindow(prev, current)

    // previousVideoTimeを更新
    this.timeManager.updatePreviousVideoTime(current)
  }

  /**
   * シーク操作で飛ばした問題を消費（不参加）扱いにする
   * @param prev 直前の動画再生位置
   * @param curr 現在の動画再生位置
   */
  private consumeQuestionsBySeek(prev: number, curr: number): void {
    if (curr > prev) {
      // 前方シーク: [prev, curr]区間と重なる問題をendTimeまで消費（不参加）
      for (const question of this.quizData.questions) {
        // 重なり判定: q.startTime < curr && q.endTime > prev
        if (question.startTime < curr && question.endTime > prev) {
          const c =
            this.consumed[question.index] ??
            (this.consumed[question.index] = { start: false, reveal: false, end: false })
          c.start = true
          c.reveal = true
          c.end = true
          this.recordSkippedQuestion(question.index, true)
          logger.log('[GameManager] Consumed question by forward seek:', question.index)
        }
      }
    } else {
      // 後方シーク: prevが問題区間内だった場合、その問題を消費（不参加）
      for (const question of this.quizData.questions) {
        // prev が [startTime, endTime) 区間内か判定
        if (prev >= question.startTime && prev < question.endTime) {
          const c =
            this.consumed[question.index] ??
            (this.consumed[question.index] = { start: false, reveal: false, end: false })
          c.start = true
          c.reveal = true
          c.end = true
          this.recordSkippedQuestion(question.index, true)
          logger.log('[GameManager] Consumed question by backward seek:', question.index)
        }
      }
    }

    // シーク後の状態遷移
    const lastQuestion = this.quizData.questions[this.quizData.questions.length - 1]
    const allConsumed = this.quizData.questions.every((q) => {
      const c = this.consumed[q.index]
      return c && c.start && c.reveal && c.end
    })
    if (allConsumed && curr >= lastQuestion.endTime) {
      this.gameStore.transitionToState(GameState.FINISHED)
    } else {
      // シーク先が未消費の問題区間内ならWAITING、それ以外はTALKING
      const inUnconsumedQuestionRange = this.quizData.questions.some((q) => {
        const c = this.consumed[q.index]
        const isConsumed = c && c.start && c.reveal && c.end
        return !isConsumed && curr >= q.startTime && curr < q.endTime
      })
      this.gameStore.transitionToState(
        inUnconsumedQuestionRange ? GameState.WAITING : GameState.TALKING,
      )
    }
  }

  /**
   * (prev, curr] 窓内の閾値を走査して処理する
   * @param prev 前回の previousVideoTime
   * @param curr 現在の previousVideoTime
   */
  private processTimeWindow(prev: number, curr: number): void {
    // すべての問題の閾値を走査して処理
    for (const question of this.quizData.questions) {
      this.applyThresholds(prev, curr, question)
    }
  }

  /**
   * (prev, curr] 窓内の閾値を適用（Single-Shot Guard）
   * @param prev 前回の previousVideoTime
   * @param curr 現在の previousVideoTime
   * @param question 対象の問題
   */
  private applyThresholds(prev: number, curr: number, question: QuizQuestion): void {
    const c =
      this.consumed[question.index] ??
      (this.consumed[question.index] = { start: false, reveal: false, end: false })

    // start 閾値
    if (
      prev + TIME_EPSILON_SEC < question.startTime &&
      curr + TIME_EPSILON_SEC >= question.startTime
    ) {
      // currentQuestionIndexを更新（動画再生位置ベースの表示用）
      this.gameStore.setCurrentQuestionIndex(question.index)

      if (!c.start) {
        c.start = true
        this.onStart(question) // 副作用あり：初期化、QUESTIONING状態へ
      } else {
        // 消費済み：不参加、スキップとして記録
        this.recordSkippedQuestion(question.index, true)
        // 副作用なしで WAITING 状態へ遷移（スキップ済み問題）
        this.gameStore.transitionToState(GameState.WAITING)
        logger.log('[GameManager] Skipped question (already consumed):', question.index)
      }
    }

    // othersAnsweringPeriods 閾値（問題区間内の動画内プレイヤー解答期間）
    if (question.othersAnsweringPeriods) {
      for (const period of question.othersAnsweringPeriods) {
        // 期間開始閾値
        if (
          prev + TIME_EPSILON_SEC < period.startTime &&
          curr + TIME_EPSILON_SEC >= period.startTime
        ) {
          // WAITING 状態へ遷移（動画内プレイヤーの解答中）
          this.gameStore.transitionToState(GameState.WAITING)
          logger.log(
            '[GameManager] Entered OthersAnsweringPeriod:',
            period.startTime,
            '-',
            period.endTime,
          )
        }

        // 期間終了閾値
        if (prev + TIME_EPSILON_SEC < period.endTime && curr + TIME_EPSILON_SEC >= period.endTime) {
          // QUESTIONING 状態へ復帰
          this.gameStore.transitionToState(GameState.QUESTIONING)
          logger.log(
            '[GameManager] Exited OthersAnsweringPeriod:',
            period.startTime,
            '-',
            period.endTime,
          )
        }
      }
    }

    // reveal 閾値
    if (
      prev + TIME_EPSILON_SEC < question.revealTime &&
      curr + TIME_EPSILON_SEC >= question.revealTime
    ) {
      if (!c.reveal) {
        c.reveal = true
        this.onReveal(question) // 副作用あり：正解表示、REVEALING状態へ
      } else {
        // 副作用なしで REVEALING 状態へ遷移（既に消費済み）
        this.gameStore.transitionToState(GameState.REVEALING)
        logger.log('[GameManager] Already revealed (consumed):', question.index)
      }
    }

    // end 閾値
    if (prev + TIME_EPSILON_SEC < question.endTime && curr + TIME_EPSILON_SEC >= question.endTime) {
      if (!c.end) {
        c.end = true
        this.onEnd(question) // 副作用あり：スコア集計、TALKING/FINISHED状態へ
      } else {
        // 消費済み：既に終了済み
        logger.log('[GameManager] Already ended (consumed):', question.index)

        // すべての問題が消費済みかチェック
        const allConsumed = this.quizData.questions.every(
          (q) =>
            this.consumed[q.index]?.start &&
            this.consumed[q.index]?.reveal &&
            this.consumed[q.index]?.end,
        )

        // 最後の問題のendTimeを通過したかチェック
        const lastQuestion = this.quizData.questions[this.quizData.questions.length - 1]
        if (allConsumed && question.index === lastQuestion.index) {
          // 副作用なしで FINISHED 状態へ遷移
          this.gameStore.transitionToState(GameState.FINISHED)
          logger.log(
            '[GameManager] All questions consumed and last question ended, transitioning to FINISHED',
          )
        } else {
          // 副作用なしで TALKING 状態へ遷移
          this.gameStore.transitionToState(GameState.TALKING)
        }
      }
    }
  }

  /**
   * スキップ・未解答の問題を記録（0点、不参加扱い）
   * @param questionIndex 問題インデックス
   * @param isSkip 真のスキップか（consumed start経由=true、onEnd経由=false）
   */
  private recordSkippedQuestion(questionIndex: number, isSkip: boolean): void {
    const question = this.quizData.questions[questionIndex]
    if (!question) return

    // pendingUserAnswersは現在解答中の問題にのみ紐付ける
    const isCurrentQuestion = questionIndex === this.gameStore.currentQuestionIndex
    const userAnswers = isCurrentQuestion ? [...this.gameStore.pendingUserAnswers] : []
    const hasAttempted = isCurrentQuestion && this.gameStore.pendingUserAnswers.length > 0

    this.gameStore.recordResult(
      questionIndex + 1,
      false,
      question.answers[0],
      userAnswers,
      isSkip && !hasAttempted,
    )

    logger.log(
      '[GameManager] Recording',
      isSkip ? 'skipped' : hasAttempted ? 'incomplete answer' : 'unanswered',
      'question:',
      questionIndex,
    )
  }

  /**
   * 問題開始ハンドラ（時間経過起点）
   * @param question 問題データ
   */
  private onStart(question: QuizQuestion): void {
    logger.log('[GameManager] onStart:', question.index)

    // ゲームストアの currentQuestionIndex を更新
    this.gameStore.setCurrentQuestionIndex(question.index)

    // 問題単位の状態初期化（remainingAttempts / answerResult / answerInput をリセット）
    this.gameStore.initializeForQuestion()

    // QUESTIONING 状態へ遷移
    this.gameStore.transitionToState(GameState.QUESTIONING)
  }

  /**
   * 正解発表開始ハンドラ（時間経過起点）
   * @param question 問題データ
   */
  private onReveal(question: QuizQuestion): void {
    logger.log('[GameManager] onReveal:', question.index)

    // REVEALING 状態へ遷移
    this.gameStore.transitionToState(GameState.REVEALING)
  }

  /**
   * 正解発表終了ハンドラ（時間経過起点）
   * @param question 問題データ
   */
  private onEnd(question: QuizQuestion): void {
    logger.log('[GameManager] onEnd:', question.index)

    // この問題の結果が未記録（スキップ・未解答）の場合、未解答として記録
    this.recordSkippedQuestion(question.index, false)

    // 最後の問題かどうかをチェック
    const lastQuestion = this.quizData.questions[this.quizData.questions.length - 1]
    if (question.index === lastQuestion.index) {
      // 最後の問題 → FINISHED 状態へ遷移
      this.gameStore.transitionToState(GameState.FINISHED)
    } else {
      // 次の問題がある → TALKING 状態へ遷移
      this.gameStore.transitionToState(GameState.TALKING)
    }
  }

  /**
   * 解答送信後の処理（jumpToRevealPeriod対応）
   * @param questionIndex 問題インデックス
   * @param isCorrect 正解かどうか
   */
  submitAnswer(questionIndex: number, isCorrect: boolean): void {
    logger.log('[GameManager] submitAnswer:', questionIndex, 'isCorrect:', isCorrect)

    if (!this.quizData.settings.jumpToRevealPeriod) {
      // jumpToRevealPeriod=false の場合、何もしない
      return
    }

    const question = this.quizData.questions[questionIndex]
    const currentVideoTime = this.timeManager.getCurrentVideoTime()

    // currentVideoTime < revealTime の場合のみシーク
    if (currentVideoTime < question.revealTime) {
      // consumed[questionIndex].reveal を先に設定して二重発火を防ぐ
      const c =
        this.consumed[questionIndex] ??
        (this.consumed[questionIndex] = { start: false, reveal: false, end: false })
      c.reveal = true

      // revealTime にシーク
      this.internalAction = true
      this.playerManager.seekTo(question.revealTime)
      this.playerManager.playVideo()
      this.internalAction = false

      // REVEALING 状態への遷移
      this.gameStore.transitionToState(GameState.REVEALING)

      logger.log('[GameManager] Jumped to reveal period:', question.revealTime)
    }
  }

  /**
   * GameManager の破棄処理（リソースリーク防止）
   * - 解答カウントダウンタイマーを停止
   * - setupVisibilityHandlers で登録した document/window リスナーを解除
   *
   * 注意: setupPlayerStateHandlers が登録する onStateChange コールバックは
   * YouTubePlayerManager 側に解除 API がないため、ここでは解除しない。
   * App.vue の onUnmounted で destroy() の直後に playerManager.destroy() を呼び、
   * プレイヤー本体ごと破棄することでコールバックも到達しなくなる。
   */
  destroy(): void {
    // 解答カウントダウンタイマーを停止
    this.stopAnswerCountdown()

    // 可視性関連リスナーを解除
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler)
      this.visibilityChangeHandler = null
    }
    if (this.pageHideHandler) {
      window.removeEventListener('pagehide', this.pageHideHandler)
      this.pageHideHandler = null
    }
    if (this.pageShowHandler) {
      window.removeEventListener('pageshow', this.pageShowHandler)
      this.pageShowHandler = null
    }

    logger.log('[GameManager] Destroyed')
  }
}

/**
 * GameManagerインスタンスを作成
 */
export function createGameManager(
  playerManager: YouTubePlayerManager,
  quizData: QuizData,
  gameStore: ReturnType<typeof useGameStore>,
): GameManager {
  return new GameManager(playerManager, quizData, gameStore)
}
