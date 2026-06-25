interface GetTargetVisibleColumnIndexFromPointerXArgs {
  pointerX: number
  columnWidths: number[]
}

export function getTargetVisibleColumnIndexFromPointerX({
  pointerX,
  columnWidths,
}: GetTargetVisibleColumnIndexFromPointerXArgs): number | null {
  if (columnWidths.length === 0) {
    return null
  }

  let accumulatedWidth = 0

  for (let index = 0; index < columnWidths.length; index += 1) {
    const width = columnWidths[index] ?? 0
    const midpoint = accumulatedWidth + width / 2

    if (pointerX < midpoint) {
      return index
    }

    accumulatedWidth += width
  }

  return columnWidths.length - 1
}
