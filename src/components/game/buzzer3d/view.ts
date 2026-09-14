import * as THREE from 'three'
import { ButtonState } from '@/types'
import type { BuzzerModelId } from '@/constants/buzzer'
import type { BuzzerModel, TargetRect } from './contracts'
import { appearance } from './appearance'
import { createModel } from './models'
import { defaultMotion, sampleGlow, samplePress } from './motion'
import { bindRotation } from './rotation'

interface Options {
  modelId: BuzzerModelId
  onError(error: unknown): void
  onTarget(rect: TargetRect): void
}
export type BuzzerView = ReturnType<typeof createBuzzerView>

export function createBuzzerView(container: HTMLElement, options: Options) {
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
  let model: BuzzerModel | undefined
  let selected = options.modelId
  let state = ButtonState.STANDBY
  let started: number | null = null
  let glowStarted = 0
  let frame = 0
  let disposed = false
  let interactionEnabled = true
  let width = 1
  let height = 1
  let observer: ResizeObserver | undefined
  let rotation: ReturnType<typeof bindRotation> | undefined
  const events = new AbortController()

  function dispose() {
    if (disposed) return
    disposed = true
    cancelAnimationFrame(frame)
    frame = 0
    observer?.disconnect()
    rotation?.dispose()
    events.abort()
    reduced.removeEventListener('change', invalidate)
    model?.dispose()
    renderer.dispose()
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
  function draw() {
    frame = 0
    if (disposed || document.hidden || !model) return
    try {
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
        disabled: state === ButtonState.DISABLED,
      })
      renderer.render(scene, camera)
      scene.updateMatrixWorld(true)
      camera.updateMatrixWorld(true)
      options.onTarget(targetRect())
      if (press.done) started = null
      if (!press.done || (state === ButtonState.RELEASED && !reduced.matches)) invalidate()
    } catch (error) {
      fail(error)
    }
  }
  function resize() {
    if (disposed) return
    try {
      width = Math.max(1, container.clientWidth)
      height = Math.max(1, container.clientHeight)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      // 全回転を包含する約半径2.1の球を表示領域へ収める。
      const vertical = THREE.MathUtils.degToRad(camera.fov / 2)
      const angle = Math.min(vertical, Math.atan(Math.tan(vertical) * camera.aspect))
      const distance = 2.1 / Math.sin(angle)
      camera.position.set(0, 4.5, Math.hypot(4, 6.2)).normalize().multiplyScalar(distance)
      camera.lookAt(0, 0.2, 0)
      camera.updateProjectionMatrix()
      invalidate()
    } catch (error) {
      fail(error)
    }
  }
  function setModel(id: BuzzerModelId) {
    if (disposed || (model && selected === id)) return
    try {
      const next = createModel(id)
      if (model) {
        rig.remove(model.root)
        model.dispose()
      }
      model = next
      selected = id
      rig.add(model.root)
      invalidate()
    } catch (error) {
      fail(error)
    }
  }
  try {
    model = createModel(selected)
    rig.add(model.root)
    container.appendChild(canvas)
    rotation = bindRotation(canvas, (dx, dy) => {
      if (!interactionEnabled) return
      rig.rotation.y += dx * 0.009
      rig.rotation.x = Math.max(-0.45, Math.min(0.6, rig.rotation.x + dy * 0.006))
      invalidate()
    })
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
    resize()
  } catch (error) {
    dispose()
    throw error
  }
  return {
    setModel,
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
    setState(next: ButtonState) {
      if (disposed) return
      if (next === ButtonState.PUSHED && state !== next) started = performance.now()
      if (next === ButtonState.STANDBY || next === ButtonState.DISABLED) started = null
      if (next === ButtonState.RELEASED && state !== next) glowStarted = performance.now()
      state = next
      invalidate()
    },
    resetView() {
      if (!disposed) {
        rig.rotation.set(0, 0, 0)
        invalidate()
      }
    },
    dispose,
  }
}
