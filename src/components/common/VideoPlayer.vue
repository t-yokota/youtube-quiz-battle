<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { loadYouTubeIframeAPI, createYouTubePlayerManager } from '@/services/youtubePlayer'
import type { YouTubePlayerManager, QuizSettings } from '@/types'
import { GameState } from '@/types'
import { logger } from '@/utils/logger'
import { useGameStore } from '@/stores/gameStore'

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

const gameStore = useGameStore()

const isLoading = ref(true)
const errorMessage = ref<string | null>(null)

// 再生開始前（LOADING/READY）は開始ゲートの priming による一時停止画面（暗転）を
// 見せないよう、ステージ調カバーで覆う
const showStandbyCover = computed(
  () => gameStore.currentState === GameState.LOADING || gameStore.currentState === GameState.READY,
)

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

      <!-- 再生開始前のスタンバイカバー（priming の一時停止画面を隠す） -->
      <div v-if="showStandbyCover && !isLoading && !errorMessage" class="standby-cover">
        <span class="standby-label">STANDBY</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Video Player Container（フルブリード・下辺 line で区切る） */
.video-player-container {
  width: 100%;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-line);
}

/* Video Player Wrapper - 16:9アスペクト比維持 */
.video-player-wrapper {
  width: 100%;
  aspect-ratio: 16 / 9;
  position: relative;
  overflow: hidden;
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

/* 再生開始前のスタンバイカバー */
.standby-cover {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(80% 60% at 50% 50%, rgba(255, 197, 61, 0.06) 0%, transparent 70%),
    linear-gradient(180deg, var(--color-stage-900) 0%, #0a0e1d 100%);
}

.standby-label {
  font-size: 0.8125rem;
  font-weight: 800;
  letter-spacing: 0.35em;
  color: var(--color-text-dim);
}

/* YouTube iframe（YT.Playerが自動生成）のスタイル調整 */
#youtube-player-element :deep(iframe) {
  width: 100% !important;
  height: 100% !important;
}

/* Placeholder */
.video-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: var(--color-text-dim);
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
  color: var(--color-text-dim);
}

.placeholder-subtext {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-dim);
}

/* モバイル対応 */
@media (max-width: 640px) {
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
