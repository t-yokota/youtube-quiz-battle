import * as THREE from 'three'
import { createButtonView } from '../view'
import { ButtonState } from '@/types'
import type { ButtonModelId } from '@/constants/button'
import { appearance } from '../appearance'

const fake = vi.hoisted(() => ({
  fail: false,
  draw: vi.fn(),
  operations: [] as string[],
  dispose: vi.fn(),
  release: vi.fn(),
  scenes: [] as unknown[],
  cameras: [] as unknown[],
}))
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof THREE>()
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = document.createElement('canvas')
      setPixelRatio() {}
      size = new THREE.Vector2()
      setSize(width: number, height: number) {
        this.size.set(width, height)
        fake.operations.push(`size:${width}:${height}`)
      }
      getSize(target: THREE.Vector2) {
        return target.copy(this.size)
      }
      render(scene: unknown, camera: THREE.PerspectiveCamera) {
        if (fake.fail) throw new Error('GPU failure')
        fake.operations.push('render')
        fake.draw()
        fake.scenes.push(scene)
        fake.cameras.push(camera.clone())
      }
      forceContextLoss() {
        fake.release()
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
let notifyResize: () => void
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
  fake.release.mockClear()
  fake.scenes = []
  fake.cameras = []
  fake.operations = []
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
      constructor(callback: () => void) {
        notifyResize = callback
      }
      observe() {}
      disconnect = disconnect
    },
  )
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function mount(modelId: ButtonModelId = 'waseda-style-v1', fitInitialRotation = false) {
  const host = document.createElement('div')
  Object.defineProperties(host, {
    clientWidth: { value: 320, configurable: true },
    clientHeight: { value: 240, configurable: true },
  })
  const onError = vi.fn()
  const onTarget = vi.fn()
  const onReferenceSize = vi.fn()
  const onVisualWidth = vi.fn()
  const view = createButtonView(host, {
    modelId,
    onError,
    onTarget,
    fitInitialRotation,
    onReferenceSize,
    onVisualWidth,
  })
  return { view, host, onError, onTarget, onReferenceSize, onVisualWidth }
}
// 実際の投影で台座が見えている画素からドラッグを開始する。
function basePoint(host: HTMLElement, onBase = true) {
  frame()
  const scene = fake.scenes.at(-1) as THREE.Scene
  const camera = fake.cameras.at(-1) as THREE.PerspectiveCamera
  const root = scene.children[0]!.children[0]!.children[0]!
  const box = root.getObjectByName('black-enclosure')
  const targets = box ? [box] : root.children.filter((child) => child instanceof THREE.Mesh)
  scene.updateMatrixWorld(true)
  const ray = new THREE.Raycaster()
  for (let y = 4; y < host.clientHeight; y += 4) {
    for (let x = 4; x < host.clientWidth; x += 4) {
      ray.setFromCamera(
        new THREE.Vector2((x / host.clientWidth) * 2 - 1, 1 - (y / host.clientHeight) * 2),
        camera,
      )
      const first = ray.intersectObject(root, true)[0]
      if (first && targets.includes(first.object) === onBase) return [x, y] as const
    }
  }
  throw new Error('Visible target not found')
}

