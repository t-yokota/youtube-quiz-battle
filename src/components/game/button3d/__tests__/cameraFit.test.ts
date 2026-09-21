import { Box3, Euler, Group, Matrix4, PerspectiveCamera, Vector3 } from 'three'
import { createModel } from '../models'
import { collectFitPoints, fitCamera, fitRotationSafeCamera } from '../cameraFit'

it('丸型の表示上限は大きい領域だけに適用し、中心を維持する', () => {
  const model = createModel('simple-round-v1')
  try {
    const points = collectFitPoints(model)
    const matrix = new Matrix4().makeRotationX(0.6 - Math.PI / 18)
    const camera = new PerspectiveCamera(35, 1, 0.1, 100)
    for (const size of [200, 1200]) {
      const project = () =>
        new Box3().setFromPoints(points.map((p) => p.clone().applyMatrix4(matrix).project(camera)))
      const originalWidth = fitRotationSafeCamera(camera, points, matrix, size, size)
      const center = project().getCenter(new Vector3())
      const limited = fitRotationSafeCamera(camera, points, matrix, size, size, 280)
      const bounds = project()
      expect(limited).toBeCloseTo(Math.min(originalWidth, 280))
      expect(((bounds.max.x - bounds.min.x) * size) / 2).toBeCloseTo(limited)
      expect(bounds.getCenter(new Vector3()).distanceTo(center)).toBeLessThan(1e-8)
      if (size === 1200) expect(originalWidth).toBeGreaterThan(280)
    }
  } finally {
    model.dispose()
  }
})

it('箱型は高さ340pxを上限に縦横比と中心を維持する', () => {
  const model = createModel('waseda-style-v1')
  try {
    const points = collectFitPoints(model)
    const matrix = new Matrix4().makeRotationX(-Math.PI / 18)
    const camera = new PerspectiveCamera(35, 1, 0.1, 100)
    for (const size of [200, 1200]) {
      const project = () =>
        new Box3().setFromPoints(points.map((p) => p.clone().applyMatrix4(matrix).project(camera)))
      const originalWidth = fitRotationSafeCamera(camera, points, matrix, size, size)
      const original = project()
      const originalHeight = ((original.max.y - original.min.y) * size) / 2
      const limitedWidth = fitRotationSafeCamera(camera, points, matrix, size, size, Infinity, 340)
      const bounds = project()
      const limitedHeight = ((bounds.max.y - bounds.min.y) * size) / 2
      expect(limitedHeight).toBeCloseTo(Math.min(originalHeight, 340))
      expect(limitedWidth / limitedHeight).toBeCloseTo(originalWidth / originalHeight)
      expect(
        bounds.getCenter(new Vector3()).distanceTo(original.getCenter(new Vector3())),
      ).toBeLessThan(1e-8)
      if (size === 1200) expect(originalHeight).toBeGreaterThan(340)
    }
  } finally {
    model.dispose()
  }
})

it.each(['simple-round-v1', 'waseda-style-v1'] as const)(
  '%sは固定カメラのまま回転範囲全体で余白を保つ',
  (id) => {
    const model = createModel(id)
    try {
      const points = collectFitPoints(model)
      const pose = new Matrix4().makeRotationX(-Math.PI / 18)
      const initial = pose
        .clone()
        .multiply(new Matrix4().makeRotationX(id === 'simple-round-v1' ? 0.6 : 0))
      const camera = new PerspectiveCamera(35, 1, 0.1, 100)
      for (const [width, height] of [
        [180, 400],
        [360, 360],
        [600, 180],
      ]) {
        fitCamera(camera, points, initial, width!, height!)
        const centeredOffsetY = camera.view!.offsetY
        fitRotationSafeCamera(camera, points, initial, width!, height!)
        expect(camera.view!.offsetY).toBeCloseTo(centeredOffsetY - 8)
        let extent = 0
        for (const pitch of [-0.45, 0, 0.6]) {
          for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 12) {
            const matrix = pose
              .clone()
              .multiply(new Matrix4().makeRotationFromEuler(new Euler(pitch, yaw, 0)))
            for (const point of points) {
              const p = point.clone().applyMatrix4(matrix).project(camera)
              extent = Math.max(
                extent,
                Math.abs(p.x) / (1 - 16 / width!),
                Math.abs(p.y) / (1 - 16 / height!),
                Math.abs(p.z),
              )
            }
          }
        }
        expect(extent).toBeLessThanOrEqual(1.00001)
      }
    } finally {
      model.dispose()
    }
  },
)

it.each(['simple-round-v1', 'waseda-style-v1'] as const)(
  '%sを各画面比率・回転で欠けずに最大まで広げる',
  (id) => {
    const model = createModel(id)
    const rig = new Group()
    rig.add(model.root)
    const points = collectFitPoints(model)
    const camera = new PerspectiveCamera(35, 1, 0.1, 100)
    for (const [width, height] of [
      [300, 200],
      [280, 400],
      [600, 180],
    ]) {
      for (const [pitch, yaw] of [
        [-0.6, 0],
        [-0.2, 0],
        [0.4, 0],
        [-0.2, 0.6],
        [0.4, 2],
      ]) {
        rig.rotation.set(pitch!, yaw!, 0)
        rig.updateMatrixWorld(true)
        const visualWidth = fitCamera(camera, points, rig.matrixWorld, width!, height!)
        let extent = 0
        const projected: Vector3[] = []
        for (const point of points) {
          const p = point.clone().applyMatrix4(rig.matrixWorld).project(camera)
          projected.push(p)
          const x = Math.abs(p.x) / (1 - 16 / width!)
          const y = Math.abs(p.y) / (1 - 16 / height!)
          extent = Math.max(extent, x, y)
        }
        for (const axis of ['x', 'y'] as const) {
          const values = projected.map((point) => point[axis])
          expect(Math.min(...values) + Math.max(...values)).toBeCloseTo(0, 5)
        }
        const xs = projected.map((point) => point.x)
        expect(visualWidth).toBeCloseTo(((Math.max(...xs) - Math.min(...xs)) * width!) / 2, 5)
        expect(extent).toBeLessThanOrEqual(1.00001)
        expect(extent).toBeCloseTo(1, 4)
        expect(camera.position.distanceTo(new Vector3())).toBeGreaterThan(0)
      }
    }
    model.dispose()
  },
)
