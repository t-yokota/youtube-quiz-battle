import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AudioManager } from '../audioManager'
import { SOUND_TYPE, DEFAULT_AUDIO_SPRITE } from '@/constants/audio'

// ============================================================================
// モック定義
// ============================================================================

interface MockGainNode {
  gain: { value: number }
  connect: ReturnType<typeof vi.fn>
}

interface MockSource {
  buffer: unknown
  connect: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  onended: (() => void) | null
}

interface MockAudioContextInstance {
  state: string
  destination: object
  gainNode: MockGainNode
  lastSource: MockSource | null
  createGain: ReturnType<typeof vi.fn>
  createBufferSource: ReturnType<typeof vi.fn>
  decodeAudioData: ReturnType<typeof vi.fn>
  resume: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

function createMockAudioContext(): MockAudioContextInstance {
  const gainNode: MockGainNode = { gain: { value: 0 }, connect: vi.fn() }

  const context: MockAudioContextInstance = {
    state: 'running',
    destination: {},
    gainNode,
    lastSource: null,
    createGain: vi.fn(() => gainNode),
    createBufferSource: vi.fn(() => {
      const source: MockSource = {
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      }
      context.lastSource = source
      return source
    }),
    decodeAudioData: vi.fn(async () => ({}) as AudioBuffer),
    resume: vi.fn(async () => {
      context.state = 'running'
    }),
    close: vi.fn(async () => {}),
  }

  return context
}

function stubAudioContext(context: MockAudioContextInstance): void {
  function MockAudioContextCtor(): MockAudioContextInstance {
    return context
  }
  vi.stubGlobal('AudioContext', MockAudioContextCtor)
}

function stubFetchOk(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    })),
  )
}

function stubFetchError(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: false,
      arrayBuffer: async () => new ArrayBuffer(8),
    })),
  )
}

let audioElementInstances: MockAudioElement[] = []

class MockAudioElement {
  src: string
  volume = 1
  currentTime = 0
  paused = true
  play = vi.fn(async () => {
    this.paused = false
  })
  pause = vi.fn(() => {
    this.paused = true
  })

  constructor(src?: string) {
    this.src = src ?? ''
    audioElementInstances.push(this)
  }
}

function stubHtmlAudio(): void {
  vi.stubGlobal('Audio', MockAudioElement)
}

// ============================================================================
// テスト
// ============================================================================

