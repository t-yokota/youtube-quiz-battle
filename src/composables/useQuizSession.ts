import { ref, shallowRef, shallowReadonly, onBeforeUnmount, watch } from 'vue'
import type { QuizData, YouTubePlayerManager } from '@/types'
import { GameState } from '@/types'
import { useGameStore } from '@/stores/gameStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { extractQuizIdFromUrl, loadQuizData } from '@/services/quizDataLoader'
import { createGameManager, type GameManager } from '@/services/gameManager'
import { createAudioManager } from '@/services/audioManager'
import { getErrorInfo } from '@/services/errorHandler'
import { MAX_VOLUME_LEVEL } from '@/constants/audio'
import { useGameLoop } from './useGameLoop'
import { logger } from '@/utils/logger'

/** データ取得・ゲーム操作・音声・終了処理を所有する。Player本体はVideoPlayerが所有する。 */
export function useQuizSession() {
  let disposed = false
  const dataLoadController = new AbortController()
  const gameStore = useGameStore()
  const settingsStore = useSettingsStore()
  const gameLoop = useGameLoop()
  const gameManager = shallowRef<GameManager | null>(null)
  const playerManagerRef = shallowRef<YouTubePlayerManager | null>(null)
  const quizData = ref<QuizData | null>(null)
  const initError = ref<{ title: string; message: string } | null>(null)
  // 音声管理（App レベルで単一インスタンスを保持）
  const audioManager = createAudioManager()
  audioManager.setSoundEnabled(settingsStore.soundEnabled)
  audioManager.setVolume(settingsStore.volumeLevel / MAX_VOLUME_LEVEL)
  audioManager.init().catch((error: unknown) => {
    if (disposed) return
    logger.error('[useQuizSession] Failed to initialize AudioManager:', error)
    initError.value = getErrorInfo(error)
  })

  watch(
    () => settingsStore.volumeLevel,
    (level) => {
      audioManager.setVolume(level / MAX_VOLUME_LEVEL)
    },
  )

  watch(
    () => settingsStore.soundEnabled,
    (enabled) => {
      audioManager.setSoundEnabled(enabled)
    },
  )

  // --- 初期化 ---

  // クイズデータをロード（?quiz= で指定、未指定時は sample）
  const currentQuizId = extractQuizIdFromUrl()

  async function initQuizData() {
    try {
      logger.log(`[useQuizSession] Loading quiz data for quizId: ${currentQuizId}`)
      const data = await loadQuizData(currentQuizId, dataLoadController.signal)
      if (disposed) return
      quizData.value = data
      gameStore.setQuizData(quizData.value)
      logger.log(`[useQuizSession] Quiz data loaded: ${quizData.value.questions.length} questions`)
    } catch (error) {
      if (disposed) return
      logger.error('[useQuizSession] Failed to load quiz data:', error)
      initError.value = getErrorInfo(error)
    }
  }

  // クイズデータを即時ロード開始
  initQuizData()

  // VideoPlayer 初期化完了時のハンドラ
  function handlePlayerReady(playerManager: YouTubePlayerManager) {
    if (disposed || initError.value || !quizData.value) return

    // GameManager を作成して初期化
    const manager = createGameManager(
      playerManager,
      quizData.value,
      gameStore,
      audioManager,
      settingsStore,
    )
    manager.initializeExternalPauseHandling()
    gameManager.value = manager
    playerManagerRef.value = playerManager
    logger.log('[useQuizSession] GameManager initialized')

    // Time Update Loop を開始（getCurrentTime() ポーリングに一本化）
    gameLoop.start(playerManager, manager)

    // READY 状態へ遷移
    gameStore.transitionToState(GameState.READY)
  }

  // VideoPlayer 初期化エラー時のハンドラ
  // VideoPlayer からは生の内部メッセージ（例: "YouTube Player Error: 2"）が渡ってくるため、
  // YOUTUBE_LOAD_FAILED として分類されるようコード接頭辞を付与してから変換する
  function handlePlayerError(message: string) {
    if (disposed) return
    logger.error('[useQuizSession] VideoPlayer error:', message)
    initError.value = getErrorInfo(new Error(`YOUTUBE_LOAD_FAILED: ${message}`))
  }

  // 音声など別の初期化が遅れて失敗した場合も、動作中のゲームを止める。
  watch(
    initError,
    (error) => {
      if (!error || disposed) return
      gameLoop.stop()
      gameManager.value?.destroy()
      gameManager.value = null
      playerManagerRef.value?.pauseVideo()
      audioManager.stopSound()
    },
    { flush: 'sync' },
  )

  function primeMedia(): boolean {
    if (disposed || initError.value || gameStore.currentState !== GameState.READY) return false
    // ユーザー操作内の同期呼び出しを維持する。Promiseやタイマーを挟まない。
    gameManager.value?.warmupVideoPlayback()
    audioManager.unlock()
    return true
  }

  onBeforeUnmount(() => {
    disposed = true
    dataLoadController.abort()
    gameLoop.stop()
    gameManager.value?.destroy()
    gameManager.value = null
    playerManagerRef.value = null
    audioManager.dispose()
  })

  return {
    currentQuizId,
    quizData: shallowReadonly(quizData),
    playerManagerRef: shallowReadonly(playerManagerRef),
    initError: shallowReadonly(initError),
    handlePlayerReady,
    handlePlayerError,
    primeMedia,
    pressButton: () => gameManager.value?.handleButtonPress(),
    submitAnswer: (answer: string) => gameManager.value?.handleAnswerSubmit(answer),
    replay: () => gameManager.value?.handleReplay(),
    pauseForOrientation: () => gameManager.value?.pauseExternalForOrientation(),
    resumeForOrientation: () => gameManager.value?.resumeExternalIfReason('orientation'),
  }
}
