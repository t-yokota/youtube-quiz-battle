// 画面向き検出の composable
//
// タッチデバイス（pointer: coarse）でのみ横画面を検出し、
// onLandscape / onPortrait コールバックを呼び出す。
// PC（pointer: fine）では何もしない（裁定 O2）。
import { ref, type Ref } from 'vue'

const ORIENTATION_LANDSCAPE_QUERY = '(orientation: landscape)'
const POINTER_COARSE_QUERY = '(pointer: coarse)'

/**
 * 画面向き検出の composable
 * @param onLandscape 横画面になったときに呼ばれるコールバック
 * @param onPortrait 縦画面に戻ったときに呼ばれるコールバック
 */
export function useOrientationGuard(
  onLandscape: () => void,
  onPortrait: () => void,
): { isLandscape: Readonly<Ref<boolean>>; stop: () => void } {
  const isLandscape = ref(false)

  const isTouchDevice = window.matchMedia(POINTER_COARSE_QUERY).matches
  const landscapeQuery = window.matchMedia(ORIENTATION_LANDSCAPE_QUERY)

  let changeHandler: ((e: MediaQueryListEvent) => void) | null = null

  if (isTouchDevice) {
    isLandscape.value = landscapeQuery.matches

    changeHandler = (e: MediaQueryListEvent) => {
      isLandscape.value = e.matches
      if (e.matches) {
        onLandscape()
      } else {
        onPortrait()
      }
    }
    landscapeQuery.addEventListener('change', changeHandler)
  }

  function stop(): void {
    if (changeHandler) {
      landscapeQuery.removeEventListener('change', changeHandler)
      changeHandler = null
    }
  }

  return { isLandscape, stop }
}
