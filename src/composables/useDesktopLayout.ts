import { onScopeDispose, ref } from 'vue'

/** CSSのPCレイアウトと同じ条件。iframeではフレーム内部の幅を使用する。 */
export function useDesktopLayout() {
  const query = window.matchMedia('(min-width: 960px) and (pointer: fine)')
  const isDesktop = ref(query.matches)
  const update = () => {
    isDesktop.value = query.matches
  }
  query.addEventListener('change', update)
  onScopeDispose(() => query.removeEventListener('change', update))
  return isDesktop
}
