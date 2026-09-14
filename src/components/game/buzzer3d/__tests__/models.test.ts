import { Mesh, MeshStandardMaterial, type BufferGeometry } from 'three'
import { createModel } from '../models'

it.each(['simple-round-v1', 'waseda-style-v1'] as const)(
  '%sは可動部だけ沈み、WAITでは復帰・消灯し資産を解放する',
  (id) => {
    const model = createModel(id)
    const cap = model.hitTargets[0]!
    const rest = cap.parent!.position.y
    model.setVisual({ depth: 1, travel: 0.15, glowing: true, glowLevel: 1, disabled: false })
    expect(cap.parent!.position.y).toBeCloseTo(rest - 0.15)
    const lit: Mesh<BufferGeometry, MeshStandardMaterial>[] = []
    model.root.traverse((o) => {
      if (
        o instanceof Mesh &&
        o.material instanceof MeshStandardMaterial &&
        o.material.emissiveIntensity > 0 &&
        o.material.emissive?.getHex() !== 0
      )
        lit.push(o)
    })
    expect(lit.length).toBeGreaterThan(0)
    if (id === 'waseda-style-v1') expect(lit.every((o) => o !== cap)).toBe(true)
    model.setVisual({ depth: 0, travel: 0.15, glowing: false, glowLevel: 0, disabled: true })
    expect(cap.parent!.position.y).toBe(rest)
    expect(lit.every((o) => o.material.emissiveIntensity === 0)).toBe(true)
    const geometry = vi.spyOn((cap as Mesh).geometry, 'dispose')
    model.dispose()
    expect(geometry).toHaveBeenCalledOnce()
  },
)
