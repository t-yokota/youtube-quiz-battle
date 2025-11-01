<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { loadYouTubeIframeAPI, createYouTubePlayerManager } from '@/services/youtubePlayer'
import { loadQuizData } from '@/services/quizDataLoader'
import { createTimeManager } from '@/services/timeManager'
import type { YouTubePlayerManager } from '@/types'

// 動作確認用の簡易実装
const playerManager = ref<YouTubePlayerManager | null>(null)
const isLoading = ref(true)
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  try {
    console.log('=== YouTube Quiz Battle 動作確認 ===')

    // 1. クイズデータを読み込み
    console.log('\n[1] Loading Quiz Data...')
    const videoId = 'sample' // サンプルデータを使用
    const quizData = await loadQuizData(videoId)
    console.log('✓ Quiz Data loaded:', {
      videoId: quizData.videoId,
      questionCount: quizData.questions.length,
      settings: quizData.settings,
    })

    // 2. TimeManager 動作確認
    console.log('\n[2] Testing TimeManager...')
    const timeManager = createTimeManager(quizData.questions)

    // テスト: シーク検出（連続視聴のシミュレーション）
    console.log('\n--- シーク検出テスト ---')
    console.log('【連続視聴のシミュレーション】')

    // 時刻 0秒
    timeManager.updateCurrentVideoTime(0)
    console.log('時刻 0秒 - シーク検出:', timeManager.isSeekDetected(0), '(期待: false)')
    timeManager.updateWatchedVideoTime(0)

    // 時刻 0.15秒
    timeManager.updateCurrentVideoTime(0.15)
    console.log('時刻 0.15秒 - シーク検出:', timeManager.isSeekDetected(0.15), '(期待: false)')
    timeManager.updateWatchedVideoTime(0.15)

    // 時刻 0.3秒
    timeManager.updateCurrentVideoTime(0.3)
    console.log('時刻 0.3秒 - シーク検出:', timeManager.isSeekDetected(0.3), '(期待: false)')
    timeManager.updateWatchedVideoTime(0.3)

    // 時刻 0.45秒
    timeManager.updateCurrentVideoTime(0.45)
    console.log('時刻 0.45秒 - シーク検出:', timeManager.isSeekDetected(0.45), '(期待: false)')
    timeManager.updateWatchedVideoTime(0.45)

    console.log('【シーク操作（15秒へジャンプ）】')
    timeManager.updateCurrentVideoTime(15.0)
    console.log('時刻 15.0秒 - シーク検出:', timeManager.isSeekDetected(15.0), '(期待: true!)')
    // シーク検出時はwatchedVideoTimeを更新しない（または強制リセット）

    // テスト: 状態判定
    console.log('\n--- 状態判定テスト ---')

    timeManager.updateCurrentVideoTime(0)
    console.log('時刻 0秒, index=-1:', timeManager.getCurrentGameState(-1), '(期待: TALKING)')

    timeManager.updateCurrentVideoTime(5.0)
    console.log('時刻 5.0秒, index=0:', timeManager.getCurrentGameState(0), '(期待: QUESTIONING)')

    timeManager.updateCurrentVideoTime(19.0)
    console.log('時刻 19.0秒, index=0:', timeManager.getCurrentGameState(0), '(期待: REVEALING)')

    timeManager.updateCurrentVideoTime(21.0)
    console.log('時刻 21.0秒, index=0:', timeManager.getCurrentGameState(0), '(期待: TALKING)')

    timeManager.updateCurrentVideoTime(90.0)
    console.log('時刻 90.0秒, index=4:', timeManager.getCurrentGameState(4), '(期待: FINISHED)')

    // 3. YouTube Player を作成
    console.log('\n[3] Creating YouTube Player...')
    await loadYouTubeIframeAPI()
    playerManager.value = await createYouTubePlayerManager(
      'youtube-player-element',
      quizData.videoId, // データファイルに記載された実際の動画ID
      quizData.settings,
    )
    console.log('✓ YouTube Player created successfully')

    console.log('\n=== 動作確認完了 ===\n')
    isLoading.value = false
  } catch (error) {
    console.error('Failed to initialize:', error)
    errorMessage.value = error instanceof Error ? error.message : 'Unknown error'
    isLoading.value = false
  }
})
</script>

<template>
  <div class="video-player-container">
    <div class="video-player-wrapper">
      <!-- ローディング中 -->
      <div v-if="isLoading" class="video-placeholder">
        <div class="placeholder-content">
          <p class="placeholder-text">読み込み中...</p>
        </div>
      </div>

      <!-- エラー時 -->
      <div v-else-if="errorMessage" class="video-placeholder">
        <div class="placeholder-content">
          <p class="placeholder-text">エラー</p>
          <p class="placeholder-subtext">{{ errorMessage }}</p>
        </div>
      </div>

      <!-- YouTube Player -->
      <div id="youtube-player-element"></div>
    </div>
  </div>
</template>

<style scoped>
/* Video Player Container */
.video-player-container {
  width: 100%;
  flex-shrink: 0;
}

/* Video Player Wrapper - 16:9アスペクト比維持 */
.video-player-wrapper {
  width: 100%;
  aspect-ratio: 16 / 9;
  position: relative;
  overflow: hidden;
  border-radius: 0.5rem;
  background-color: #000;
}

/* YouTube Player Element - iframeをコンテナに合わせる */
#youtube-player-element {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

/* YouTube iframe（YT.Playerが自動生成）のスタイル調整 */
#youtube-player-element :deep(iframe) {
  width: 100% !important;
  height: 100% !important;
  border-radius: 0.5rem;
}

/* Placeholder */
.video-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: #9ca3af;
}

.play-icon {
  width: 4rem;
  height: 4rem;
  opacity: 0.5;
}

.placeholder-text {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #d1d5db;
}

.placeholder-subtext {
  margin: 0;
  font-size: 0.875rem;
  color: #9ca3af;
}

/* モバイル対応 */
@media (max-width: 640px) {
  .video-player-wrapper {
    border-radius: 0.375rem;
  }

  .play-icon {
    width: 3rem;
    height: 3rem;
  }

  .placeholder-text {
    font-size: 1.125rem;
  }

  .placeholder-subtext {
    font-size: 0.8125rem;
  }
}

/* 小さい画面での追加調整 */
@media (max-height: 700px) {
  .play-icon {
    width: 2.5rem;
    height: 2.5rem;
  }

  .placeholder-text {
    font-size: 1rem;
  }

  .placeholder-subtext {
    font-size: 0.75rem;
  }

  .placeholder-content {
    gap: 0.75rem;
  }
}
</style>
