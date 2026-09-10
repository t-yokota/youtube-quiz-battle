/// <reference types="youtube" />

// YouTube Player統合サービス
import { YouTubePlayerState } from '@/types'
import type { YouTubePlayerManager, YouTubePlayerVars, QuizSettings } from '@/types'
import {
  YT_API_LOAD_TIMEOUT_MS,
  YT_API_POLL_INTERVAL_MS,
  LOAD_VIDEO_SETTLE_MS,
  YT_PLAYER_READY_TIMEOUT_MS,
} from '@/constants/timing'

/**
 * YouTube IFrame APIを動的に読み込み
 */
export function loadYouTubeIframeAPI(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    if (window.YT?.Player) {
      resolve()
      return
    }
    const cleanup = () => {
      window.clearInterval(interval)
      window.clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    }
    const abort = () => {
      cleanup()
      reject(new DOMException('Aborted', 'AbortError'))
    }
    // スクリプトは共有し、各呼び出しの待機だけをキャンセルできるようにする。
    const interval = window.setInterval(() => {
      if (window.YT?.Player) {
        cleanup()
        resolve()
      }
    }, YT_API_POLL_INTERVAL_MS)
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('YouTube IFrame API failed to load'))
    }, YT_API_LOAD_TIMEOUT_MS)
    signal?.addEventListener('abort', abort, { once: true })
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
  })
}

/**
 * PlayerVars を構築（Strict プロファイル）
 */
function buildStrictPlayerVars(settings: QuizSettings): YouTubePlayerVars {
  return {
    playsinline: 1, // モバイルでインライン再生を有効化
    controls: settings.disableSeekbar ? 0 : 1, // プレイヤーコントロールの表示（0=非表示, 1=表示）
    disablekb: 1, // キーボード操作を無効化（スペースキーでの一時停止など）
    fs: 0, // フルスクリーンボタンを非表示
    rel: 0, // 再生終了時に関連動画を表示しない
    autoplay: 0, // 自動再生を無効化
    cc_load_policy: 0, // 字幕をデフォルトで表示しない
    hl: 'ja', // インターフェース言語を日本語に設定
    origin: window.location.origin, // オリジン検証用（セキュリティ）
  }
}

/**
 * YouTube Player Manager 実装
 */
export function createYouTubePlayerManager(
  elementId: string,
  videoId: string,
  settings: QuizSettings,
  signal?: AbortSignal,
): Promise<YouTubePlayerManager> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    let player: YT.Player | null = null
    let disposed = false
    let ready = false
    let errorCallback: ((error: Error) => void) | null = null
    let lastError: Error | null = null
    const pendingLoads = new Map<number, (error: Error) => void>()
    const cleanupReady = () => window.clearTimeout(readyTimeout)
    const dispose = () => {
      if (disposed) return
      disposed = true
      cleanupReady()
      signal?.removeEventListener('abort', abort)
      stateChangeCallback = null
      errorCallback = null
      for (const [timer, rejectLoad] of pendingLoads) {
        window.clearTimeout(timer)
        rejectLoad(new DOMException('Aborted', 'AbortError'))
      }
      pendingLoads.clear()
      const instance = player
      player = null
      instance?.destroy()
    }
    const fail = (error: Error) => {
      dispose()
      reject(error)
    }
    const abort = () => fail(new DOMException('Aborted', 'AbortError'))
    const readyTimeout = window.setTimeout(() => {
      fail(new Error('YouTube Player ready timed out'))
    }, YT_PLAYER_READY_TIMEOUT_MS)
    signal?.addEventListener('abort', abort, { once: true })
    let stateChangeCallback: ((state: YouTubePlayerState) => void) | null = null

    // プレイヤーの初期化
    const onReady = () => {
      if (disposed || ready) return
      ready = true
      cleanupReady()
      const manager: YouTubePlayerManager = {
        loadVideo: async (newVideoId: string) => {
          if (!player) throw new Error('Player not initialized')
          return new Promise((loadResolve, loadReject) => {
            player!.loadVideoById(newVideoId)
            // 読み込み完了を待つ（簡易実装）
            const timer = window.setTimeout(() => {
              pendingLoads.delete(timer)
              loadResolve()
            }, LOAD_VIDEO_SETTLE_MS)
            pendingLoads.set(timer, loadReject)
          })
        },

        playVideo: () => {
          if (!player) throw new Error('Player not initialized')
          player.playVideo()
        },

        pauseVideo: () => {
          if (!player) throw new Error('Player not initialized')
          player.pauseVideo()
        },

        seekTo: (time: number) => {
          if (!player) throw new Error('Player not initialized')
          player.seekTo(time, true)
        },

        getCurrentTime: () => {
          if (!player) return 0
          return player.getCurrentTime()
        },

        getDuration: () => {
          if (!player) return 0
          return player.getDuration()
        },

        getPlayerState: () => {
          if (!player) return YouTubePlayerState.UNSTARTED
          return player.getPlayerState() as unknown as YouTubePlayerState
        },

        getVideoTitle: () => {
          if (!player) return ''
          try {
            return player.getVideoData()?.title ?? ''
          } catch {
            return ''
          }
        },

        onStateChange: (callback: (state: YouTubePlayerState) => void) => {
          if (!disposed) stateChangeCallback = callback
        },

        onError: (callback) => {
          if (disposed) return
          errorCallback = callback
          if (lastError) callback(lastError)
        },
        destroy: dispose,
      }

      resolve(manager)
    }

    const onStateChange = (event: YT.OnStateChangeEvent) => {
      if (stateChangeCallback) {
        stateChangeCallback(event.data as unknown as YouTubePlayerState)
      }
    }

    const onError = (event: YT.OnErrorEvent) => {
      if (disposed) return
      const error = new Error(`YouTube Player Error: ${event.data}`)
      if (!ready) fail(error)
      else {
        lastError = error
        errorCallback?.(error)
      }
    }

    // プレイヤー作成
    try {
      player = new window.YT.Player(elementId, {
        videoId,
        width: '100%',
        height: '100%',
        host: 'https://www.youtube-nocookie.com',
        playerVars: buildStrictPlayerVars(settings),
        events: {
          onReady,
          onStateChange,
          onError,
        },
      })
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)))
    }
  })
}
