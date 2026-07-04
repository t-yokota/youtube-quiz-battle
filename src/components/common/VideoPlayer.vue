<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { loadYouTubeIframeAPI, createYouTubePlayerManager } from '@/services/youtubePlayer'
import type { YouTubePlayerManager, QuizSettings } from '@/types'
import { GameState, YouTubePlayerState } from '@/types'
import { PLAYER_MASK_POLL_MS } from '@/constants/timing'
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
const playerManagerRef = ref<YouTubePlayerManager | null>(null)

// サムネイルマスク: 再生開始前（LOADING/READY と、開始後の最初の PLAYING まで）は
// サムネイル画像でプレイヤーを覆い、warmup やリプレイの一時停止画面を見せない
const thumbnailUrl = computed(() => `https://i.ytimg.com/vi/${props.videoId}/hqdefault.jpg`)
const hasPlaybackStarted = ref(false)

const showThumbnailMask = computed(() => {
  if (hasPlaybackStarted.value) return false
  return (
    gameStore.currentState === GameState.LOADING ||
    gameStore.currentState === GameState.READY ||
    gameStore.currentState === GameState.TALKING
  )
})

// READY へ戻ったら（初回・リプレイとも）マスクを再度有効化
watch(
  () => gameStore.currentState,
  (state) => {
    if (state === GameState.READY) {
      hasPlaybackStarted.value = false
    }
  },
)

// マスク表示中は PLAYING をポーリングで検知して外す
let maskPollId: number | null = null

function stopMaskPoll() {
  if (maskPollId !== null) {
    window.clearInterval(maskPollId)
    maskPollId = null
  }
}

function startMaskPoll() {
  if (maskPollId !== null) return
  maskPollId = window.setInterval(() => {
    // READY 中の PLAYING（ゲートの warmup 再生や spurious イベント）は「再生開始」と
    // みなさない。ゲームが始まった TALKING 以降の PLAYING のみでマスクを解除する
    if (
      gameStore.currentState !== GameState.READY &&
      gameStore.currentState !== GameState.LOADING &&
      playerManagerRef.value?.getPlayerState() === YouTubePlayerState.PLAYING
    ) {
      hasPlaybackStarted.value = true
      stopMaskPoll()
    }
  }, PLAYER_MASK_POLL_MS)
}

watch(showThumbnailMask, (masked) => {
  if (masked && playerManagerRef.value) {
    startMaskPoll()
  } else {
    stopMaskPoll()
  }
})

onBeforeUnmount(stopMaskPoll)

onMounted(async () => {
  try {
    // YouTube Player を作成
    await loadYouTubeIframeAPI()
    const playerManager = await createYouTubePlayerManager(
      'youtube-player-element',
      props.videoId,
      props.settings,
    )

    playerManagerRef.value = playerManager
    isLoading.value = false
    emit('ready', playerManager)
    // マスク表示中に ready になった場合はここからポーリング開始
    if (showThumbnailMask.value) {
      startMaskPoll()
    }
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

      <!-- サムネイルマスク（再生開始まで warmup 等の一時停止画面を隠す） -->
      <img
        v-if="showThumbnailMask && !isLoading && !errorMessage"
        class="thumbnail-mask"
        :src="thumbnailUrl"
        alt=""
        aria-hidden="true"
      />
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

/* サムネイルマスク */
.thumbnail-mask {
  position: absolute;
  inset: 0;
  z-index: 3;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #000;
  pointer-events: none;
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
