<script setup lang="ts">
// YouTube Quiz Battle - メインアプリケーション
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import AppHeader from './components/common/AppHeader.vue'
import VideoPlayer from './components/common/VideoPlayer.vue'
import GameInfo from './components/game/GameInfo.vue'
import GamePanel from './components/game/GamePanel.vue'
import QuizButton from './components/game/QuizButton.vue'
import FinalScore from './components/result/FinalScore.vue'
import ResultTable from './components/result/ResultTable.vue'
import ResultActions from './components/result/ResultActions.vue'
import SettingsModal from './components/dialogs/SettingsModal.vue'
import LoadingDialog from './components/dialogs/LoadingDialog.vue'
import OrientationDialog from './components/dialogs/OrientationDialog.vue'
import ErrorDialog from './components/dialogs/ErrorDialog.vue'
import { useGameStore } from './stores/gameStore'
import { useSettingsStore } from './stores/settingsStore'
import { extractVideoIdFromUrl, loadQuizData } from './services/quizDataLoader'
import { createGameManager, type GameManager } from './services/gameManager'
import { createAudioManager } from './services/audioManager'
import { getErrorMessage } from './services/errorHandler'
import { MAX_VOLUME_LEVEL } from './constants/audio'
import { useGameLoop } from './composables/useGameLoop'
import { useOrientationGuard } from './composables/useOrientationGuard'
import { GameState } from './types'
import type { QuizData, YouTubePlayerManager } from './types'
import { shouldHandleSpaceKey } from './utils/keyboardHandler'
import { logger } from './utils/logger'

const gameStore = useGameStore()
const settingsStore = useSettingsStore()

// 時間更新ループ（getCurrentTime() ポーリングに一本化）
const gameLoop = useGameLoop()

// GameManager の参照
const gameManager = ref<GameManager | null>(null)
const playerManagerRef = ref<YouTubePlayerManager | null>(null)

// クイズデータ（VideoPlayerに渡す）
const quizData = ref<QuizData | null>(null)

// 初期化エラー
const initError = ref<string | null>(null)

// モーダル・ダイアログの表示状態
const isSettingsOpen = ref(false)

// 画面向き検出（横画面時は External Pause で一時停止し、ダイアログを表示）
const { isLandscape: isOrientationOpen, stop: stopOrientationGuard } = useOrientationGuard(
  () => {
    gameManager.value?.pauseExternal('orientation')
  },
  () => {
    gameManager.value?.resumeExternalIfReason('orientation')
  },
)

// 音声管理（App レベルで単一インスタンスを保持）
const audioManager = createAudioManager()
audioManager.setSoundEnabled(settingsStore.soundEnabled)
audioManager.setVolume(settingsStore.volumeLevel / MAX_VOLUME_LEVEL)
audioManager.init().catch((error: unknown) => {
  logger.error('[App] Failed to initialize AudioManager:', error)
  initError.value = getErrorMessage(error)
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

// クイズデータをロード（URL パラメータ優先、未指定時は sample フォールバック）
async function initQuizData() {
  try {
    const videoId = extractVideoIdFromUrl() || 'sample'
    logger.log(`[App] Loading quiz data for videoId: ${videoId}`)
    quizData.value = await loadQuizData(videoId)
    gameStore.setQuizData(quizData.value)
    logger.log(`[App] Quiz data loaded: ${quizData.value.questions.length} questions`)
  } catch (error) {
    logger.error('[App] Failed to load quiz data:', error)
    initError.value = getErrorMessage(error)
  }
}

// クイズデータを即時ロード開始
initQuizData()

// VideoPlayer 初期化完了時のハンドラ
function handlePlayerReady(playerManager: YouTubePlayerManager) {
  if (!quizData.value) return

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
  logger.log('[App] GameManager initialized')

  // Time Update Loop を開始（getCurrentTime() ポーリングに一本化）
  gameLoop.start(playerManager, manager)

  // READY 状態へ遷移
  gameStore.transitionToState(GameState.READY)
}

// VideoPlayer 初期化エラー時のハンドラ
// VideoPlayer からは生の内部メッセージ（例: "YouTube Player Error: 2"）が渡ってくるため、
// YOUTUBE_LOAD_FAILED として分類されるようコード接頭辞を付与してから変換する
function handlePlayerError(message: string) {
  logger.error('[App] VideoPlayer error:', message)
  initError.value = getErrorMessage(new Error(`YOUTUBE_LOAD_FAILED: ${message}`))
}

// --- イベントハンドラ ---

// QuizButton 押下 → GameManager に委譲
function handleButtonPress() {
  gameManager.value?.handleButtonPress()
}

// スペースキー早押し（グローバルキーボードハンドラ）
function handleKeyDown(e: KeyboardEvent) {
  if (!shouldHandleSpaceKey(e)) return
  e.preventDefault() // スペースキーによるページスクロールを抑止
  handleButtonPress()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

// hideVideoPlayerDuringAnswer=true の場合、ANSWERING 中は動画を visibility で隠す（Task 20-4）
const shouldHidePlayer = computed(
  () =>
    (quizData.value?.settings.hideVideoPlayerDuringAnswer ?? false) &&
    gameStore.currentState === GameState.ANSWERING,
)

// GamePanel 解答送信 → GameManager に委譲
function handleAnswerSubmit(answer: string) {
  gameManager.value?.handleAnswerSubmit(answer)
}

// ResultActions もう一度プレイ → GameManager に委譲
function handleReplay() {
  gameManager.value?.handleReplay()
}

// SettingsModal
const handleOpenSettings = () => {
  isSettingsOpen.value = true
}

const handleCloseSettings = () => {
  isSettingsOpen.value = false
}

const handleUpdateVolume = (level: number) => {
  settingsStore.setVolumeLevel(level)
}

// ErrorDialog
const handleErrorAction = () => {
  window.location.reload()
}

// --- クリーンアップ ---
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)

  // 時間更新ループ停止 → GameManager 破棄 → Player 破棄 の順でリソースを解放
  gameLoop.stop()
  stopOrientationGuard()
  gameManager.value?.destroy()
  playerManagerRef.value?.destroy()
  playerManagerRef.value = null
})
</script>

