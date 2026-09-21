import * as THREE from 'three'
import { ButtonState } from '@/types'
import type { ButtonModelId } from '@/constants/button'
import type { ButtonModel, TargetRect } from './contracts'
import { appearance } from './appearance'
import { createModel } from './models'
import { defaultMotion, sampleGlow, samplePress } from './motion'
import { bindRotation } from './rotation'
import { collectFitPoints, fitCamera, fitRotationSafeCamera } from './cameraFit'

const MIN_ROTATION_X = -0.45
const MAX_ROTATION_X = 0.6
function initialRotation(id: ButtonModelId) {
  return { x: id === 'simple-round-v1' ? MAX_ROTATION_X : 0, y: 0 }
}

interface Options {
  modelId: ButtonModelId
  fitInitialRotation?: boolean
  fitContainer?: HTMLElement
  onError(error: unknown): void
  onTarget(rect: TargetRect): void
  onVisualWidth?(width: number): void
  onRotationChange?(rotated: boolean): void
  onReferenceSize?(size: {
    width: number
    height: number
    areaWidth: number
    initialAreaWidth: number
  }): void
}
export type ButtonView = ReturnType<typeof createButtonView>

export function createButtonView(container: HTMLElement, options: Options) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  // r128の旧照明に近い強度へ換算。幾何・素材値はADDON基準を維持する。
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
  const pose = new THREE.Group()
  pose.rotation.x = THREE.MathUtils.degToRad(-10)
  const rig = new THREE.Group()
  pose.add(rig)
  scene.add(pose)
  const hemisphere = new THREE.HemisphereLight(
    0xffffff,
    0x202020,
    appearance.hemisphereIntensity * Math.PI,
  )
  const key = new THREE.DirectionalLight(0xffffff, appearance.keyIntensity * Math.PI)
  const rim = new THREE.DirectionalLight(0xffffff, appearance.rimIntensity * Math.PI)
  key.position.set(-3, 6, 4)
  rim.position.set(4, 3, -3)
  const orbit = new THREE.Group()
  orbit.rotation.set(THREE.MathUtils.degToRad(-15), THREE.MathUtils.degToRad(30), 0, 'XYZ')
  orbit.add(key, rim, key.target, rim.target)
  scene.add(hemisphere, orbit)
  const canvas = renderer.domElement
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none'
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  let model: ButtonModel | undefined
  let selected = options.modelId
  let fitInitialRotation = options.fitInitialRotation ?? false
  let modelRotations: Record<ButtonModelId, { x: number; y: number }> = {
    'simple-round-v1': initialRotation('simple-round-v1'),
    'waseda-style-v1': initialRotation('waseda-style-v1'),
  }
  function applyRotation() {
    const { x, y } = modelRotations[selected]
    rig.rotation.set(x, y, 0)
    const initial = initialRotation(selected)
    // 一周して初期姿勢へ戻った場合もリセット不要とする。
    const yawDifference = Math.atan2(Math.sin(y - initial.y), Math.cos(y - initial.y))
    options.onRotationChange?.(Math.abs(x - initial.x) > 1e-6 || Math.abs(yawDifference) > 1e-6)
  }
  applyRotation()
  let fitPoints: THREE.Vector3[] = []
  let state = ButtonState.STANDBY
  let started: number | null = null
  let playStartPressActive = false
  let glowStarted = 0
  let frame = 0
  let disposed = false
  let interactionEnabled = true
  let width = 1
  let height = 1
  let layoutDirty = true
  let observer: ResizeObserver | undefined
  let rotation: ReturnType<typeof bindRotation> | undefined
  const events = new AbortController()

  function dispose(releaseContext = false) {
    if (disposed) {
      if (releaseContext) renderer.forceContextLoss()
      return
    }
    disposed = true
    cancelAnimationFrame(frame)
    frame = 0
    observer?.disconnect()
    rotation?.dispose()
    events.abort()
    reduced.removeEventListener('change', invalidate)
    model?.dispose()
    renderer.dispose()
    if (releaseContext) renderer.forceContextLoss()
    canvas.remove()
  }
  function fail(error: unknown) {
    dispose()
    options.onError(error)
  }
  function invalidate() {
    if (!disposed && !document.hidden && !frame) frame = requestAnimationFrame(draw)
  }
  function targetRect(): TargetRect {
    const target = model!.hitTargets[0]!
    const box = new THREE.Box3().setFromObject(target)
    const center = box.getCenter(new THREE.Vector3())
    const screen = center.clone().project(camera)
    const ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2(screen.x, screen.y), camera)
    const first = ray.intersectObject(model!.root, true)[0]
    const points = []
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          points.push(new THREE.Vector3(x, y, z).project(camera))
        }
    return {
      x: ((screen.x + 1) * width) / 2,
      y: ((1 - screen.y) * height) / 2,
      width: Math.max(
        44,
        ((Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x))) * width) / 2,
      ),
      height: Math.max(
        44,
        ((Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y))) * height) / 2,
      ),
      visible: !!first && model!.hitTargets.includes(first.object) && screen.z > -1 && screen.z < 1,
    }
  }
  function draw(_time?: number, force = false) {
    frame = 0
    if (disposed || (document.hidden && !force) || !model) return
    try {
      // setSizeは描画バッファを消去するため、必ず同じフレーム内で再描画する。
      // ResizeObserverの連続通知は最新寸法にまとめ、途中の空フレームを作らない。
      if (layoutDirty) {
        width = Math.max(1, container.clientWidth)
        height = Math.max(1, container.clientHeight)
        const size = renderer.getSize(new THREE.Vector2())
        if (size.x !== width || size.y !== height) renderer.setSize(width, height, false)
        rig.updateWorldMatrix(true, true)
        // PCは回転角度ではなく、各モデルの初期姿勢で領域に収まるサイズを決める。
        // 領域の拡縮時もこの基準を使い、ドラッグによるカメラのズーム変更を避ける。
        const initial = initialRotation(selected)
        const fitMatrix = fitInitialRotation
          ? pose.matrixWorld
              .clone()
              .multiply(
                new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(initial.x, initial.y, 0)),
              )
          : rig.matrixWorld
        const fit = fitInitialRotation ? fitRotationSafeCamera : fitCamera
        const region = fitInitialRotation ? options.fitContainer : undefined
        const bounds = container.getBoundingClientRect()
        const fitBounds = region?.getBoundingClientRect()
        const centerX = fitBounds ? fitBounds.left + fitBounds.width / 2 - bounds.left : width / 2
        const centerY = fitBounds ? fitBounds.top + fitBounds.height / 2 - bounds.top : height / 2
        // 従来の中心位置を保ち、その中心からgame-uiの各端まで使える範囲を広げる。
        // 解答欄展開時は中心が左へ動くため、利用可能幅も連動して小さくなる。
        const fitWidth = Math.max(1, 2 * Math.min(centerX, width - centerX))
        const fitHeight = Math.max(1, 2 * Math.min(centerY, height - centerY))
        // 上限は画面ごとの初期幅から決める。境界を狭めるたび上限まで縮めない。
        const initialAreaWidth =
          parseFloat(getComputedStyle(container).getPropertyValue('--desktop-initial-width')) ||
          width
        const maxVisualWidth = !fitInitialRotation
          ? Infinity
          : selected === 'simple-round-v1'
            ? initialAreaWidth * 0.3
            : initialAreaWidth * 0.25
        const visualWidth = fit(camera, fitPoints, fitMatrix, fitWidth, fitHeight, maxVisualWidth)
        if (region) {
          // 同じカメラをヒット判定にも使うため、クリック位置も描画位置に一致する。
          const view = camera.view!
          camera.setViewOffset(
            fitWidth,
            fitHeight,
            view.offsetX - (centerX - fitWidth / 2),
            view.offsetY - (centerY - fitHeight / 2),
            width,
            height,
          )
        }
        options.onVisualWidth?.(visualWidth)
        if (fitInitialRotation && options.onReferenceSize) {
          // 上限値を検討するための計測。回転中の姿勢ではなく、サイズ基準の初期姿勢を表示する。
          const reference = new THREE.Box3().setFromPoints(
            fitPoints.map((point) => point.clone().applyMatrix4(fitMatrix).project(camera)),
          )
          options.onReferenceSize({
            width: ((reference.max.x - reference.min.x) * width) / 2,
            height: ((reference.max.y - reference.min.y) * height) / 2,
            areaWidth: width,
            initialAreaWidth,
          })
        }
        layoutDirty = false
      }
      const now = performance.now()
      const press =
        started === null
          ? { depth: 0, done: true }
          : samplePress(Math.max(0, now - started), defaultMotion, reduced.matches)
      model.setVisual({
        depth: press.depth,
        travel: defaultMotion.travel,
        glowing: state === ButtonState.RELEASED,
        glowLevel: reduced.matches ? 1 : sampleGlow(now - glowStarted),
        disabled: state === ButtonState.DISABLED && (!playStartPressActive || press.done),
      })
      renderer.render(scene, camera)
      scene.updateMatrixWorld(true)
      camera.updateMatrixWorld(true)
      options.onTarget(targetRect())
      if (press.done) {
        started = null
        playStartPressActive = false
      }
      if (!press.done || (state === ButtonState.RELEASED && !reduced.matches)) invalidate()
    } catch (error) {
      fail(error)
    }
  }
  function resize() {
    if (disposed) return
    layoutDirty = true
    invalidate()
  }
  function setModel(id: ButtonModelId) {
    if (disposed || (model && selected === id)) return
    try {
      const next = createModel(id)
      if (model) {
        rig.remove(model.root)
        model.dispose()
      }
      model = next
      selected = id
      rotation?.clear()
      applyRotation()
      rig.add(model.root)
      fitPoints = collectFitPoints(model)
      resize()
    } catch (error) {
      fail(error)
    }
  }
  try {
    model = createModel(selected)
    rig.add(model.root)
    fitPoints = collectFitPoints(model)
    container.appendChild(canvas)
    rotation = bindRotation(
      canvas,
      (dx, dy) => {
        if (!interactionEnabled) return
        modelRotations = {
          ...modelRotations,
          [selected]: {
            x: Math.max(MIN_ROTATION_X, Math.min(MAX_ROTATION_X, rig.rotation.x + dy * 0.006)),
            y: rig.rotation.y + dx * 0.009,
          },
        }
        applyRotation()
        if (fitInitialRotation) invalidate()
        else resize()
      },
      (clientX, clientY) => {
        if (disposed || !model || !interactionEnabled) return false
        const bounds = canvas.getBoundingClientRect()
        const x = clientX - bounds.left,
          y = clientY - bounds.top
        if (x < 0 || y < 0 || x > width || y > height) return false
        scene.updateMatrixWorld(true)
        const ray = new THREE.Raycaster()
        ray.setFromCamera(new THREE.Vector2((x / width) * 2 - 1, 1 - (y / height) * 2), camera)
        // 最前面だけを判定する。ランプやキャップの奥にある台座では開始できない。
        const first = ray.intersectObject(model.root, true)[0]
        return !!first && model.rotationTargets.includes(first.object)
      },
    )
    canvas.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault()
        fail(new Error('WebGL context lost'))
      },
      { signal: events.signal },
    )
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) {
          cancelAnimationFrame(frame)
          frame = 0
          rotation?.clear()
        } else invalidate()
      },
      { signal: events.signal },
    )
    reduced.addEventListener('change', invalidate)
    observer = new ResizeObserver(resize)
    observer.observe(container)
    if (options.fitContainer) {
      observer.observe(options.fitContainer)
      // 丸型の上限到達後も、解答エリア開閉に伴うstageの移動へ追従する。
      const stage = options.fitContainer.closest('.button-stage')
      if (stage) observer.observe(stage)
      const main = options.fitContainer.closest('.main-content')
      if (main) observer.observe(main)
    }
    resize()
  } catch (error) {
    dispose()
    throw error
  }
  return {
    setModel,
    setFitInitialRotation(enabled: boolean) {
      if (fitInitialRotation === enabled) return
      fitInitialRotation = enabled
      resize()
    },
    captureSnapshot() {
      if (disposed) throw new Error('Button view is disposed')
      cancelAnimationFrame(frame)
      draw(undefined, true)
      if (disposed) throw new Error('Button snapshot rendering failed')
      return canvas.toDataURL('image/png')
    },
    setInteractionEnabled(enabled: boolean) {
      interactionEnabled = enabled
      if (!enabled) rotation?.clear()
    },
    acceptsPoint(clientX: number, clientY: number) {
      if (disposed || !model || !interactionEnabled) return false
      const bounds = container.getBoundingClientRect()
      const x = clientX - bounds.left,
        y = clientY - bounds.top
      const rect = targetRect()
      if (
        !rect.visible ||
        Math.abs(x - rect.x) > rect.width / 2 ||
        Math.abs(y - rect.y) > rect.height / 2
      )
        return false
      const ray = new THREE.Raycaster()
      ray.setFromCamera(new THREE.Vector2((x / width) * 2 - 1, 1 - (y / height) * 2), camera)
      const first = ray.intersectObject(model.root, true)[0]
      if (!first || model.hitTargets.includes(first.object)) return true
      // 最低44pxの許容領域でも、キャップより手前のランプやケース越しには押せない。
      const center = new THREE.Box3()
        .setFromObject(model.hitTargets[0]!)
        .getCenter(new THREE.Vector3())
      return first.distance >= ray.ray.origin.distanceTo(center)
    },
    playStartPress() {
      if (disposed || !interactionEnabled || state !== ButtonState.STANDBY || playStartPressActive)
        return
      playStartPressActive = true
      started = performance.now()
      invalidate()
    },
    setState(next: ButtonState) {
      if (disposed) return
      if (next === ButtonState.PUSHED && state !== next) started = performance.now()
      if (next === ButtonState.STANDBY || next === ButtonState.PUSHED) playStartPressActive = false
      if (next === ButtonState.STANDBY || (next === ButtonState.DISABLED && !playStartPressActive))
        started = null
      if (next === ButtonState.RELEASED && state !== next) glowStarted = performance.now()
      state = next
      invalidate()
    },
    resetView() {
      if (!disposed) {
        rotation?.clear()
        modelRotations = { ...modelRotations, [selected]: initialRotation(selected) }
        applyRotation()
        resize()
      }
    },
    dispose,
  }
}
