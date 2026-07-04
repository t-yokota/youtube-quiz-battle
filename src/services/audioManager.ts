// 音声管理サービス
// Web Audio API を主として使用し、AudioContext 未対応環境では HTML Audio にフォールバックする
import { SOUND_TYPE, DEFAULT_AUDIO_SPRITE } from '@/constants/audio'
import { logger } from '@/utils/logger'

type SpriteDefinition = typeof DEFAULT_AUDIO_SPRITE

export interface AudioManagerOptions {
  sprite?: SpriteDefinition
}

/**
 * iOS（iPadOS 含む）判定
 * iOS の Web Audio はサイレントスイッチで消音されるが、HTMLAudio（メディア要素）は
 * 鳴るため、iOS では HTMLAudio 経路を優先する
 */
function isIOS(): boolean {
  return (
    /iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/**
 * Web Audio API のコンストラクタ型
 * Safari 等の旧実装向けに webkitAudioContext を許容する
 */
interface WindowWithWebkitAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext
}

/**
 * 効果音管理クラス
 * - Web Audio API（AudioContext + decodeAudioData + AudioBufferSourceNode + GainNode）を優先使用
 * - AudioContext 未定義環境では HTML Audio（new Audio() + currentTime シーク + setTimeout 停止）にフォールバック
 * - 新規再生時は再生中の効果音を停止してから再生する
 */
export class AudioManager {
  private sprite: SpriteDefinition
  private volume = 1
  private soundEnabled = true
  private muted = false

  private audioContext: AudioContext | null = null
  private audioBuffer: AudioBuffer | null = null
  private gainNode: GainNode | null = null
  private currentSource: AudioBufferSourceNode | null = null

  // HTML Audio フォールバック用
  private htmlAudio: HTMLAudioElement | null = null
  private htmlAudioStopTimer: number | null = null

  private useWebAudio = false
  private initialized = false

  constructor(options?: AudioManagerOptions) {
    this.sprite = options?.sprite ?? DEFAULT_AUDIO_SPRITE
  }

  /**
   * スプライト音声の読み込み
   * 失敗時は Error('AUDIO_LOAD_FAILED') を throw する（呼び出し側で ErrorDialog へ接続）
   */
  async init(): Promise<void> {
    try {
      const AudioContextCtor =
        window.AudioContext ?? (window as WindowWithWebkitAudioContext).webkitAudioContext

      if (AudioContextCtor && !isIOS()) {
        await this.initWebAudio(AudioContextCtor)
        this.useWebAudio = true
      } else {
        this.initHtmlAudioFallback()
        this.useWebAudio = false
      }

      this.initialized = true
    } catch (error) {
      logger.error('[AudioManager] Failed to load audio sprite:', error)
      throw new Error('AUDIO_LOAD_FAILED')
    }
  }

  private async initWebAudio(AudioContextCtor: typeof AudioContext): Promise<void> {
    const audioContext = new AudioContextCtor()
    const response = await fetch(this.sprite.src)

    if (!response.ok) {
      throw new Error('AUDIO_LOAD_FAILED')
    }

    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    const gainNode = audioContext.createGain()
    gainNode.gain.value = this.currentGainValue()
    gainNode.connect(audioContext.destination)

    this.audioContext = audioContext
    this.audioBuffer = audioBuffer
    this.gainNode = gainNode
  }

  private initHtmlAudioFallback(): void {
    const audio = new Audio(this.sprite.src)
    audio.volume = this.currentGainValue()
    this.htmlAudio = audio
  }

  /**
   * 効果音を再生する（fire-and-forget）
   * 再生中の効果音があれば停止してから新しい効果音を再生する
   */
  playSound(type: SOUND_TYPE): void {
    if (!this.initialized || !this.soundEnabled || this.muted) return

    this.stopSound()

    if (this.useWebAudio) {
      this.playWithWebAudio(type)
    } else {
      this.playWithHtmlAudio(type)
    }
  }

  /**
   * running 状態の AudioContext を確保する。
   * iOS では動画再生に音声セッションを奪われると既存コンテキストが
   * 非標準の 'interrupted' になり無音化するため、running でない場合は
   * コンテキストを作り直す（ユーザー操作内で生成すれば最初から running になる）。
   * デコード済み AudioBuffer はコンテキスト間で再利用できる
   */
  private ensureRunningContext(): AudioContext | null {
    if (!this.audioContext) return null
    if (this.audioContext.state === 'running') return this.audioContext

    const Ctor =
      window.AudioContext ?? (window as WindowWithWebkitAudioContext).webkitAudioContext
    if (!Ctor) return this.audioContext

    void this.audioContext.close().catch(() => {})
    const context = new Ctor()
    const gainNode = context.createGain()
    gainNode.gain.value = this.currentGainValue()
    gainNode.connect(context.destination)
    this.audioContext = context
    this.gainNode = gainNode
    return context
  }

  private playWithWebAudio(type: SOUND_TYPE): void {
    if (!this.audioContext || !this.audioBuffer || !this.gainNode) return

    const context = this.ensureRunningContext()
    if (!context) return

    // 作り直しても running にならない場合（ユーザー操作外の呼び出し等）は
    // resume 完了後に再生し直す
    if (context.state !== 'running') {
      void context.resume().then(() => {
        if (this.soundEnabled && !this.muted) {
          this.playWithWebAudio(type)
        }
      })
      return
    }

    const segment = this.sprite.sprite[type]
    const source = context.createBufferSource()
    source.buffer = this.audioBuffer
    source.connect(this.gainNode!)
    source.start(0, segment.start, segment.duration)

    this.currentSource = source
    source.onended = () => {
      if (this.currentSource === source) {
        this.currentSource = null
      }
    }
  }

  private playWithHtmlAudio(type: SOUND_TYPE): void {
    if (!this.htmlAudio) return

    const segment = this.sprite.sprite[type]
    const audio = this.htmlAudio
    audio.currentTime = segment.start
    void audio.play().catch((error) => {
      logger.warn('[AudioManager] HTMLAudio play failed:', error)
    })

    this.htmlAudioStopTimer = window.setTimeout(() => {
      audio.pause()
      this.htmlAudioStopTimer = null
    }, segment.duration * 1000)
  }

  /**
   * 再生中の効果音を停止する
   * @param type 未使用（現行実装は単一チャンネル再生のため区別不要。IF 互換のため受け取るのみ）
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  stopSound(type?: SOUND_TYPE): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop()
      } catch {
        // 既に停止済みの場合は無視
      }
      this.currentSource = null
    }

    if (this.htmlAudioStopTimer !== null) {
      window.clearTimeout(this.htmlAudioStopTimer)
      this.htmlAudioStopTimer = null
    }

    if (this.htmlAudio) {
      this.htmlAudio.pause()
    }
  }

  /**
   * 音量を設定する（0-1）
   */
  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume))
    this.applyGain()
  }

  getVolume(): number {
    return this.volume
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled
    if (!enabled) {
      this.stopSound()
    }
  }

  setMute(muted: boolean): void {
    this.muted = muted
    this.applyGain()
  }

  /**
   * iOS 向けのアンロック: 最初のユーザー操作内で呼び、AudioContext を resume して
   * 無音バッファを 1 サンプル再生し音声セッションを確実に活性化する
   */
  unlock(): void {
    // HTMLAudio 経路: ジェスチャ内で一度 play→即 pause して要素の再生を解放する
    if (!this.useWebAudio && this.htmlAudio) {
      const audio = this.htmlAudio
      audio.muted = true
      void audio
        .play()
        .then(() => {
          audio.pause()
          audio.currentTime = 0
          audio.muted = false
        })
        .catch((error) => {
          audio.muted = false
          logger.warn('[AudioManager] HTMLAudio unlock failed:', error)
        })
      return
    }

    const context = this.ensureRunningContext()
    if (!context) return
    try {
      const silent = context.createBuffer(1, 1, context.sampleRate)
      const source = context.createBufferSource()
      source.buffer = silent
      source.connect(context.destination)
      source.start(0)
    } catch (error) {
      logger.warn('[AudioManager] unlock failed:', error)
    }
  }

  isSoundSupported(): boolean {
    return this.initialized
  }

  private currentGainValue(): number {
    return this.muted ? 0 : this.volume
  }

  private applyGain(): void {
    if (this.gainNode) {
      this.gainNode.gain.value = this.currentGainValue()
    }
    if (this.htmlAudio) {
      this.htmlAudio.volume = this.currentGainValue()
    }
  }
}

export function createAudioManager(options?: AudioManagerOptions): AudioManager {
  return new AudioManager(options)
}
