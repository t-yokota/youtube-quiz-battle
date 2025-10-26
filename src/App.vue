<script setup lang="ts">
// YouTube Quiz Battle - メインアプリケーション
import AppHeader from './components/AppHeader.vue'
import VideoPlayer from './components/VideoPlayer.vue'
import GameInfo from './components/GameInfo.vue'
import AnswerArea from './components/AnswerArea.vue'
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
      <section class="button-area">
        <button class="quiz-button">早押しボタン</button>
      </section>
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

/* Quiz Button Area */
.button-area {
  flex: 1;
  display: grid;
  place-items: center;
  min-height: 0;
  padding: 1rem;
  position: relative;
  overflow: hidden;
  container-type: size;
}

.quiz-button {
  /* ボタンサイズの計算: 3:4比率を厳密に維持 */
  /* gridとcontainer queriesを使用して、利用可能なスペースに収める */
  width: min(
    80cqw,
    calc(100cqh * 0.75),
    300px
  );
  height: auto;
  aspect-ratio: 3 / 4;
  background-color: #ef4444;
  color: white;
  font-size: 1.5rem;
  font-weight: bold;
  border: none;
  border-radius: 1rem;
  cursor: pointer;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.quiz-button:hover {
  background-color: #dc2626;
  transform: translateY(-2px);
  box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
}

.quiz-button:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* モバイル対応 */
@media (max-width: 640px) {
  .main-content {
    padding: 0.5rem;
    gap: 0.5rem;
  }

  .button-area {
    padding: 0.75rem;
  }

  .quiz-button {
    font-size: 1.25rem;
    width: min(
      85cqw,
      calc(100cqh * 0.75),
      250px
    );
  }
}

/* 小さい画面での追加調整 */
@media (max-height: 700px) {
  .main-content {
    padding: 0.5rem;
    gap: 0.5rem;
  }

  .button-area {
    padding: 0.5rem;
  }

  .quiz-button {
    font-size: 1.125rem;
  }
}
</style>
