import type { PositionCache } from "./position-cache"
import type { AxisRange, AxisVisibleRangeSet } from "./viewport.types"

export interface CalculateAxisRangeOptions {
  positionCache: PositionCache
  viewportOffset: number
  viewportSize: number
  overscanCount?: number
  minIndex?: number
  maxIndex?: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function createRange(startIndex: number, endIndex: number): AxisRange | null {
  if (endIndex < startIndex) {
    return null
  }

  return { startIndex, endIndex }
}

function findLastVisibleIndex(
  positionCache: PositionCache,
  startIndex: number,
  viewportEnd: number,
  maxIndex: number,
) {
  let currentIndex = startIndex

  while (currentIndex < maxIndex) {
    const itemStart = positionCache.getOffset(currentIndex)
    const itemEnd = itemStart + positionCache.getSizeAt(currentIndex)

    if (itemEnd >= viewportEnd) {
      return currentIndex
    }

    currentIndex += 1
  }

  return maxIndex
}

export function calculateAxisRange({
  positionCache,
  viewportOffset,
  viewportSize,
  overscanCount = 1,
  minIndex = 0,
  maxIndex = positionCache.getCount() - 1,
}: CalculateAxisRangeOptions): AxisVisibleRangeSet {
  if (viewportSize <= 0 || positionCache.getCount() === 0 || maxIndex < minIndex) {
    return {
      rendered: null,
      visible: null,
      fullyVisible: null,
    }
  }

  const safeMinIndex = clamp(minIndex, 0, Math.max(positionCache.getCount() - 1, 0))
  const safeMaxIndex = clamp(maxIndex, safeMinIndex, Math.max(positionCache.getCount() - 1, 0))
  const viewportStart = Math.max(viewportOffset, 0)
  const viewportEnd = viewportStart + viewportSize

  const rawStartIndex = positionCache.findIndexAtOffset(viewportStart)
  const visibleStartIndex = clamp(rawStartIndex, safeMinIndex, safeMaxIndex)
  const visibleEndIndex = clamp(
    findLastVisibleIndex(positionCache, visibleStartIndex, viewportEnd, safeMaxIndex),
    visibleStartIndex,
    safeMaxIndex,
  )

  const startCellStart = positionCache.getOffset(visibleStartIndex)
  const startCellEnd = startCellStart + positionCache.getSizeAt(visibleStartIndex)
  const fullyVisibleStartIndex =
    startCellStart >= viewportStart || startCellEnd <= viewportStart
      ? visibleStartIndex
      : clamp(visibleStartIndex + 1, visibleStartIndex, visibleEndIndex)

  const endCellStart = positionCache.getOffset(visibleEndIndex)
  const endCellEnd = endCellStart + positionCache.getSizeAt(visibleEndIndex)
  const fullyVisibleEndIndex =
    endCellEnd <= viewportEnd
      ? visibleEndIndex
      : clamp(visibleEndIndex - 1, visibleStartIndex, visibleEndIndex)

  return {
    rendered: createRange(
      clamp(visibleStartIndex - overscanCount, safeMinIndex, safeMaxIndex),
      clamp(visibleEndIndex + overscanCount, safeMinIndex, safeMaxIndex),
    ),
    visible: createRange(visibleStartIndex, visibleEndIndex),
    fullyVisible: createRange(fullyVisibleStartIndex, fullyVisibleEndIndex),
  }
}
