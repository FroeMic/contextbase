interface ResolveForwardedWheelScrollInput {
  currentScrollLeft: number
  currentScrollTop: number
  deltaX: number
  deltaY: number
  contentWidth: number
  contentHeight: number
  viewportWidth: number
  viewportHeight: number
}

interface ForwardedWheelScroll {
  didScroll: boolean
  scrollLeft: number
  scrollTop: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function resolveForwardedWheelScroll({
  currentScrollLeft,
  currentScrollTop,
  deltaX,
  deltaY,
  contentWidth,
  contentHeight,
  viewportWidth,
  viewportHeight,
}: ResolveForwardedWheelScrollInput): ForwardedWheelScroll {
  const maxScrollLeft = Math.max(contentWidth - viewportWidth, 0)
  const maxScrollTop = Math.max(contentHeight - viewportHeight, 0)

  const scrollLeft = clamp(currentScrollLeft + deltaX, 0, maxScrollLeft)
  const scrollTop = clamp(currentScrollTop + deltaY, 0, maxScrollTop)

  return {
    didScroll: scrollLeft !== currentScrollLeft || scrollTop !== currentScrollTop,
    scrollLeft,
    scrollTop,
  }
}
