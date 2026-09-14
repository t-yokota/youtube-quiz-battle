import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { ButtonSettings } from '@/constants/button'
import { logger } from '@/utils/logger'

export function useButtonPreviewImage(
  host: Ref<HTMLElement | undefined>,
  settings: () => ButtonSettings,
) {
  const image = ref<string | null>(null)
  let observer: ResizeObserver | undefined
  let generation = 0
  let mounted = false
  async function update() {
    const current = ++generation
    image.value = null
    const element = host.value
    const { renderMode, modelId } = settings()
    if (!mounted || renderMode !== '3d' || !element) return
    const width = element.clientWidth
    const height = element.clientHeight
    if (!width || !height) return
    try {
      const { getButtonPreviewImage } = await import('./buttonPreviewImage')
      if (!mounted || current !== generation) return
      image.value = getButtonPreviewImage(modelId, width, height)
    } catch (error) {
      if (mounted && current === generation) logger.warn('[ThemePreview] Using 2D fallback:', error)
    }
  }
  onMounted(() => {
    mounted = true
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(update)
      if (host.value) observer.observe(host.value)
    }
    void update()
  })
  watch(() => [settings().renderMode, settings().modelId], update, { flush: 'post' })
  onBeforeUnmount(() => {
    mounted = false
    generation++
    observer?.disconnect()
  })
  return image
}
