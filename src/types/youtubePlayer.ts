// YouTube Player関連の型定義
/// <reference types="youtube" />

// YouTube IFrame API states (YT.PlayerState)
export enum YouTubePlayerState {
  UNSTARTED = -1, // 再生前
  ENDED = 0, // 再生終了
  PLAYING = 1, // 再生中
  PAUSED = 2, // 一時停止
  BUFFERING = 3, // バッファリング
  CUED = 5, // ロード済み（再生待ち）
}

// Window interface extension for YouTube API
declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void
    YT?: typeof YT
  }
}

// YouTube Player Manager インターフェース
export interface YouTubePlayerManager {
  // プレイヤー制御
  loadVideo(videoId: string): Promise<void>
  playVideo(): void
  pauseVideo(): void
  seekTo(time: number): void

  // 状態取得
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): YouTubePlayerState
  getVideoTitle(): string

  // イベント処理
  onStateChange(callback: (state: YouTubePlayerState) => void): void

  // クリーンアップ
  destroy(): void
}

// YouTube Player Vars型定義
export type YouTubePlayerVars = Record<string, string | number>
