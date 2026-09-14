import type { Group, Object3D } from 'three'
export interface VisualState {
  depth: number
  travel: number
  glowing: boolean
  glowLevel: number
  disabled: boolean
}
export interface BuzzerModel {
  root: Group
  hitTargets: Object3D[]
  setVisual(state: VisualState): void
  dispose(): void
}
export interface TargetRect {
  x: number
  y: number
  width: number
  height: number
  visible: boolean
}
