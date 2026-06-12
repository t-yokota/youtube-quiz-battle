// ゲームループ（時間更新ポーリング）の composable
//
// YouTube Player の getCurrentTime() を一定間隔でポーリングし、
// GameManager のシーク検出・再生停滞検出・状態遷移を駆動する。
// 時間更新の機構は本 composable のポーリングに一本化されており、
// youtubePlayer.ts 側に独自のインターバルは存在しない。
import type { GameManager } from '@/services/gameManager'
import type { YouTubePlayerManager } from '@/types'
import { TIME_UPDATE_INTERVAL_MS, STARTUP_GRACE_MS } from '@/constants/timing'
import { logger } from '@/utils/logger'

/**
 * ゲームループの開始・停止を提供する composable
 */
export function useGameLoop() {
  let intervalId: number | null = null

  /**
   * 時間更新ループを開始する
   * @param playerManager 現在時刻を取得する YouTube Player Manager
   * @param gameManager 時間更新を委譲する GameManager
   */
  function start(playerManager: YouTubePlayerManager, gameManager: GameManager): void {
    // 二重起動を防止
    stop()

    const startedAt = performance.now()

    function tick(): void {
      const now = performance.now()
      const current = playerManager.getCurrentTime()

      // 再生開始直後の誤検出回避
      if (now - startedAt < STARTUP_GRACE_MS) {
        return
      }

      // 再生停滞（stall）検出
      gameManager.checkStall(now, current)

      // 通常の時間更新・シーク検出・状態判定を実施
      gameManager.updateVideoTime(current)
    }

    intervalId = window.setInterval(tick, TIME_UPDATE_INTERVAL_MS)
    logger.log(`[useGameLoop] Time Update Loop started (interval: ${TIME_UPDATE_INTERVAL_MS}ms)`)
  }

  /**
   * 時間更新ループを停止する
   */
  function stop(): void {
    if (intervalId !== null) {
      window.clearInterval(intervalId)
      intervalId = null
      logger.log('[useGameLoop] Time Update Loop stopped')
    }
  }

  return { start, stop }
}
