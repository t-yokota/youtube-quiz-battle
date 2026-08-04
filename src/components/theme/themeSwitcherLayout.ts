const CARD_VIEWPORT_SCALE = 0.38
const CARD_MIN_WIDTH = 80
const CARD_MAX_WIDTH = 180

export interface CardGeometryInput {
  viewportWidth: number
  viewportHeight: number
}

export interface CardGeometry {
  width: number
  height: number
  previewWidth: number
  previewHeight: number
  previewScale: number
}

export function calculateCardGeometry({
  viewportWidth,
  viewportHeight,
}: CardGeometryInput): CardGeometry {
  const safeViewportWidth = Math.max(1, viewportWidth)
  const safeViewportHeight = Math.max(1, viewportHeight)
  const minimumWidth = Math.min(CARD_MIN_WIDTH, safeViewportWidth * 0.8)
  const width = Math.min(
    CARD_MAX_WIDTH,
    Math.max(minimumWidth, safeViewportWidth * CARD_VIEWPORT_SCALE),
  )
  const viewportScale = width / safeViewportWidth
  const height = safeViewportHeight * viewportScale

  return {
    width,
    height,
    previewWidth: safeViewportWidth,
    previewHeight: safeViewportHeight,
    previewScale: viewportScale,
  }
}

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
