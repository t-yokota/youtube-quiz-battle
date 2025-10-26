<script setup lang="ts">
// YouTube Quiz Battle - メインアプリケーション
import { ref } from 'vue'
import AppHeader from './components/AppHeader.vue'
import VideoPlayer from './components/VideoPlayer.vue'
// import GameInfo from './components/GameInfo.vue'
// import AnswerArea from './components/AnswerArea.vue'
// import QuizButton from './components/QuizButton.vue'
import ResultArea from './components/ResultArea.vue'
import SettingsModal from './components/SettingsModal.vue'
import LoadingDialog from './components/LoadingDialog.vue'
import OrientationDialog from './components/OrientationDialog.vue'
import ErrorDialog from './components/ErrorDialog.vue'

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

      <!-- Game Info (通常のゲーム中) -->
      <!-- <GameInfo :current-question="0" :total-questions="5" :correct-count="0" :incorrect-count="0" /> -->

      <!-- Answer Area (通常のゲーム中) -->
      <!-- <AnswerArea
        mode="answer"
        :remaining-attempts="2"
        :remaining-time="10"
        answer-result="correct"
        answer-input=""
        :is-input-disabled="false"
      /> -->

      <!-- Quiz Button Area (通常のゲーム中) -->
      <!-- <QuizButton button-state="standby" /> -->

      <!-- Result Area (FINISHED状態) - 表示確認用 -->
      <ResultArea
        :correct-count="3"
        :total-questions="5"
        :results="dummyResults"
        :show-user-answers="true"
      />
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

/* モバイル対応 */
@media (max-width: 640px) {
  .main-content {
    padding: 0.5rem;
    gap: 0.5rem;
  }
}

/* 小さい画面での追加調整 */
@media (max-height: 700px) {
  .main-content {
    padding: 0.5rem;
    gap: 0.5rem;
  }
}
</style>
