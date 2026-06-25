interface BuildDisplayedColumnsForDragArgs {
  activeId: string | null
  visibleColumnOrder: string[]
  previewVisibleColumnSlots: Array<string | null>
  getColumnWidth: (columnId: string) => number
}

interface BuildDisplayedColumnsForDragResult {
  displayedColumnSlots: Array<string | null>
  displayedColumnWidths: number[]
  totalDisplayedColumnsWidth: number
}

export function buildDisplayedColumnsForDrag({
  activeId,
  visibleColumnOrder,
  previewVisibleColumnSlots,
  getColumnWidth,
}: BuildDisplayedColumnsForDragArgs): BuildDisplayedColumnsForDragResult {
  const displayedColumnSlots = activeId ? previewVisibleColumnSlots : visibleColumnOrder

  const displayedColumnWidths = displayedColumnSlots.map((columnId) => {
    if (columnId) {
      return getColumnWidth(columnId)
    }

    return activeId ? getColumnWidth(activeId) : 0
  })

  const totalDisplayedColumnsWidth = displayedColumnWidths.reduce(
    (sum, columnWidth) => sum + columnWidth,
    0,
  )

  return {
    displayedColumnSlots,
    displayedColumnWidths,
    totalDisplayedColumnsWidth,
  }
}
