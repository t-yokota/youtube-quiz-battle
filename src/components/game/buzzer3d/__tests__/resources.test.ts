import { Group } from 'three'
import { buildModel } from '../resources'
it('生成途中の例外でも確保済み資産を解放する', () => {
  const dispose = vi.fn()
  expect(() =>
    buildModel((track) => {
      track({ dispose })
      throw new Error('allocation failure')
    }),
  ).toThrow('allocation failure')
  expect(dispose).toHaveBeenCalledOnce()
})
it('共有資産を重複解放せず、disposeも冪等', () => {
  const resource = { dispose: vi.fn() }
  const model = buildModel((track) => {
    track(resource)
    track(resource)
    return { root: new Group(), hitTargets: [], setVisual() {} }
  })
  model.dispose()
  model.dispose()
  expect(resource.dispose).toHaveBeenCalledOnce()
})
