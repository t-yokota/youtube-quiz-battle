<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { loadYouTubeIframeAPI, createYouTubePlayerManager } from '@/services/youtubePlayer'
import type { YouTubePlayerManager, QuizSettings } from '@/types'
import { logger } from '@/utils/logger'

// Props定義
interface Props {
  videoId: string
  settings: QuizSettings
}

const props = defineProps<Props>()

// Emit定義
const emit = defineEmits<{
  ready: [playerManager: YouTubePlayerManager]
  error: [message: string]
}>()

const isLoading = ref(true)
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  try {
    // YouTube Player を作成
    await loadYouTubeIframeAPI()
    const playerManager = await createYouTubePlayerManager(
      'youtube-player-element',
      props.videoId,
      props.settings,
    )

    isLoading.value = false
    emit('ready', playerManager)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error('[VideoPlayer] Failed to initialize:', error)
    errorMessage.value = message
    isLoading.value = false
    emit('error', message)
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
  background-color: var(--color-legacy-black);
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
  background: linear-gradient(135deg, var(--color-legacy-video-bg-start) 0%, var(--color-legacy-video-bg-end) 100%);
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: var(--color-legacy-gray-400);
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
  color: var(--color-legacy-gray-300);
}

.placeholder-subtext {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-legacy-gray-400);
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
