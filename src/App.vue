<script setup lang="ts">
// YouTube Quiz Battle - メインアプリケーション
import { ref } from 'vue'
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

// ResultArea表示確認用のダミーデータ
const dummyResults = [
  { questionNumber: 1, isCorrect: true, correctAnswer: '東京', userAnswer: '東京' },
  { questionNumber: 2, isCorrect: false, correctAnswer: '織田信長', userAnswer: '豊臣秀吉' },
  { questionNumber: 3, isCorrect: true, correctAnswer: '富士山', userAnswer: 'ふじさん' },
  { questionNumber: 4, isCorrect: false, correctAnswer: '徳川家康', userAnswer: '徳川吉宗' },
  { questionNumber: 5, isCorrect: true, correctAnswer: '太平洋', userAnswer: '太平洋' },
]

// モーダル・ダイアログの表示状態（Phase 1: 表示確認用）
const isSettingsOpen = ref(false)
const isLoadingOpen = ref(false)
const isOrientationOpen = ref(false)
const isErrorOpen = ref(false)

// 音声設定の状態（Phase 1: 表示確認用）
const volumeLevel = ref(3)

// SettingsModal イベントハンドラ
const handleOpenSettings = () => {
  isSettingsOpen.value = true
}

const handleCloseSettings = () => {
  isSettingsOpen.value = false
}

const handleUpdateVolume = (level: number) => {
  volumeLevel.value = level
}

// ErrorDialog イベントハンドラ
const handleErrorAction = () => {
  window.location.reload()
}

const handleCloseError = () => {
  isErrorOpen.value = false
}
</script>

<template>
  <div class="app-container">
    <!-- Header -->
    <AppHeader @open-settings="handleOpenSettings" />

    <!-- Main Content Area -->
    <main class="main-content">
      <!-- Video Player -->
      <VideoPlayer />

      <!-- Game UI (通常のゲーム中) -->
      <!-- <div class="game-ui">
        <GamePanel
          mode="guide"
          :current-question-number="0"
          :total-questions="5"
          :correct-count="0"
          :incorrect-count="0"
          :remaining-attempts="2"
          :remaining-time="10"
          answer-result="correct"
          answer-input=""
          :is-input-disabled="false"
        />
        <QuizButton button-state="standby" />
      </div> -->

      <!-- Result UI (FINISHED状態) - 表示確認用 -->
      <div class="result-ui">
        <div class="result-content">
          <FinalScore :correct-count="3" :total-questions="5" />
          <ResultTable :results="dummyResults" :show-user-answers="true" />
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

    <LoadingDialog :is-open="isLoadingOpen" message="読み込み中..." />

    <OrientationDialog :is-open="isOrientationOpen" />

    <ErrorDialog
      :is-open="isErrorOpen"
      title="エラーが発生しました"
      message="問題が発生しました。ページを再読み込みしてください。"
      @action="handleErrorAction"
      @close="handleCloseError"
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
