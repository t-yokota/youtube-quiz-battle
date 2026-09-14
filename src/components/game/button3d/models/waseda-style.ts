// 提供元: quizbattle-waseda-model-addon / ADDON.md (2026-09-14)。形状の採用値を維持。
import * as THREE from 'three'
import type { Appearance } from '../appearance'
import type { ButtonModel } from '../contracts'
import { buildModel } from '../resources'

export function createWasedaStyle(appearance: Appearance): ButtonModel {
  return buildModel((track) => {
    const root = new THREE.Group()
    root.name = 'waseda-style'
    const base = track(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(appearance.baseColor).convertLinearToSRGB(),
        metalness: appearance.caseMetalness,
        roughness: appearance.caseRoughness,
      }),
    )
    const black = track(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x080808).convertLinearToSRGB(),
        roughness: 0.55,
      }),
    )
    const socketMaterial = track(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xa29e88).convertLinearToSRGB(),
        metalness: 0.25,
        roughness: 0.5,
      }),
    )
    const metal = track(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x999b93).convertLinearToSRGB(),
        metalness: 0.65,
        roughness: 0.27,
      }),
    )
    const capMaterial = track(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(appearance.capColor),
        roughness: appearance.capRoughness,
        metalness: 0.04,
      }),
    )
    const lampColor = appearance.lampColor
    const lensMaterial = track(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(lampColor),
        emissive: new THREE.Color(appearance.glowColor).convertLinearToSRGB(),
        emissiveIntensity: 0,
        metalness: 0.02,
        roughness: 0.23,
      }),
    )
    function cylinder(
      radius: number,
      height: number,
      y: number,
      z: number,
      material: THREE.Material,
      parent = root,
      bottom = radius,
    ) {
      const mesh = new THREE.Mesh(
        track(new THREE.CylinderGeometry(radius, bottom, height, 80)),
        material,
      )
      mesh.position.set(0, y, z)
      parent.add(mesh)
      return mesh
    }
    function roundedBox(width: number, height: number, depth: number, radius: number) {
      if (radius <= 0) return track(new THREE.BoxGeometry(width, height, depth))
      const half = [width / 2, height / 2, depth / 2]
      const r = Math.min(radius, ...half)
      const inner = half.map((value) => value - r)
      const positions = []
      const normals = []
      const indices = []
      // 平面と曲面の境界に必ず頂点を置く。分割帯の幅もRに追従させる。
      function coordinates(axis: number) {
        const positive = []
        for (let step = 0; step <= 8; step++) {
          positive.push(inner[axis] + r * Math.tan(((step / 8) * Math.PI) / 4))
        }
        return [...positive.map((value) => -value).reverse(), ...positive]
      }
      for (let axis = 0; axis < 3; axis++) {
        const u = (axis + 1) % 3
        const v = (axis + 2) % 3
        const us = coordinates(u)
        const vs = coordinates(v)
        for (const sign of [-1, 1]) {
          const offset = positions.length / 3
          for (const y of vs) {
            for (const x of us) {
              const point = [0, 0, 0]
              point[axis] = half[axis] * sign
              point[u] = x
              point[v] = y
              const center = point.map((value, i) => Math.max(-inner[i], Math.min(inner[i], value)))
              const n = point.map((value, i) => value - center[i])
              const length = Math.hypot(...n)
              for (let i = 0; i < 3; i++) {
                normals.push(n[i] / length)
                positions.push(center[i] + (r * n[i]) / length)
              }
            }
          }
          for (let j = 0; j < vs.length - 1; j++) {
            for (let i = 0; i < us.length - 1; i++) {
              const a = offset + j * us.length + i
              const b = a + 1
              const c = a + us.length
              const d = c + 1
              if (sign > 0) indices.push(a, b, d, a, d, c)
              else indices.push(a, d, b, a, c, d)
            }
          }
        }
      }
      const geometry = track(new THREE.BufferGeometry())
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
      geometry.setIndex(indices)
      geometry.computeBoundingSphere()
      return geometry
    }
    const body = new THREE.Mesh(roundedBox(1.85, 0.86, 3.07, appearance.caseRadius), base)
    body.position.y = -0.255
    body.name = 'black-enclosure'
    root.add(body)
    const lamp = new THREE.Group()
    lamp.name = 'fixed-lamp'
    root.add(lamp)
    const lampZ = -0.69
    // 滑らかな円筒と薄い支持円盤。円盤は赤いレンズの外径に合わせる。
    cylinder(0.57, 0.165, 0.2575, lampZ, socketMaterial, lamp)
    cylinder(0.605, 0.03, 0.355, lampZ, socketMaterial, lamp)
    // 一体レンズの輪郭に凹凸を作り、横リブを表現する。
    // 最下段の波の頂点から、外径を保って底面までまっすぐ下ろす。
    const profile = [
      [0.6, 0],
      [0.6, 0.122],
      [0.57, 0.145],
    ]
    for (let i = 1; i < 9; i++) {
      const y = 0.07 + i * 0.105
      profile.push([0.57, y], [0.598, y + 0.02], [0.6, y + 0.052], [0.57, y + 0.075])
    }
    profile.push([0.595, 1.025], [0.588, 1.07], [0.54, 1.09], [0.48, 1.055], [0, 1.055])
    const lensGeometry = track(
      new THREE.LatheGeometry(
        profile.map((point) => new THREE.Vector2(point[0], point[1])),
        96,
      ),
    )
    // 垂直な裾の側面は水平方向の法線。底面の下向き法線を混ぜない。
    const lensPositions = lensGeometry.attributes.position
    const lensNormals = lensGeometry.attributes.normal
    for (let i = 0; i < lensPositions.count; i++) {
      if (lensPositions.getY(i) <= 0.122001) {
        const x = lensPositions.getX(i)
        const z = lensPositions.getZ(i)
        const length = Math.hypot(x, z)
        lensNormals.setXYZ(i, x / length, 0, z / length)
      }
    }
    const lens = new THREE.Mesh(lensGeometry, lensMaterial)
    lens.name = 'lamp-lens'
    lens.position.set(0, 0.37, lampZ)
    lamp.add(lens)
    // 底面は独立した円盤にし、側面との境界をシャープに保つ。
    const lensBottom = new THREE.Mesh(track(new THREE.CircleGeometry(0.6, 96)), lensMaterial)
    lensBottom.rotation.x = Math.PI / 2
    lensBottom.position.set(0, 0.37, lampZ)
    lamp.add(lensBottom)
    const switchZ = 0.9
    cylinder(0.22, 0.03, 0.193, switchZ, metal)
    cylinder(0.135, 0.2, 0.28, switchZ, black)
    const moving = new THREE.Group()
    moving.name = 'moving-button'
    moving.position.set(0, 0.32, switchZ)
    root.add(moving)
    const buttonProfile = [
      [0, 0],
      [0.16, 0],
      [0.174, 0.025],
      [0.174, 0.23],
      [0.165, 0.265],
      [0.135, 0.275],
      [0, 0.275],
    ]
    const cap = new THREE.Mesh(
      track(
        new THREE.LatheGeometry(
          buttonProfile.map((point) => new THREE.Vector2(point[0], point[1])),
          64,
        ),
      ),
      capMaterial,
    )
    cap.name = 'press-cap'
    moving.add(cap)
    return {
      root,
      hitTargets: [cap],
      setVisual({ depth, travel, glowing, glowLevel, disabled }) {
        moving.position.y =
          0.32 - Math.max(0, Math.min(depth, 1)) * Math.min(Math.max(travel, 0), 0.16)
        // 大ランプは固定。赤い小ボタンには発光を適用しない。
        lensMaterial.emissiveIntensity =
          glowing && !disabled ? appearance.glowIntensity * Math.max(0, Math.min(1, glowLevel)) : 0
        capMaterial.color.set(appearance.capColor)
        lensMaterial.color.set(lampColor)
        if (disabled) {
          capMaterial.color.multiplyScalar(0.55)
          lensMaterial.color.multiplyScalar(0.65)
        }
      },
    }
  })
}