it('丸型の上限は初期幅の30%で、手動幅変更では変わらない', () => {
  const { view, host, onVisualWidth } = mount('simple-round-v1', true)
  document.body.appendChild(host)
  try {
    host.style.setProperty('--desktop-initial-width', '640px')
    Object.defineProperty(host, 'clientHeight', { value: 1200, configurable: true })
    for (const width of [1000, 800, 640]) {
      Object.defineProperty(host, 'clientWidth', { value: width, configurable: true })
      notifyResize()
      frame()
      expect(onVisualWidth.mock.lastCall![0]).toBeCloseTo(640 * 0.3)
    }
    host.style.setProperty('--desktop-initial-width', '800px')
    notifyResize()
    frame()
    expect(onVisualWidth.mock.lastCall![0]).toBeCloseTo(800 * 0.3)
    Object.defineProperty(host, 'clientWidth', { value: 100, configurable: true })
    notifyResize()
    frame()
    expect(onVisualWidth.mock.lastCall![0]).toBeLessThan(100)
  } finally {
    view.dispose()
    host.remove()
  }
})
it('箱型の上限は初期幅の25%に固定し、画面基準の変更時だけ更新する', () => {
  const { view, host, onReferenceSize } = mount('waseda-style-v1', true)
  document.body.appendChild(host)
  try {
    host.style.setProperty('--desktop-initial-width', '320px')
    frame()
    const first = onReferenceSize.mock.lastCall![0]
    expect(first.width).toBeGreaterThan(0)
    expect(first.width).toBeLessThanOrEqual(320 * 0.25 + 1e-6)
    expect(first.areaWidth).toBe(320)
    expect(first.height).toBeGreaterThan(0)
    expect(first.height).toBeLessThan(240)
    Object.defineProperty(host, 'clientHeight', { value: 400, configurable: true })
    notifyResize()
    frame()
    expect(onReferenceSize.mock.lastCall![0]).not.toEqual(first)
    for (const width of [640, 1000]) {
      Object.defineProperty(host, 'clientWidth', { value: width, configurable: true })
      Object.defineProperty(host, 'clientHeight', { value: 1200, configurable: true })
      notifyResize()
      frame()
      const size = onReferenceSize.mock.lastCall![0]
      expect(size.areaWidth).toBe(width)
      expect(size.initialAreaWidth).toBe(320)
      expect(size.width).toBeCloseTo(320 * 0.25)
    }
    host.style.setProperty('--desktop-initial-width', '640px')
    notifyResize()
    frame()
    expect(onReferenceSize.mock.lastCall![0].width).toBeCloseTo(640 * 0.25)
    Object.defineProperty(host, 'clientWidth', { value: 80, configurable: true })
    notifyResize()
    frame()
    expect(onReferenceSize.mock.lastCall![0].width).toBeLessThan(80)
  } finally {
    view.dispose()
    host.remove()
  }
})
it.each(['simple-round-v1', 'waseda-style-v1'] as const)(
  '%sはPCで回転してもカメラを維持し、リサイズ時は初期角度で再計算する',
  (id) => {
    const { view, host, onTarget } = mount(id, true)
    try {
      const cameraState = () => {
        const camera = fake.cameras.at(-1) as THREE.PerspectiveCamera
        return [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements]
      }
      frame()
      const initial = cameraState()
      const initialTarget = onTarget.mock.lastCall![0]
      const canvas = host.querySelector('canvas')!
      canvas.setPointerCapture = vi.fn()
      canvas.hasPointerCapture = vi.fn(() => false)
      const [baseX, baseY] = basePoint(host)
      for (const [type, x, y] of [
        ['pointerdown', 0, 0],
        ['pointermove', 80, -50],
        ['pointerup', 80, -50],
      ] as const) {
        const event = new Event(type)
        Object.assign(event, {
          isPrimary: true,
          button: 0,
          pointerId: 1,
          clientX: baseX + x,
          clientY: baseY + y,
        })
        canvas.dispatchEvent(event)
      }
      frame()
      expect(cameraState()).toEqual(initial)
      expect(onTarget.mock.lastCall![0]).not.toEqual(initialTarget)
      Object.defineProperty(host, 'clientHeight', { value: 400, configurable: true })
      notifyResize()
      frame()
      const resized = cameraState()
      expect(resized).not.toEqual(initial)
      view.setFitInitialRotation(false)
      frame()
      expect(cameraState()).not.toEqual(resized)
      view.setFitInitialRotation(true)
      frame()
      expect(cameraState()).toEqual(resized)
      view.resetView()
      frame()
      expect(cameraState()).toEqual(resized)
    } finally {
      view.dispose()
    }
  },
)
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
    const [baseX, baseY] = basePoint(host)
    for (const [type, clientX, clientY] of [
      ['pointerdown', 0, 0],
      ['pointermove', x, y],
      ['pointerup', x, y],
    ] as const) {
      const event = new Event(type)
      Object.assign(event, {
        isPrimary: true,
        button: 0,
        pointerId: 1,
        clientX: baseX + clientX,
        clientY: baseY + clientY,
      })
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

it.each(['simple-round-v1', 'waseda-style-v1'] as const)(
  '%sの再生押下は通常色で押し戻ってからDISABLEDになる',
  (id) => {
    const { view } = mount(id)
    frame()
    const scene = fake.scenes.at(-1) as THREE.Scene
    let cap: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | undefined
    scene.traverse((object) => {
      if (
        object instanceof THREE.Mesh &&
        object.material instanceof THREE.MeshStandardMaterial &&
        object.material.color.equals(new THREE.Color(appearance.capColor))
      )
        cap = object
    })
    const button = cap!
    const rest = button.parent!.position.y
    const normal = button.material.color.clone()
    try {
      view.playStartPress()
      view.setState(ButtonState.DISABLED)
      time = 40
      frame()
      expect(button.parent!.position.y).toBeCloseTo(rest - 0.15)
      expect(button.material.color.equals(normal)).toBe(true)
      expect(button.material.emissive.getHex() * button.material.emissiveIntensity).toBe(0)
      time = 100
      frame()
      expect(button.parent!.position.y).toBeGreaterThan(rest - 0.15)
      expect(button.parent!.position.y).toBeLessThan(rest)
      expect(button.material.color.equals(normal)).toBe(true)
      time = 140
      frame()
      expect(button.parent!.position.y).toBe(rest)
      expect(button.material.color.r).toBeCloseTo(normal.r * 0.4)
      expect(callbacks.size).toBe(0)
    } finally {
      view.dispose()
    }
  },
)

it('再生押下は動きを減らす設定で即時消灯し、リセットで演出を残さない', () => {
  const { view } = mount()
  try {
    frame()
    reduced = true
    view.playStartPress()
    view.setState(ButtonState.DISABLED)
    frame()
    expect(callbacks.size).toBe(0)
    reduced = false
    view.setState(ButtonState.STANDBY)
    view.playStartPress()
    view.setState(ButtonState.STANDBY)
    frame()
    expect(callbacks.size).toBe(0)
  } finally {
    view.dispose()
  }
})

it('静止画像は非表示タブでも同期描画し、専用ビューのWebGLを解放できる', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,test')
  const { view } = mount()
  hidden = true
  expect(view.captureSnapshot()).toContain('data:image/png')
  expect(fake.draw).toHaveBeenCalledOnce()
  expect(callbacks.size).toBe(0)
  view.dispose(true)
  expect(fake.release).toHaveBeenCalledOnce()
  expect(() => view.captureSnapshot()).toThrow('disposed')
})

it('連続リサイズは最新寸法を同じ描画フレームで適用し、空のcanvasを挟まない', () => {
  const { view, host } = mount()
  try {
    expect(fake.operations).toEqual([])
    frame()
    expect(fake.operations).toEqual(['size:320:240', 'render'])
    fake.operations = []
    for (const height of [230, 220, 210]) {
      Object.defineProperty(host, 'clientHeight', { value: height, configurable: true })
      notifyResize()
    }
    expect(fake.operations).toEqual([])
    expect(callbacks.size).toBe(1)
    frame()
    expect(fake.operations).toEqual(['size:320:210', 'render'])
    fake.operations = []
    notifyResize()
    frame()
    expect(fake.operations).toEqual(['render'])
    hidden = true
    Object.defineProperty(host, 'clientHeight', { value: 200, configurable: true })
    notifyResize()
    expect(callbacks.size).toBe(0)
    fake.operations = []
    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    frame()
    expect(fake.operations).toEqual(['size:320:200', 'render'])
  } finally {
    view.dispose()
  }
})
