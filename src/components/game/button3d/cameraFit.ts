import { Box3, Matrix4, Mesh, PerspectiveCamera, Vector3 } from 'three'
import type { ButtonModel } from './contracts'

/** 形状生成時に一度だけ採取。押下中のサイズ変動でカメラが揺れないよう復帰位置を基準にする。 */
export function collectFitPoints(model: ButtonModel): Vector3[] {
  model.root.updateWorldMatrix(true, true)
  const inverse = model.root.matrixWorld.clone().invert()
  const points: Vector3[] = []
  model.root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const vertices = object.geometry.getAttribute('position')
    const matrix = new Matrix4().multiplyMatrices(inverse, object.matrixWorld)
    for (let i = 0; i < vertices.count; i++) {
      const point = new Vector3().fromBufferAttribute(vertices, i).applyMatrix4(matrix)
      points.push(point)
      if (model.hitTargets.includes(object))
        points.push(point.clone().add(new Vector3(0, -0.15, 0)))
    }
  })
  return points
}

/** 遠近投影した輪郭を中央に置き、8pxの余白を残して最大表示する。 */
export function fitCamera(
  camera: PerspectiveCamera,
  points: Vector3[],
  matrix: Matrix4,
  width: number,
  height: number,
): void {
  const world = points.map((point) => point.clone().applyMatrix4(matrix))
  const center = new Box3().setFromPoints(world).getCenter(new Vector3())
  const direction = new Vector3(0, 4.5, Math.hypot(4, 6.2)).normalize()
  const right = new Vector3(0, 1, 0).cross(direction).normalize()
  const up = direction.clone().cross(right)
  camera.clearViewOffset()
  camera.zoom = 1
  camera.aspect = width / height
  const tangent = Math.tan((camera.fov * Math.PI) / 360)
  const horizontal = tangent * camera.aspect * Math.max(0.1, 1 - 16 / width)
  const vertical = tangent * Math.max(0.1, 1 - 16 / height)
  let distance = camera.near * 2
  for (const point of world) {
    const relative = point.clone().sub(center)
    const depth = relative.dot(direction)
    distance = Math.max(
      distance,
      depth + Math.abs(relative.dot(right)) / horizontal,
      depth + Math.abs(relative.dot(up)) / vertical,
      depth + camera.near * 2,
    )
  }
  camera.position.copy(center).addScaledVector(direction, distance)
  camera.lookAt(center)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)

  // 立体の中心と投影された輪郭の中心は一致しないため、画面上で中央合わせする。
  const bounds = new Box3().setFromPoints(world.map((point) => point.clone().project(camera)))
  const projectedCenter = bounds.getCenter(new Vector3())
  const size = bounds.getSize(new Vector3())
  camera.zoom = Math.min(
    (2 * Math.max(0.1, 1 - 16 / width)) / size.x,
    (2 * Math.max(0.1, 1 - 16 / height)) / size.y,
  )
  camera.setViewOffset(
    width,
    height,
    (projectedCenter.x * camera.zoom * width) / 2,
    (-projectedCenter.y * camera.zoom * height) / 2,
    width,
    height,
  )
}
