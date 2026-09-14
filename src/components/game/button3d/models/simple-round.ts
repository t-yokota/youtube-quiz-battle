// 提供元: quizbattle-waseda-model-addon / ADDON.md (2026-09-14)。形状の採用値を維持。
import * as THREE from 'three'
import type { Appearance } from '../appearance'
import type { ButtonModel } from '../contracts'
import { buildModel } from '../resources'

export function createSimpleRound(appearance: Appearance): ButtonModel {
  return buildModel((track) => {
    const root = new THREE.Group()
    // r128 の確認済みプレビューを再現するため台座は既存の線形値を維持。
    const dark = track(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(appearance.baseColor).convertLinearToSRGB(),
        metalness: 0.08,
        roughness: 0.42,
      }),
    )
    const rubber = track(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x020202).convertLinearToSRGB(),
        roughness: 0.8,
      }),
    )
    const red = track(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(appearance.capColor),
        emissive: new THREE.Color(appearance.glowColor).convertLinearToSRGB(),
        emissiveIntensity: 0,
        metalness: 0.05,
        roughness: appearance.capRoughness,
      }),
    )
    function cylinder(
      top: number,
      bottom: number,
      height: number,
      y: number,
      material: THREE.Material,
    ) {
      const mesh = new THREE.Mesh(
        track(new THREE.CylinderGeometry(top, bottom, height, 96)),
        material,
      )
      mesh.position.y = y
      root.add(mesh)
    }
    cylinder(1.38, 1.33, 0.12, -0.2, rubber)
    cylinder(1.38, 1.43, 0.28, 0, dark)
    cylinder(1.35, 1.38, 0.07, 0.175, dark)
    cylinder(1.27, 1.3, 0.08, 0.23, dark)
    cylinder(1.02, 1.02, 0.13, 0.33, rubber)
    const moving = new THREE.Group()
    moving.position.y = 0.34
    root.add(moving)
    const profile = [
      [0, 0],
      [0.92, 0],
      [0.99, 0.045],
      [1, 0.13],
      [0.985, 0.21],
      [0.94, 0.28],
      [0.84, 0.32],
      [0.5, 0.35],
      [0, 0.36],
    ]
    const cap = new THREE.Mesh(
      track(
        new THREE.LatheGeometry(
          profile.map((p) => new THREE.Vector2(p[0], p[1])),
          96,
        ),
      ),
      red,
    )
    moving.add(cap)
    const hitTargets = [cap]
    return {
      root,
      hitTargets,
      setVisual({ depth, travel, glowing, glowLevel, disabled }) {
        moving.position.y = 0.34 - depth * Math.min(travel, 0.17)
        red.emissiveIntensity =
          glowing && !disabled ? appearance.glowIntensity * Math.max(0, Math.min(1, glowLevel)) : 0
        red.color.set(appearance.capColor)
        if (disabled) red.color.multiplyScalar(0.25)
      },
    }
  })
}
