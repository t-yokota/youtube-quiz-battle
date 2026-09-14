import * as THREE from 'three'
import { createButtonView } from '../view'
import { ButtonState } from '@/types'

const fake = vi.hoisted(() => ({
  fail: false,
  draw: vi.fn(),
  dispose: vi.fn(),
  scenes: [] as unknown[],
}))
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof THREE>()
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = document.createElement('canvas')
      setPixelRatio() {}
      setSize() {}
      getSize(target: THREE.Vector2) {
        return target.set(0, 0)
      }
      render(scene: unknown) {
        if (fake.fail) throw new Error('GPU failure')
        fake.draw()
        fake.scenes.push(scene)
      }
      dispose() {
        fake.dispose()
      }
    },
  }
})
let callbacks: Map<number, FrameRequestCallback>
let hidden = false
let reduced = false
let reducedChange: (() => void) | undefined
let disconnect: ReturnType<typeof vi.fn>
let frameId: number
let time: number
function frame() {
  const pending = [...callbacks.values()]
  callbacks.clear()
  pending.forEach((fn) => fn(time))
}
beforeEach(() => {
  callbacks = new Map()
  frameId = 0
  time = 0
  hidden = false
  reduced = false
  fake.fail = false
  fake.draw.mockClear()
  fake.dispose.mockClear()
  fake.scenes = []
  vi.spyOn(performance, 'now').mockImplementation(() => time)
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    callbacks.set(++frameId, fn)
    return frameId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id))
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return reduced
    },
    addEventListener: (_: string, fn: () => void) => {
      reducedChange = fn
    },
    removeEventListener() {},
  }))
  disconnect = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect = disconnect
    },
  )
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function mount() {
  const host = document.createElement('div')
  Object.defineProperties(host, { clientWidth: { value: 320 }, clientHeight: { value: 240 } })
  const onError = vi.fn()
  const onTarget = vi.fn()
  const view = createButtonView(host, { modelId: 'waseda-style-v1', onError, onTarget })
  return { view, host, onError, onTarget }
}
it('静止・非表示時は停止し、RELEASEDの位相を復帰後も保つ', () => {
  const { view, onTarget } = mount()
  frame()
  expect(callbacks.size).toBe(0)
  expect(onTarget).toHaveBeenCalled()
  view.setState(ButtonState.PUSHED)
  frame()
  expect(callbacks.size).toBe(1)
  time = 100
  view.setState(ButtonState.RELEASED)
  frame()
  const scene = fake.scenes.at(-1) as THREE.Scene
  const lens = scene.getObjectByName('lamp-lens') as THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshStandardMaterial
  >
  expect(lens.material.emissiveIntensity).toBe(0)
  hidden = true
  document.dispatchEvent(new Event('visibilitychange'))
  view.setState(ButtonState.RELEASED)
  expect(callbacks.size).toBe(0)
  time = 350
  hidden = false
  document.dispatchEvent(new Event('visibilitychange'))
  frame()
  expect(lens.material.emissiveIntensity).toBeCloseTo(0.65)
  reduced = true
  reducedChange?.()
  frame()
  expect(callbacks.size).toBe(0)
  view.setState(ButtonState.DISABLED)
  frame()
  expect(lens.material.emissiveIntensity).toBe(0)
  view.dispose()
  view.dispose()
  view.setState(ButtonState.PUSHED)
  view.resetView()
  view.setModel('simple-round-v1')
  expect(callbacks.size).toBe(0)
  expect(fake.dispose).toHaveBeenCalledOnce()
  expect(disconnect).toHaveBeenCalledOnce()
})
it('モデル交換ではrendererを共有し、回転・リセット後もターゲットを更新する', () => {
  const { view, host, onTarget } = mount()
  frame()
  view.setModel('simple-round-v1')
  frame()
  view.resetView()
  frame()
  expect(host.querySelectorAll('canvas')).toHaveLength(1)
  expect(onTarget.mock.lastCall?.[0].width).toBeGreaterThanOrEqual(44)
  const rect = onTarget.mock.lastCall![0]
  expect(view.acceptsPoint(rect.x, rect.y)).toBe(true)
  expect(view.acceptsPoint(-100, -100)).toBe(false)
  view.setInteractionEnabled(false)
  expect(view.acceptsPoint(rect.x, rect.y)).toBe(false)
  view.setInteractionEnabled(true)
  expect(fake.dispose).not.toHaveBeenCalled()
  view.dispose()
})
it.each(['context', 'render'])('%s障害で一度だけ通知して描画と資産を破棄する', (reason) => {
  const { view, host, onError } = mount()
  if (reason === 'context')
    host.firstElementChild!.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
  else {
    fake.fail = true
    frame()
  }
  expect(onError).toHaveBeenCalledOnce()
  expect(host.children).toHaveLength(0)
  expect(callbacks.size).toBe(0)
  view.dispose()
  expect(fake.dispose).toHaveBeenCalledOnce()
})

it('モデルごとの初期姿勢・回転量を保持し、リセットは選択中のモデルだけに適用する', () => {
  const { view, host } = mount()
  frame()
  const scene = fake.scenes.at(-1) as THREE.Scene
  const rig = scene.children[0]!.children[0] as THREE.Group
  const canvas = host.querySelector('canvas')!
  canvas.setPointerCapture = vi.fn()
  canvas.hasPointerCapture = vi.fn(() => false)
  function drag(x: number, y: number) {
    for (const [type, clientX, clientY] of [
      ['pointerdown', 0, 0],
      ['pointermove', x, y],
      ['pointerup', x, y],
    ] as const) {
      const event = new Event(type)
      Object.assign(event, { isPrimary: true, button: 0, pointerId: 1, clientX, clientY })
      canvas.dispatchEvent(event)
    }
  }
  try {
    expect(rig.rotation.x).toBe(0)
    drag(20, 20)
    const box = rig.rotation.clone()
    view.setModel('simple-round-v1')
    expect(rig.rotation.x).toBe(0.6)
    expect(rig.rotation.y).toBe(0)
    drag(-20, -20)
    const round = rig.rotation.clone()
    view.setModel('waseda-style-v1')
    expect(rig.rotation.equals(box)).toBe(true)
    view.resetView()
    expect(rig.rotation.x).toBe(0)
    expect(rig.rotation.y).toBe(0)
    view.setModel('simple-round-v1')
    expect(rig.rotation.equals(round)).toBe(true)
    view.resetView()
    expect(rig.rotation.x).toBe(0.6)
    expect(rig.rotation.y).toBe(0)
  } finally {
    view.dispose()
  }
})
