export type ScrollableGridGeometryInput = {
  frozenHeight: number
  frozenWidth: number
  height: number
  measuredVerticalScrollbarWidth: number
  totalHeight: number
  totalWidth: number
  width: number
}

export type ScrollableGridGeometry = {
  hasHorizontalOverflow: boolean
  scrollableClientWidth: number
  scrollableContentHeight: number
  scrollableContentWidth: number
  scrollableViewportHeight: number
  scrollableViewportWidth: number
  scrollContainerPaddingRight: number
}

export function resolveScrollableGridGeometry({
  frozenHeight,
  frozenWidth,
  height,
  measuredVerticalScrollbarWidth,
  totalHeight,
  totalWidth,
  width,
}: ScrollableGridGeometryInput): ScrollableGridGeometry {
  const scrollableViewportWidth = Math.max(width - frozenWidth, 0)
  const scrollableViewportHeight = Math.max(height - frozenHeight, 0)
  const scrollableContentWidth = Math.max(totalWidth - frozenWidth, 0)
  const scrollableContentHeight = Math.max(totalHeight - frozenHeight, 0)
  const scrollableClientWidth = Math.max(
    scrollableViewportWidth - measuredVerticalScrollbarWidth,
    0,
  )

  return {
    hasHorizontalOverflow: scrollableContentWidth > scrollableClientWidth,
    scrollableClientWidth,
    scrollableContentHeight,
    scrollableContentWidth,
    scrollableViewportHeight,
    scrollableViewportWidth,
    scrollContainerPaddingRight: 0,
  }
}
