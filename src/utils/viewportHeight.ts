const VIEWPORT_RETRY_DELAYS_MS = [100, 500, 1000] as const
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

  const update = () => {
    const height = resolveVisibleViewportHeight(window.innerHeight, visualViewport?.height)
    const viewportWidthChanged =
      keyboardBaseline !== null && Math.abs(window.innerWidth - keyboardBaseline.width) >= 1
    const keyboardIsContractingViewport =
      keyboardBaseline !== null && height < keyboardBaseline.height * KEYBOARD_CONTRACTION_RATIO

    if (viewportWidthChanged) keyboardBaseline = null
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
    keyboardBaseline = { height: layoutViewportHeight, width: window.innerWidth }
  }

  window.addEventListener('resize', scheduleUpdate)
  window.addEventListener('pageshow', scheduleUpdate)
  window.addEventListener('load', scheduleUpdate)
  visualViewport?.addEventListener('resize', scheduleUpdate)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  document.addEventListener('focusin', handleFocusIn)
  scheduleUpdate()

  return () => {
    clearScheduledUpdates()
    window.removeEventListener('resize', scheduleUpdate)
    window.removeEventListener('pageshow', scheduleUpdate)
    window.removeEventListener('load', scheduleUpdate)
    visualViewport?.removeEventListener('resize', scheduleUpdate)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    document.removeEventListener('focusin', handleFocusIn)
  }
}
