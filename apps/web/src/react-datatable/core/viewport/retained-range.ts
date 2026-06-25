import type { AxisRange } from "./viewport.types"

export function mergeAxisRanges(left: AxisRange | null, right: AxisRange | null): AxisRange | null {
  if (!left) {
    return right
  }

  if (!right) {
    return left
  }

  return {
    startIndex: Math.min(left.startIndex, right.startIndex),
    endIndex: Math.max(left.endIndex, right.endIndex),
  }
}

export function mergeAxisRangesWithinLimit(
  previousRange: AxisRange | null,
  nextRange: AxisRange | null,
  maxMergedSpan: number,
): AxisRange | null {
  const mergedRange = mergeAxisRanges(previousRange, nextRange)
  if (!mergedRange || !nextRange) {
    return mergedRange
  }

  const mergedSpan = mergedRange.endIndex - mergedRange.startIndex + 1
  return mergedSpan <= maxMergedSpan ? mergedRange : nextRange
}
