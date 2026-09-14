const VIEWPORT_RETRY_DELAYS_MS = [100, 500, 1000] as const
const KEYBOARD_RESTORE_GRACE_MS = 1000
const KEYBOARD_CONTRACTION_RATIO = 0.8
const SOFT_KEYBOARD_INPUT_TYPES = new Set([
  'email',
  'number',
  'password',
  'search',
  'tel',
  'text',
  'url',
])

function isSoftKeyboardTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement) return true
  if (target instanceof HTMLInputElement) return SOFT_KEYBOARD_INPUT_TYPES.has(target.type)
  return target instanceof HTMLElement && target.isContentEditable
}

export function resolveVisibleViewportHeight(
  innerHeight: number,
  visualViewportHeight?: number,
): number {
  const candidates = [innerHeight, visualViewportHeight].filter(
    (height): height is number =>
      typeof height === 'number' && Number.isFinite(height) && height > 0,
  )

  return candidates.length > 0 ? Math.min(...candidates) : 1
}

export function installViewportHeightSync(): () => void {
  const root = document.documentElement
  const visualViewport = window.visualViewport
  let animationFrameId: number | null = null
  let retryTimerIds: number[] = []
  let layoutViewportHeight = resolveVisibleViewportHeight(
    window.innerHeight,
    visualViewport?.height,
  )
  let keyboardBaseline: { height: number; width: number } | null = null
  let restoreUntil: number | null = null
  let focusGeneration = 0
  let disposed = false

  const update = () => {
    let height = resolveVisibleViewportHeight(window.innerHeight, visualViewport?.height)
    const viewportWidthChanged =
      keyboardBaseline !== null && Math.abs(window.innerWidth - keyboardBaseline.width) >= 1
    const keyboardIsContractingViewport =
      keyboardBaseline !== null && height < keyboardBaseline.height * KEYBOARD_CONTRACTION_RATIO

    if (viewportWidthChanged) {
      keyboardBaseline = null
      restoreUntil = null
    }
    if (restoreUntil !== null) {
      if (
        keyboardBaseline &&
        keyboardIsContractingViewport &&
        !isSoftKeyboardTarget(document.activeElement) &&
        performance.now() < restoreUntil
      ) {
        height = keyboardBaseline.height
      } else restoreUntil = null
    }
    if (
      keyboardBaseline === null ||
      (!isSoftKeyboardTarget(document.activeElement) && !keyboardIsContractingViewport)
    ) {
      keyboardBaseline = null
      layoutViewportHeight = height
    }

    root.style.setProperty('--ui-viewport-height', `${height}px`)
    root.style.setProperty('--ui-layout-viewport-height', `${layoutViewportHeight}px`)
  }

  const clearScheduledUpdates = () => {
    if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId)
    for (const timerId of retryTimerIds) window.clearTimeout(timerId)
    animationFrameId = null
    retryTimerIds = []
  }

  const scheduleUpdate = () => {
    clearScheduledUpdates()
    update()
    if (typeof window.requestAnimationFrame === 'function') {
      animationFrameId = window.requestAnimationFrame(update)
    }
    retryTimerIds = VIEWPORT_RETRY_DELAYS_MS.map((delay) => window.setTimeout(update, delay))
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') scheduleUpdate()
  }

  const handleFocusIn = (event: FocusEvent) => {
    if (!isSoftKeyboardTarget(event.target)) return
    focusGeneration++
    const wasRestoring = restoreUntil !== null
    restoreUntil = null
    keyboardBaseline = { height: layoutViewportHeight, width: window.innerWidth }
    if (wasRestoring) scheduleUpdate()
  }

  // Safariの下部アドレスバー表示時は、キーボード終了アニメーションが終わるまで
  // visualViewport.height自体が縮小値のままになる（WebKit #265578）。
  // https://bugs.webkit.org/show_bug.cgi?id=265578
  // 実機で毎フレーム読み直しても改善せず、アドレスバーを上部へ移すと解消したため、
  // 再描画頻度ではなくfocusoutを契機に表示前の高さへ先行復元する。
  // 後続resizeの古い値による再縮小も抑え、実測高の回復・回転・再フォーカス、
  // または最大1秒で実測値へ戻す。フォーカスを残したまま閉じる操作は対象外。
  const handleFocusOut = (event: FocusEvent) => {
    if (!isSoftKeyboardTarget(event.target)) return
    const generation = ++focusGeneration
    // focusout中は次のactiveElementが未確定なので、入力欄間の移動が完了してから判定する。
    void Promise.resolve().then(() => {
      if (
        disposed ||
        generation !== focusGeneration ||
        isSoftKeyboardTarget(document.activeElement)
      )
        return
      const height = resolveVisibleViewportHeight(window.innerHeight, visualViewport?.height)
      if (
        !keyboardBaseline ||
        Math.abs(window.innerWidth - keyboardBaseline.width) >= 1 ||
        height >= keyboardBaseline.height * KEYBOARD_CONTRACTION_RATIO
      )
        return
      restoreUntil = performance.now() + KEYBOARD_RESTORE_GRACE_MS
      scheduleUpdate()
    })
  }

  window.addEventListener('resize', scheduleUpdate)
  window.addEventListener('pageshow', scheduleUpdate)
  window.addEventListener('load', scheduleUpdate)
  visualViewport?.addEventListener('resize', scheduleUpdate)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  document.addEventListener('focusin', handleFocusIn)
  document.addEventListener('focusout', handleFocusOut)
  scheduleUpdate()

  return () => {
    disposed = true
    clearScheduledUpdates()
    window.removeEventListener('resize', scheduleUpdate)
    window.removeEventListener('pageshow', scheduleUpdate)
    window.removeEventListener('load', scheduleUpdate)
    visualViewport?.removeEventListener('resize', scheduleUpdate)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    document.removeEventListener('focusin', handleFocusIn)
    document.removeEventListener('focusout', handleFocusOut)
  }
}
