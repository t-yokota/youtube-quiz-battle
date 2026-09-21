import { Box3, Frustum, Matrix4, Mesh, PerspectiveCamera, Vector3 } from 'three'
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
): number {
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
  return (size.x * camera.zoom * width) / 2
}

/** 初期姿勢の構図を基準に、回転軸中心の包絡球が収まる距離を確保する。 */
export function fitRotationSafeCamera(
  camera: PerspectiveCamera,
  points: Vector3[],
  initialMatrix: Matrix4,
  width: number,
  height: number,
  maxVisualWidth = Infinity,
  maxVisualHeight = Infinity,
): number {
  fitCamera(camera, points, initialMatrix, width, height)
  // PCの両モデルを共通で8px下寄せする。安全範囲も移動後の構図で計算する。
  const view = camera.view!
  camera.setViewOffset(width, height, view.offsetX, view.offsetY - 8, width, height)
  const center = new Vector3().setFromMatrixPosition(initialMatrix)
  // 全頂点と押下時の移動範囲を含む。任意の回転でもこの球の外には出ない。
  const radius =
    Math.max(...points.map((point) => point.length())) * initialMatrix.getMaxScaleOnAxis()
  const inset = new Matrix4().makeScale(
    1 / Math.max(0.1, 1 - 16 / width),
    1 / Math.max(0.1, 1 - 16 / height),
    1,
  )
  const frustum = new Frustum().setFromProjectionMatrix(
    inset.multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse),
  )
  const backward = camera.getWorldDirection(new Vector3()).negate()
  let retreat = 0
  for (const plane of frustum.planes) {
    const growth = -plane.normal.dot(backward)
    if (growth > 1e-8)
      retreat = Math.max(retreat, (radius - plane.distanceToPoint(center)) / growth)
  }
  camera.position.addScaledVector(backward, retreat)
  camera.far = Math.max(camera.far, camera.position.distanceTo(center) + radius + 1)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  const bounds = new Box3().setFromPoints(
    points.map((point) => point.clone().applyMatrix4(initialMatrix).project(camera)),
  )
  const visualWidth = ((bounds.max.x - bounds.min.x) * width) / 2
  const visualHeight = ((bounds.max.y - bounds.min.y) * height) / 2
  const ratio = Math.min(1, maxVisualWidth / visualWidth, maxVisualHeight / visualHeight)
  if (ratio < 1) {
    const center = bounds.getCenter(new Vector3())
    const view = camera.view!
    const opticalX = (-2 * view.offsetX) / width
    const opticalY = (2 * view.offsetY) / height
    camera.zoom *= ratio
    // 表示中心を動かさずに縮める。canvasとクリック判定は同じカメラを使う。
    camera.setViewOffset(
      width,
      height,
      view.offsetX + ((1 - ratio) * (opticalX - center.x) * width) / 2,
      view.offsetY - ((1 - ratio) * (opticalY - center.y) * height) / 2,
      width,
      height,
    )
  }
  return visualWidth * ratio
}
