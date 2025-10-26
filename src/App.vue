<script setup lang="ts">
// YouTube Quiz Battle - メインアプリケーション
import AppHeader from './components/AppHeader.vue'
import VideoPlayer from './components/VideoPlayer.vue'
import GameInfo from './components/GameInfo.vue'
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
      <section class="answer-area">
        <div class="answer-content">
          <!-- Answer Meta Information -->
          <div class="answer-meta">
            <span class="attempts-counter">残り 2回</span>
            <span class="answer-timer">残り 10秒</span>
            <span class="answer-result correct">正解！</span>
          </div>

          <!-- Answer Input -->
          <div class="answer-input-container">
            <input
              type="text"
              class="answer-input"
              placeholder="解答を入力"
              maxlength="100"
            />
            <button class="submit-button">送信</button>
          </div>
        </div>
      </section>

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

/* Answer Area */
.answer-area {
  flex-shrink: 0;
  background-color: white;
  padding: 0.875rem;
  border-radius: 0.75rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  height: 110px;
  display: flex;
  align-items: stretch;
}

/* Answer Content */
.answer-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

/* Answer Meta Information */
.answer-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  position: relative;
  height: 24px;
  flex-shrink: 0;
}

.attempts-counter {
  color: #2563eb;
  font-weight: bold;
  flex: 1;
}

.answer-timer {
  color: #ef4444;
  font-weight: bold;
  flex: 1;
  text-align: right;
}

.answer-result {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 1rem;
  font-weight: bold;
  padding: 0.25rem 0.75rem;
  border-radius: 0.375rem;
  white-space: nowrap;
}

.answer-result.correct {
  background: #dcfce7;
  color: #166534;
}

.answer-result.incorrect {
  background: #fef2f2;
  color: #dc2626;
}

/* Answer Input Container */
.answer-input-container {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}

.answer-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 1rem;
  outline: none;
  min-width: 0;
  height: 44px;
  box-sizing: border-box;
}

.answer-input:focus {
  border-color: #2563eb;
}

.answer-input:disabled {
  background: #f9fafb;
  color: #6b7280;
}

.submit-button {
  padding: 0.75rem 1rem;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
  height: 44px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}

.submit-button:hover:not(:disabled) {
  background: #1d4ed8;
}

.submit-button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
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

  .answer-area {
    padding: 0.75rem;
    height: 100px;
  }

  .answer-meta {
    font-size: 0.8125rem;
    margin-bottom: 0.375rem;
  }

  .answer-input,
  .submit-button {
    font-size: 0.9375rem;
    height: 40px;
  }

  .answer-input {
    padding: 0.625rem 0.875rem;
  }

  .submit-button {
    padding: 0.625rem 0.875rem;
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

  .answer-area {
    padding: 0.625rem;
    height: 90px;
  }

  .answer-meta {
    font-size: 0.75rem;
    margin-bottom: 0.25rem;
    height: 20px;
  }

  .answer-result {
    font-size: 0.875rem;
    padding: 0.125rem 0.5rem;
  }

  .answer-input,
  .submit-button {
    font-size: 0.875rem;
    height: 38px;
  }

  .answer-input {
    padding: 0.5rem 0.75rem;
  }

  .submit-button {
    padding: 0.5rem 0.75rem;
  }

  .button-area {
    padding: 0.5rem;
  }

  .quiz-button {
    font-size: 1.125rem;
  }
}
</style>
