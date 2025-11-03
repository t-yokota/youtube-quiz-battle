// ゲーム管理サービス
import type { QuizData, YouTubePlayerManager } from '@/types'
import { createTimeManager, TimeManager } from './timeManager'
import { STALL_WALL_MS, STALL_VIDEO_DELTA_SEC } from '@/constants/timing'

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