<template>
  <div class="app-container">
    <!-- Header（FINISHED 中はリザルトステージに専有させるため非表示） -->
    <AppHeader
      v-show="gameStore.currentState !== GameState.FINISHED"
      @open-settings="handleOpenSettings"
    />

    <!-- Main Content Area -->
    <main class="main-content">
      <!-- Video Player（FINISHED 中は非表示。v-show で iframe を破棄せずプレイヤー状態を保持。
           hideVideoPlayerDuringAnswer=true の ANSWERING 中は visibility で隠す — 高さ保持・iframe 非破棄） -->
      <VideoPlayer
        v-if="quizData"
        v-show="gameStore.currentState !== GameState.FINISHED"
        :class="{ 'player-hidden': shouldHidePlayer }"
        :video-id="quizData.videoId"
        :settings="quizData.settings"
        @ready="handlePlayerReady"
        @error="handlePlayerError"
      />

      <!-- Game UI (FINISHED以外) -->
      <template v-if="gameStore.currentState !== GameState.FINISHED">
        <!-- スコアボード（video 直下にフルブリードで密着） -->
        <GameInfo />

        <div class="game-ui">
          <GamePanel @submit="handleAnswerSubmit" />
          <QuizButton
            v-if="gameStore.isButtonVisible"
            :button-state="gameStore.buttonState"
            @press="handleButtonPress"
          />
        </div>
      </template>

      <!-- Result UI (FINISHED状態) -->
      <div v-else class="result-ui">
        <div class="result-content">
          <FinalScore
            :correct-count="gameStore.correctCount"
            :total-questions="gameStore.totalQuestions"
          />
          <ResultTable :results="gameStore.results" :show-user-answers="true" />
        </div>
        <ResultActions @replay="handleReplay" />
      </div>
    </main>

    <!-- Modals and Dialogs -->
    <SettingsModal
      :is-open="isSettingsOpen"
      :volume-level="settingsStore.volumeLevel"
      @close="handleCloseSettings"
      @update-volume="handleUpdateVolume"
    />

    <LoadingDialog
      :is-open="gameStore.currentState === GameState.LOADING"
      message="読み込み中..."
    />

    <OrientationDialog :is-open="isOrientationOpen" />

    <ErrorDialog
      :is-open="!!initError"
      title="エラーが発生しました"
      :message="initError || '問題が発生しました。ページを再読み込みしてください。'"
      :show-close="false"
      @action="handleErrorAction"
    />
  </div>
</template>

<style scoped>
/* アプリケーション全体のコンテナ */
.app-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  /* ステージ背景: 下部に放射スポットライト + 縦方向グラデーション */
  background:
    radial-gradient(140% 60% at 50% 108%, rgba(255, 197, 61, 0.1) 0%, transparent 55%),
    linear-gradient(180deg, var(--color-stage-900) 0%, #0d1226 60%, #0a0e1d 100%);
  color: var(--color-text-main);
  overflow: hidden;
}

/* Main Content（wireframe: 各セクションはフルブリードで密着・余白は game-ui のみ） */
/* ANSWERING 中の動画非表示（高さ・iframe を保持したまま見えなくする） */
.player-hidden {
  visibility: hidden;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

/* Game UI（wireframe の .game-area 相当） */
.game-ui {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 0.875rem 0.75rem;
  min-height: 0;
}

/* Result UI（リザルトステージ: 上部に放射スポットライト） */
.result-ui {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.75rem 1.125rem 1.125rem;
  min-height: 0;
  background:
    radial-gradient(120% 50% at 50% 0%, rgba(255, 197, 61, 0.12) 0%, transparent 60%),
    linear-gradient(180deg, #0d1226 0%, var(--color-stage-900) 100%);
}

/* Result Content（タイムライン部分が内部で縦スクロールする） */
.result-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

/* 縦に短い画面のみ余白を詰める（上部セクションは wireframe の固定値を維持） */
@media (max-height: 640px) {
  .game-ui {
    gap: 0.625rem;
    padding: 0.625rem 0.75rem;
  }
}
</style>
