<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { loadYouTubeIframeAPI, createYouTubePlayerManager } from '@/services/youtubePlayer'
import { loadQuizData } from '@/services/quizDataLoader'
import { createGameManager, type GameManager } from '@/services/gameManager'
import type { YouTubePlayerManager } from '@/types'
import { TIME_UPDATE_INTERVAL_MS, STARTUP_GRACE_MS } from '@/constants/timing'
import { useGameStore } from '@/stores/gameStore'

// 動作確認用の簡易実装
const gameStore = useGameStore()
const playerManager = ref<YouTubePlayerManager | null>(null)
const gameManager = ref<GameManager | null>(null)
const isLoading = ref(true)
const errorMessage = ref<string | null>(null)
let timeUpdateIntervalId: number | null = null

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

    // 2. YouTube Player を作成
    console.log('\n[2] Creating YouTube Player...')
    await loadYouTubeIframeAPI()
    playerManager.value = await createYouTubePlayerManager(
      'youtube-player-element',
      quizData.videoId, // データファイルに記載された実際の動画ID
      quizData.settings,
    )
    console.log('✓ YouTube Player created successfully')

    // 3. GameManager を作成してExternal Pause Handlingを初期化
    console.log('\n[3] Initializing GameManager...')
    gameManager.value = createGameManager(playerManager.value, quizData, gameStore)
    gameManager.value.initializeExternalPauseHandling()
    console.log('✓ GameManager initialized')

    // 4. Time Update Loop を開始
    console.log('\n[4] Starting Time Update Loop...')
    const startedAt = performance.now()

    function timeUpdateTick() {
      if (!playerManager.value || !gameManager.value) return

      const now = performance.now()
      const current = playerManager.value.getCurrentTime()

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
    console.log('✓ Time Update Loop started (interval:', TIME_UPDATE_INTERVAL_MS, 'ms)')

    console.log('\n=== 初期化完了 ===')
    console.log('動画を再生して、状態遷移を確認してください。')
    console.log('コンソールに "[GameManager] onStart/onReveal/onEnd" のログが表示されます。')
    console.log('\n=== 動作確認完了 ===\n')
    isLoading.value = false
  } catch (error) {
    console.error('Failed to initialize:', error)
    errorMessage.value = error instanceof Error ? error.message : 'Unknown error'
    isLoading.value = false
  }
})

onUnmounted(() => {
  // Time Update Loop のクリーンアップ
  if (timeUpdateIntervalId !== null) {
    window.clearInterval(timeUpdateIntervalId)
    timeUpdateIntervalId = null
    console.log('[VideoPlayer] Time Update Loop stopped')
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
