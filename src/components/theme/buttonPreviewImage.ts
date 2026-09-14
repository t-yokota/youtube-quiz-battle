import type { ButtonModelId } from '@/constants/button'
import { createButtonView } from '@/components/game/button3d/view'

// 同じ寸法の一覧カードとズームで共有する。リサイズ履歴を無制限に保持しない。
const images = new Map<string, string>()
const MAX_IMAGES = 12

export function getButtonPreviewImage(modelId: ButtonModelId, width: number, height: number) {
  const key = `${modelId}:${width}:${height}:${Math.min(window.devicePixelRatio || 1, 2)}`
  const cached = images.get(key)
  if (cached) return cached
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;pointer-events:none`
  host.setAttribute('aria-hidden', 'true')
  document.body.appendChild(host)
  let view: ReturnType<typeof createButtonView> | undefined
  try {
    view = createButtonView(host, {
      modelId,
      onError(error) {
        throw error
      },
      onTarget() {},
    })
    const image = view.captureSnapshot()
    if (images.size >= MAX_IMAGES) images.delete(images.keys().next().value!)
    images.set(key, image)
    return image
  } finally {
    view?.dispose(true)
    host.remove()
  }
}
