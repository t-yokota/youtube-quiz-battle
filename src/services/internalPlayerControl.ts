// 再生意図付きプレイヤー制御
import type { YouTubePlayerManager } from '@/types'
import { YouTubePlayerState } from '@/types/youtubePlayer'

type PlaybackIntent = typeof YouTubePlayerState.PLAYING | typeof YouTubePlayerState.PAUSED

/**
 * 再生意図を記録するプレイヤー制御。
 * YouTube の onStateChange はコマンド実行後に非同期で届くため、同期中だけのフラグではなく
 * 最後に指示した再生状態と通知された状態を比較して内部操作由来かを判定する。
 */
export class InternalPlayerControl {
  private playerManager: YouTubePlayerManager
  private playbackIntent: PlaybackIntent = YouTubePlayerState.PAUSED

  constructor(playerManager: YouTubePlayerManager) {
    this.playerManager = playerManager
  }

  /** 初期Player状態を再生意図へ同期する。onStateChange登録前に一度呼ぶ。 */
  syncPlaybackIntentFromPlayer(): void {
    const state = this.playerManager.getPlayerState()
    this.playbackIntent =
      state === YouTubePlayerState.PLAYING || state === YouTubePlayerState.BUFFERING
        ? YouTubePlayerState.PLAYING
        : YouTubePlayerState.PAUSED
  }

  /** PLAYING / PAUSED 通知が最後のアプリ内コマンドと一致するか。 */
  isPlaybackStateExpected(state: number): boolean {
    return state === this.playbackIntent
  }

  /** Player UIなど、アプリ外から確定した再生状態を次の意図として採用する。 */
  acceptExternalPlaybackState(state: PlaybackIntent): void {
    this.playbackIntent = state
  }

  // 透過プロキシ（ガードなし読み取り系）
  getCurrentTime(): number {
    return this.playerManager.getCurrentTime()
  }

  getPlayerState(): number {
    return this.playerManager.getPlayerState()
  }

  onStateChange(cb: (state: number) => void): void {
    this.playerManager.onStateChange(cb)
  }

  // 再生意図を先に更新してからPlayerへ委譲する
  playVideo(): void {
    const previousIntent = this.playbackIntent
    this.playbackIntent = YouTubePlayerState.PLAYING
    try {
      this.playerManager.playVideo()
    } catch (error) {
      this.playbackIntent = previousIntent
      throw error
    }
  }

  pauseVideo(): void {
    const previousIntent = this.playbackIntent
    this.playbackIntent = YouTubePlayerState.PAUSED
    try {
      this.playerManager.pauseVideo()
    } catch (error) {
      this.playbackIntent = previousIntent
      throw error
    }
  }

  seekTo(seconds: number): void {
    this.playerManager.seekTo(seconds)
  }
}

export function createInternalPlayerControl(pm: YouTubePlayerManager): InternalPlayerControl {
  return new InternalPlayerControl(pm)
}
