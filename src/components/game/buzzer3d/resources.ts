import type { BuzzerModel } from './contracts'
interface Disposable {
  dispose(): void
}
type Track = <T extends Disposable>(resource: T) => T
/** factory生成途中の失敗も含め、モデルが所有するGPU資産を一度だけ解放する。 */
export function buildModel(build: (track: Track) => Omit<BuzzerModel, 'dispose'>): BuzzerModel {
  const resources = new Set<Disposable>()
  const track: Track = (resource) => {
    resources.add(resource)
    return resource
  }
  function dispose() {
    resources.forEach((resource) => resource.dispose())
    resources.clear()
  }
  try {
    return { ...build(track), dispose }
  } catch (error) {
    dispose()
    throw error
  }
}
