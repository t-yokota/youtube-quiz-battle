/// <reference types="youtube" />

// YouTube Player統合サービス
import { YouTubePlayerState } from '@/types'
import type { YouTubePlayerManager, YouTubePlayerVars, QuizSettings } from '@/types'
import {
  TIME_UPDATE_INTERVAL_MS,
  YT_API_LOAD_TIMEOUT_MS,
  YT_API_POLL_INTERVAL_MS,
  LOAD_VIDEO_SETTLE_MS,
} from '@/constants/timing'

/**
 * YouTube IFrame APIを動的に読み込み
 */
export function loadYouTubeIframeAPI(): Promise<void> {
  return new Promise((resolve, reject) => {
    // 既にAPIが読み込まれている場合
    if (window.YT && window.YT.Player) {
      resolve()
      return
    }

    // APIスクリプトが既に存在する場合
    if (document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      // APIの読み込み完了を待つ
      const checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkInterval)
          resolve()
        }
      }, YT_API_POLL_INTERVAL_MS)
      return
    }

    // APIスクリプトを動的に追加
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    const firstScriptTag = document.getElementsByTagName('script')[0]
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)

    // グローバルコールバックを設定
    window.onYouTubeIframeAPIReady = () => {
      resolve()
    }

    // タイムアウト処理
    setTimeout(() => {
      reject(new Error('YouTube IFrame API failed to load'))
    }, YT_API_LOAD_TIMEOUT_MS)
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
): Promise<YouTubePlayerManager> {
  return new Promise((resolve, reject) => {
    let player: YT.Player | null = null
    let timeUpdateCallback: ((time: number) => void) | null = null
    let stateChangeCallback: ((state: YouTubePlayerState) => void) | null = null
    let timeUpdateInterval: number | null = null

    // プレイヤーの初期化
    const onReady = () => {
      // 時間更新のポーリング開始
      startTimeUpdate()

      const manager: YouTubePlayerManager = {
        loadVideo: async (newVideoId: string) => {
          if (!player) throw new Error('Player not initialized')
          return new Promise((loadResolve) => {
            player!.loadVideoById(newVideoId)
            // 読み込み完了を待つ（簡易実装）
            setTimeout(loadResolve, LOAD_VIDEO_SETTLE_MS)
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

        onTimeUpdate: (callback: (time: number) => void) => {
          timeUpdateCallback = callback
        },

        onStateChange: (callback: (state: YouTubePlayerState) => void) => {
          stateChangeCallback = callback
        },

        destroy: () => {
          if (timeUpdateInterval !== null) {
            clearInterval(timeUpdateInterval)
            timeUpdateInterval = null
          }
          if (player) {
            player.destroy()
            player = null
          }
        },
      }

      resolve(manager)
    }

    const onStateChange = (event: YT.OnStateChangeEvent) => {
      if (stateChangeCallback) {
        stateChangeCallback(event.data as unknown as YouTubePlayerState)
      }
    }

    const onError = (event: YT.OnErrorEvent) => {
      reject(new Error(`YouTube Player Error: ${event.data}`))
    }

    const startTimeUpdate = () => {
      if (timeUpdateInterval !== null) return

      timeUpdateInterval = window.setInterval(() => {
        if (player && timeUpdateCallback) {
          const currentTime = player.getCurrentTime()
          timeUpdateCallback(currentTime)
        }
      }, TIME_UPDATE_INTERVAL_MS)
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
      reject(error)
    }
  })
}
