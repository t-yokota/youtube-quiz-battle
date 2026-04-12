<script setup lang="ts">
// YouTube Quiz Battle - メインアプリケーション
import { ref, onUnmounted } from 'vue'
import AppHeader from './components/common/AppHeader.vue'
import VideoPlayer from './components/common/VideoPlayer.vue'
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
import { extractVideoIdFromUrl, loadQuizData } from './services/quizDataLoader'
import { createGameManager, type GameManager } from './services/gameManager'
import { GameState } from './types'
import type { QuizData, YouTubePlayerManager } from './types'
import { TIME_UPDATE_INTERVAL_MS, STARTUP_GRACE_MS } from './constants/timing'

const gameStore = useGameStore()

// GameManager とタイマーの参照
const gameManager = ref<GameManager | null>(null)
let timeUpdateIntervalId: number | null = null

// クイズデータ（VideoPlayerに渡す）
const quizData = ref<QuizData | null>(null)

// 初期化エラー
const initError = ref<string | null>(null)

// モーダル・ダイアログの表示状態
const isSettingsOpen = ref(false)
const isOrientationOpen = ref(false)

// 音声設定の状態
const volumeLevel = ref(3)

// --- 初期化 ---

// クイズデータをロード（URL パラメータ優先、未指定時は sample フォールバック）
async function initQuizData() {
  try {
    const videoId = extractVideoIdFromUrl() || 'sample'
    console.log(`[App] Loading quiz data for videoId: ${videoId}`)
    quizData.value = await loadQuizData(videoId)
    gameStore.setQuizData(quizData.value)
    console.log(`[App] Quiz data loaded: ${quizData.value.questions.length} questions`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[App] Failed to load quiz data:', error)
    initError.value = message
  }
}

// クイズデータを即時ロード開始
initQuizData()

// VideoPlayer 初期化完了時のハンドラ
function handlePlayerReady(playerManager: YouTubePlayerManager) {
  if (!quizData.value) return

  // GameManager を作成して初期化
  gameManager.value = createGameManager(playerManager, quizData.value, gameStore)
  gameManager.value.initializeExternalPauseHandling()
  console.log('[App] GameManager initialized')

  // Time Update Loop を開始
  const startedAt = performance.now()

  function timeUpdateTick() {
    if (!gameManager.value) return

    const now = performance.now()
    const current = playerManager.getCurrentTime()

    // 再生開始直後の誤検出回避
    if (now - startedAt < STARTUP_GRACE_MS) {
      return
    }

    // 再生停滞（stall）検出
    gameManager.value.checkStall(now, current)

    // 通常の時間更新・シーク検出・状態判定を実施
    gameManager.value.updateVideoTime(current)
  }

  timeUpdateIntervalId = window.setInterval(timeUpdateTick, TIME_UPDATE_INTERVAL_MS)
  console.log(`[App] Time Update Loop started (interval: ${TIME_UPDATE_INTERVAL_MS}ms)`)

  // READY 状態へ遷移
  gameStore.transitionToState(GameState.READY)
}

// VideoPlayer 初期化エラー時のハンドラ
function handlePlayerError(message: string) {
  initError.value = message
}

// --- イベントハンドラ ---

// QuizButton 押下 → GameManager に委譲
function handleButtonPress() {
  gameManager.value?.handleButtonPress()
}

// GamePanel 解答送信
function handleAnswerSubmit(answer: string) {
  gameStore.handleAnswerSubmit(answer)
}

// GamePanel 入力更新
function handleUpdateInput(value: string) {
  gameStore.updateAnswerInput(value)
}

// SettingsModal
const handleOpenSettings = () => {
  isSettingsOpen.value = true
}

const handleCloseSettings = () => {
  isSettingsOpen.value = false
}

const handleUpdateVolume = (level: number) => {
  volumeLevel.value = level
}

// ErrorDialog
const handleErrorAction = () => {
  window.location.reload()
}

// --- クリーンアップ ---
onUnmounted(() => {
  if (timeUpdateIntervalId !== null) {
    window.clearInterval(timeUpdateIntervalId)
    timeUpdateIntervalId = null
    console.log('[App] Time Update Loop stopped')
  }
})
</script>

<template>
  <div class="app-container">
    <!-- Header -->
    <AppHeader @open-settings="handleOpenSettings" />

    <!-- Main Content Area -->
    <main class="main-content">
      <!-- Video Player -->
      <VideoPlayer
        v-if="quizData"
        :video-id="quizData.videoId"
        :settings="quizData.settings"
        @ready="handlePlayerReady"
        @error="handlePlayerError"
      />

      <!-- Game UI (FINISHED以外) -->
      <div v-if="gameStore.currentState !== GameState.FINISHED" class="game-ui">
        <GamePanel
          :mode="gameStore.gamePanelMode"
          :guide-text="gameStore.guideText"
          :current-question-number="gameStore.currentQuestionNumber"
          :total-questions="gameStore.totalQuestions"
          :correct-count="gameStore.correctCount"
          :incorrect-count="gameStore.incorrectCount"
          :remaining-attempts="gameStore.remainingAttempts"
          :remaining-time="gameStore.answerTimeRemaining"
          :answer-result="gameStore.answerResult"
          :answer-input="gameStore.answerInput"
          :is-input-disabled="gameStore.isInputDisabled"
          @submit="handleAnswerSubmit"
          @update-input="handleUpdateInput"
        />
        <QuizButton
          v-if="gameStore.isButtonVisible"
          :button-state="gameStore.buttonState.toLowerCase() as 'standby' | 'pushed' | 'released' | 'disabled'"
          @press="handleButtonPress"
        />
      </div>

      <!-- Result UI (FINISHED状態) -->
      <div v-else class="result-ui">
        <div class="result-content">
          <FinalScore :correct-count="gameStore.correctCount" :total-questions="gameStore.totalQuestions" />
          <ResultTable :results="gameStore.results" :show-user-answers="true" />
        </div>
        <ResultActions />
      </div>
    </main>

    <!-- Modals and Dialogs -->
    <SettingsModal
      :is-open="isSettingsOpen"
      :volume-level="volumeLevel"
      @close="handleCloseSettings"
      @update-volume="handleUpdateVolume"
    />

    <LoadingDialog :is-open="gameStore.currentState === GameState.LOADING" message="読み込み中..." />

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
  background-color: #f5f5f5;
  overflow: hidden;
}

/* Main Content */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1rem;
  gap: 1rem;
  min-height: 0;
}

/* Game UI */
.game-ui {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  min-height: 0;
}

/* Result UI */
.result-ui {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  min-height: 0;
}

/* Result Content (スクロール可能領域) */
.result-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  margin-bottom: 1.5rem;
}

/* モバイル対応 */
@media (max-width: 640px) {
  .main-content {
    padding: 0.5rem;
    gap: 0.5rem;
  }

  .game-ui {
    gap: 1rem;
    padding: 0.75rem;
  }

  .result-ui {
    padding: 0.75rem;
  }

  .result-content {
    gap: 1rem;
    margin-bottom: 1rem;
  }
}

/* 小さい画面での追加調整 */
@media (max-height: 700px) {
  .main-content {
    padding: 0.5rem;
    gap: 0.5rem;
  }

  .game-ui {
    gap: 1rem;
    padding: 0.75rem;
  }

  .result-ui {
    padding: 0.75rem;
  }

  .result-content {
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }
}
</style>
