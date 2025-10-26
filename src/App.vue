<script setup lang="ts">
// YouTube Quiz Battle - メインアプリケーション
import AppHeader from './components/AppHeader.vue'
import VideoPlayer from './components/VideoPlayer.vue'
import GameInfo from './components/GameInfo.vue'
import AnswerArea from './components/AnswerArea.vue'
import QuizButton from './components/QuizButton.vue'
</script>

<template>
  <div class="app-container">
    <!-- Header -->
    <AppHeader />

    <!-- Main Content Area -->
    <main class="main-content">
      <!-- Video Player -->
      <VideoPlayer />

      <!-- Game Info -->
      <GameInfo :current-question="0" :total-questions="5" :correct-count="0" :incorrect-count="0" />

      <!-- Answer Area -->
      <AnswerArea
        mode="answer"
        :remaining-attempts="2"
        :remaining-time="10"
        answer-result="correct"
        answer-input=""
        :is-input-disabled="false"
      />

      <!-- Quiz Button Area -->
      <QuizButton button-state="standby" />
    </main>
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
