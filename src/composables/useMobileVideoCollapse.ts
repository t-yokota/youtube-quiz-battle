import { nextTick, onScopeDispose, ref, watch, type Ref } from 'vue'

/** UIを動画の手前で移動し、移動完了後にだけ動画のレイアウト領域を外す。 */
export function useMobileVideoCollapse(
  main: Ref<HTMLElement | undefined>,
  requested: Ref<boolean>,
) {
  const collapsed = ref(false)
  let animations: Animation[] = []
  let generation = 0
  const cancel = () => {
    animations.forEach((animation) => animation.cancel())
    animations = []
  }
  watch(
    requested,
    async (hide) => {
      const current = ++generation
      const elements = Array.from(
        main.value?.querySelectorAll<HTMLElement>(':scope > .game-info, :scope > .game-ui') ?? [],
      )
      // 途中で解答が終わった場合も、現在見えている位置から戻す。
      const previous = elements.map((element) => element.getBoundingClientRect().top)
      cancel()
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced || !elements.length || elements.some((element) => !element.animate)) {
        collapsed.value = hide
        return
      }
      collapsed.value = false
      await nextTick()
      if (current !== generation) return
      const height =
        main.value?.querySelector('.video-player-container')?.getBoundingClientRect().height ?? 0
      const easing = getComputedStyle(main.value!).getPropertyValue('--ease-brand').trim() || 'ease'
      const active = elements.map((element, index) =>
        element.animate(
          [
            {
              transform: `translateY(${previous[index]! - element.getBoundingClientRect().top}px)`,
            },
            { transform: `translateY(${hide ? -height : 0}px)` },
          ],
          { duration: 280, easing, fill: 'forwards' },
        ),
      )
      animations = active
      try {
        await Promise.all(active.map((animation) => animation.finished))
      } catch {
        // 再操作・画面切替・破棄によるキャンセル。新しい遷移側が後始末する。
        return
      }
      if (current !== generation) return
      collapsed.value = hide
      await nextTick()
      // 高さを外したレイアウトとtransform解除を同じ描画フレームへ反映する。
      if (current === generation) cancel()
    },
    { flush: 'post' },
  )
  onScopeDispose(() => {
    generation++
    cancel()
  })
  return collapsed
}