describe('AudioManager: Web Audio 経路', () => {
  let context: MockAudioContextInstance

  beforeEach(() => {
    context = createMockAudioContext()
    stubAudioContext(context)
    stubFetchOk()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('正常系: init 後 playSound で該当区間の start 引数が渡される', async () => {
    const manager = new AudioManager()
    await manager.init()

    manager.playSound(SOUND_TYPE.BUTTON)

    const segment = DEFAULT_AUDIO_SPRITE.sprite[SOUND_TYPE.BUTTON]
    expect(context.lastSource?.start).toHaveBeenCalledWith(0, segment.start, segment.duration)
  })

  it('正常系: 別種の効果音では対応する区間の start 引数が渡される', async () => {
    const manager = new AudioManager()
    await manager.init()

    manager.playSound(SOUND_TYPE.CORRECT)

    const segment = DEFAULT_AUDIO_SPRITE.sprite[SOUND_TYPE.CORRECT]
    expect(context.lastSource?.start).toHaveBeenCalledWith(0, segment.start, segment.duration)
  })

  it('正常系: stopSound で再生中の source.stop が呼ばれる', async () => {
    const manager = new AudioManager()
    await manager.init()
    manager.playSound(SOUND_TYPE.BUTTON)
    const source = context.lastSource

    manager.stopSound()

    expect(source?.stop).toHaveBeenCalled()
  })

  it('正常系: 重複再生時は前の source を停止してから新しい source を再生する', async () => {
    const manager = new AudioManager()
    await manager.init()

    manager.playSound(SOUND_TYPE.BUTTON)
    const firstSource = context.lastSource

    manager.playSound(SOUND_TYPE.CORRECT)
    const secondSource = context.lastSource

    expect(firstSource?.stop).toHaveBeenCalled()
    expect(secondSource?.start).toHaveBeenCalled()
    expect(firstSource).not.toBe(secondSource)
  })

  it('正常系: setVolume は 0-1 にクランプされ gainNode.gain.value に反映される', async () => {
    const manager = new AudioManager()
    await manager.init()

    manager.setVolume(1.5)
    expect(context.gainNode.gain.value).toBe(1)
    expect(manager.getVolume()).toBe(1)

    manager.setVolume(-0.5)
    expect(context.gainNode.gain.value).toBe(0)
    expect(manager.getVolume()).toBe(0)

    manager.setVolume(0.4)
    expect(context.gainNode.gain.value).toBe(0.4)
    expect(manager.getVolume()).toBe(0.4)
  })

  it('正常系: setSoundEnabled(false) の間は playSound しても再生されない', async () => {
    const manager = new AudioManager()
    await manager.init()

    manager.setSoundEnabled(false)
    manager.playSound(SOUND_TYPE.BUTTON)

    expect(context.createBufferSource).not.toHaveBeenCalled()
  })

  it('正常系: 再生中に setSoundEnabled(false) にすると再生中の音が停止する', async () => {
    const manager = new AudioManager()
    await manager.init()
    manager.playSound(SOUND_TYPE.BUTTON)
    const source = context.lastSource

    manager.setSoundEnabled(false)

    expect(source?.stop).toHaveBeenCalled()
  })

  it('正常系: setMute(true) は音量に関わらず gain を 0 にする', async () => {
    const manager = new AudioManager()
    await manager.init()
    manager.setVolume(0.8)

    manager.setMute(true)

    expect(context.gainNode.gain.value).toBe(0)
  })

  it('正常系: setMute(false) に戻すと現在の volume が gain に反映される', async () => {
    const manager = new AudioManager()
    await manager.init()
    manager.setVolume(0.6)
    manager.setMute(true)

    manager.setMute(false)

    expect(context.gainNode.gain.value).toBe(0.6)
  })

  it('正常系: suspended 中の playSound は resume 完了後に再生される（初回の音を落とさない）', async () => {
    const manager = new AudioManager()
    await manager.init()
    context.state = 'suspended'

    manager.playSound(SOUND_TYPE.BUTTON)

    // resume 完了前は start されない（suspended 中の発音は捨てられるため）
    expect(context.resume).toHaveBeenCalled()
    expect(context.lastSource).toBeNull()

    // resume の完了を待つと再生される
    await Promise.resolve()
    await Promise.resolve()
    expect(context.lastSource).not.toBeNull()
    expect(context.lastSource!.start).toHaveBeenCalled()
  })

  it('異常系: init 前に playSound を呼んでも no-op で何も起きない', () => {
    const manager = new AudioManager()

    expect(() => manager.playSound(SOUND_TYPE.BUTTON)).not.toThrow()
    expect(context.createBufferSource).not.toHaveBeenCalled()
  })

  it('異常系: fetch が非 ok の場合 init は Error(AUDIO_LOAD_FAILED) を throw する', async () => {
    stubFetchError()
    const manager = new AudioManager()

    await expect(manager.init()).rejects.toThrow('AUDIO_LOAD_FAILED')
  })

  it('異常系: decodeAudioData が失敗した場合 init は Error(AUDIO_LOAD_FAILED) を throw する', async () => {
    context.decodeAudioData = vi.fn(async () => {
      throw new Error('decode error')
    })
    const manager = new AudioManager()

    await expect(manager.init()).rejects.toThrow('AUDIO_LOAD_FAILED')
  })
})

describe('AudioManager: HTML Audio フォールバック経路', () => {
  beforeEach(() => {
    audioElementInstances = []
    vi.stubGlobal('AudioContext', undefined)
    stubHtmlAudio()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('正常系: AudioContext 未定義の場合 HTML Audio（音別要素）にフォールバックして再生できる', async () => {
    const manager = new AudioManager()
    await manager.init()

    expect(manager.isSoundSupported()).toBe(true)
    // 音の種類ぶんの要素が生成される
    expect(audioElementInstances).toHaveLength(3)

    manager.playSound(SOUND_TYPE.CORRECT)

    // CORRECT 用の要素（2番目）が頭から再生される
    const audio = audioElementInstances[1]
    expect(audio.currentTime).toBe(0)
    expect(audio.play).toHaveBeenCalled()
  })

  it('正常系: HTML Audio 経路で stopSound を呼ぶと全要素が停止する', async () => {
    const manager = new AudioManager()
    await manager.init()
    manager.playSound(SOUND_TYPE.BUTTON)

    manager.stopSound()

    for (const audio of audioElementInstances) {
      expect(audio.pause).toHaveBeenCalled()
    }
  })

  it('正常系: setVolume は HTML Audio の volume にも反映される', async () => {
    const manager = new AudioManager()
    await manager.init()

    manager.setVolume(0.3)

    for (const audio of audioElementInstances) {
      expect(audio.volume).toBe(0.3)
    }
  })
})
