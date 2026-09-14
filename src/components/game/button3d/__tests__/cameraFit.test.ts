import { Group, PerspectiveCamera, Vector3 } from 'three'
import { createModel } from '../models'
import { collectFitPoints, fitCamera } from '../cameraFit'

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
        fitCamera(camera, points, rig.matrixWorld, width!, height!)
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
        expect(extent).toBeLessThanOrEqual(1.00001)
        expect(extent).toBeCloseTo(1, 4)
        expect(camera.position.distanceTo(new Vector3())).toBeGreaterThan(0)
      }
    }
    model.dispose()
  },
)
