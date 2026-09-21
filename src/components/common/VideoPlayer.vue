<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { loadYouTubeIframeAPI, createYouTubePlayerManager } from '@/services/youtubePlayer'
import type { YouTubePlayerManager, QuizSettings } from '@/types'
import { GameState } from '@/types'
import { logger } from '@/utils/logger'
import { useGameStore } from '@/stores/gameStore'

// Props定義
interface Props {
  videoId: string
  settings: QuizSettings
  answering?: boolean
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

// サムネイルマスク: 再生開始前（LOADING/READY）はサムネイル画像でプレイヤーを覆い、
// warmup やリプレイの一時停止画面を見せない。ボタン押下（TALKING 遷移）で即解除する
const thumbnailUrl = computed(() => `https://i.ytimg.com/vi/${props.videoId}/hqdefault.jpg`)

const showThumbnailMask = computed(
  () => gameStore.currentState === GameState.LOADING || gameStore.currentState === GameState.READY,
)

const lifetime = new AbortController()
let ownedPlayer: YouTubePlayerManager | null = null
function reportError(error: Error) {
  if (lifetime.signal.aborted) return
  logger.error('[VideoPlayer] Player failed:', error)
  errorMessage.value = error.message
  isLoading.value = false
  emit('error', error.message)
}
onBeforeUnmount(() => {
  lifetime.abort()
  ownedPlayer?.destroy()
  ownedPlayer = null
})

onMounted(async () => {
  try {
    // YouTube Player を作成
    await loadYouTubeIframeAPI(lifetime.signal)
    if (lifetime.signal.aborted) return
    const playerManager = await createYouTubePlayerManager(
      'youtube-player-element',
      props.videoId,
      props.settings,
      lifetime.signal,
    )

    if (lifetime.signal.aborted) {
      playerManager.destroy()
      return
    }
    ownedPlayer = playerManager
    playerManager.onError?.(reportError)
    if (errorMessage.value) return
    isLoading.value = false
    emit('ready', playerManager)
  } catch (error) {
    reportError(error instanceof Error ? error : new Error('Unknown error'))
  }
})
</script>

<template>
  <div class="video-player-container">
    <div class="video-player-wrapper" :class="{ 'is-answering': answering }">
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
      <div v-if="answering" class="answering-placeholder" role="status" aria-label="解答中">
        <span aria-hidden="true">解答中</span>
        <span class="answering-dots" aria-hidden="true">
          <span
            v-for="dot in 3"
            :key="dot"
            class="answering-dot"
            :style="{ '--dot-index': dot - 1 }"
            >・</span
          >
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.is-answering > :not(.answering-placeholder) {
  visibility: hidden;
}
.answering-placeholder {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25em;
  background: color-mix(in srgb, var(--surface-app) 94%, var(--color-text-main));
  color: var(--color-text-main);
  font-size: clamp(24px, 1.875rem, 36px);
  font-weight: 600;
  letter-spacing: 0.08em;
}
.answering-dots {
  display: inline-flex;
  font-size: clamp(16px, 1.25rem, 24px);
  letter-spacing: 0.08em;
}
.answering-dot {
  display: inline-block;
  animation: answering-bounce 1.2s ease-in-out infinite;
  animation-delay: calc(var(--dot-index) * 0.15s);
}
@keyframes answering-bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-0.3em);
  }
}
@media (prefers-reduced-motion: reduce) {
  .answering-dot {
    animation: none;
  }
}

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

/* サムネイルマスク（表示中は裏のプレイヤーへのタップも遮断する） */
.thumbnail-mask {
  position: absolute;
  inset: 0;
  z-index: 3;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #000;
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
  font-size: calc(1.25 * var(--ui-font-unit));
  font-weight: 600;
  color: var(--color-text-dim);
}

.placeholder-subtext {
  margin: 0;
  font-size: calc(0.875 * var(--ui-font-unit));
  color: var(--color-text-dim);
}

/* モバイル対応 */
@media (max-width: 640px) {
  .play-icon {
    width: 3rem;
    height: 3rem;
  }

  .placeholder-text {
    font-size: calc(1.125 * var(--ui-font-unit));
  }

  .placeholder-subtext {
    font-size: calc(0.8125 * var(--ui-font-unit));
  }
}

/* 小さい画面での追加調整 */
@media (max-height: 700px) {
  .play-icon {
    width: 2.5rem;
    height: 2.5rem;
  }

  .placeholder-text {
    font-size: var(--ui-font-unit);
  }

  .placeholder-subtext {
    font-size: calc(0.75 * var(--ui-font-unit));
  }

  .placeholder-content {
    gap: 0.75rem;
  }
}
</style>
