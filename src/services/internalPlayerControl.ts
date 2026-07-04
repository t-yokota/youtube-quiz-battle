// 内部操作ガード付きプレイヤー制御
import type { YouTubePlayerManager } from '@/types'

/**
 * 内部操作ガード付きプレイヤー制御。
 * onStateChange 側はこのフラグで内部操作由来の状態変化を無視する。
 */
export class InternalPlayerControl {
  private playerManager: YouTubePlayerManager
  private internalAction = false

  constructor(playerManager: YouTubePlayerManager) {
    this.playerManager = playerManager
  }

  /** fn 実行中だけ internalAction を立てる（同期のみ。fn 内で await しないこと） */
  withInternalAction(fn: () => void): void {
    this.internalAction = true
    fn()
    this.internalAction = false
  }

  isInternalAction(): boolean {
    return this.internalAction
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

  // ガード付きショートハンド（withInternalAction で包んで委譲）
  playVideo(): void {
    this.withInternalAction(() => this.playerManager.playVideo())
  }

  pauseVideo(): void {
    this.withInternalAction(() => this.playerManager.pauseVideo())
  }

  mute(): void {
    // ミュートはプレイヤーイベントを発火しないため内部アクション扱い不要
    this.playerManager.mute()
  }

  unMute(): void {
    this.playerManager.unMute()
  }

  seekTo(seconds: number): void {
    this.withInternalAction(() => this.playerManager.seekTo(seconds))
  }
}

export function createInternalPlayerControl(pm: YouTubePlayerManager): InternalPlayerControl {
  return new InternalPlayerControl(pm)
}
