<script setup lang="ts">
// VideoPlayer コンポーネント（プレースホルダー版）
// Phase 2でYouTube IFrame Player APIを統合予定

// 将来的な状態管理の準備
// interface Props {
//   isVisible?: boolean
// }
// const props = withDefaults(defineProps<Props>(), {
//   isVisible: true
// })
</script>

<template>
  <div class="video-player-container">
    <div class="video-player-wrapper">
      <div class="video-placeholder">
        <div class="placeholder-content">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="play-icon"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z"
            />
          </svg>
          <p class="placeholder-text">Video Player</p>
          <p class="placeholder-subtext">YouTube動画がここに表示されます</p>
        </div>
      </div>
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
