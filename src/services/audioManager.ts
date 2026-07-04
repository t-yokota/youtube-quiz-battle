// 音声管理サービス
// Web Audio API を主として使用し、AudioContext 未対応環境では HTML Audio にフォールバックする
import { SOUND_TYPE, DEFAULT_AUDIO_SPRITE, SOUND_FILES, SILENT_LOOP_FILE } from '@/constants/audio'
import { logger } from '@/utils/logger'

type SpriteDefinition = typeof DEFAULT_AUDIO_SPRITE

export interface AudioManagerOptions {
  sprite?: SpriteDefinition
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

  // HTML Audio 経路用（音ごとの個別要素。シークなしで頭から再生するため遅延がない）
  private htmlAudios: Partial<Record<SOUND_TYPE, HTMLAudioElement>> = {}

  // 無音ループ（iOS サイレントスイッチ対策）: 再生中のメディア要素で音声セッションを
  // 「再生」カテゴリに保ち、Web Audio の効果音を消音モードでも鳴らす
  private silentLoop: HTMLAudioElement | null = null

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

      if (AudioContextCtor) {
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
    for (const type of Object.values(SOUND_TYPE)) {
      const audio = new Audio(SOUND_FILES[type])
      audio.preload = 'auto'
      audio.volume = this.currentGainValue()
      this.htmlAudios[type] = audio
    }
  }

  /**
   * 効果音を再生する（fire-and-forget）
   * 再生中の効果音があれば停止してから新しい効果音を再生する
   */
  playSound(type: SOUND_TYPE): void {
    if (!this.initialized || !this.soundEnabled || this.muted) return

    this.stopSound()

    // 中断等で無音ループが止まっていたら再開（アンロック済み要素なのでジェスチャ外でも可）
    if (this.silentLoop && this.silentLoop.paused) {
      void this.silentLoop.play()?.catch(() => {})
    }

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
    const audio = this.htmlAudios[type]
    if (!audio) return

    // 音ごとの個別要素を頭から再生（シーク・停止タイマー不要）
    audio.currentTime = 0
    void audio.play().catch((error) => {
      logger.warn('[AudioManager] HTMLAudio play failed:', error)
    })
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

    for (const audio of Object.values(this.htmlAudios)) {
      audio.pause()
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
    // HTMLAudio 経路: ジェスチャ内で各要素の play を発行し同期で即 pause して解放する
    // （promise 完了を待つと iOS で音が一瞬漏れる）
    if (!this.useWebAudio) {
      for (const audio of Object.values(this.htmlAudios)) {
        void audio.play()?.catch((error) => {
          logger.warn('[AudioManager] HTMLAudio unlock failed:', error)
        })
        audio.pause()
        audio.currentTime = 0
      }
      return
    }

    // 無音ループを開始（ジェスチャ内なので許可される。以後流しっぱなしにして
    // 音声セッションを保持し、消音モードでも Web Audio を鳴らす）
    if (!this.silentLoop) {
      const loop = new Audio(SILENT_LOOP_FILE)
      loop.loop = true
      this.silentLoop = loop
    }
    void this.silentLoop.play()?.catch((error) => {
      logger.warn('[AudioManager] silent loop start failed:', error)
    })

    // AudioContext を running にする（無音バッファの発音は行わない —
    // クリックノイズの原因になり得るため。セッション活性は無音ループが担う）
    this.ensureRunningContext()
  }

  isSoundSupported(): boolean {
    return this.initialized
  }

  private currentGainValue(): number {
    // 線形ゲインは聴感上の差が小さいため 2 乗カーブで段差を体感に合わせる
    return this.muted ? 0 : this.volume * this.volume
  }

  private applyGain(): void {
    if (this.gainNode) {
      this.gainNode.gain.value = this.currentGainValue()
    }
    for (const audio of Object.values(this.htmlAudios)) {
      audio.volume = this.currentGainValue()
    }
  }
}

export function createAudioManager(options?: AudioManagerOptions): AudioManager {
  return new AudioManager(options)
}
