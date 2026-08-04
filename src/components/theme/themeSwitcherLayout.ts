export interface HeadingPlacementInput {
  viewportTop: number
  cardTop: number
  headingHeight: number
  safeAreaTop: number
  viewportPadding: number
  cardGap: number
}

export interface HeadingPlacement {
  top: number
  visible: boolean
}

export function calculateHeadingPlacement({
  viewportTop,
  cardTop,
  headingHeight,
  safeAreaTop,
  viewportPadding,
  cardGap,
}: HeadingPlacementInput): HeadingPlacement {
  const minimumTop = viewportTop + safeAreaTop + viewportPadding
  const maximumTop = cardTop - headingHeight - cardGap

  if (maximumTop < minimumTop) {
    return { top: minimumTop, visible: false }
  }

  const centeredTop = (viewportTop + cardTop - headingHeight) / 2

  return {
    top: Math.min(Math.max(centeredTop, minimumTop), maximumTop),
    visible: true,
  }
}
