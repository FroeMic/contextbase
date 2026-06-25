import { getTargetVisibleColumnIndexFromPointerX } from "./get-target-visible-column-index-from-pointer-x"

export type ColumnDragTargetPane = "frozen" | "scrollable"

interface GetColumnTargetVisibleIndexFromPointerClientXArgs {
  pointerClientX: number
  gridLeft: number
  scrollContainerLeft: number
  scrollLeft: number
  columnWidths: number[]
  frozenColumnsCount: number
  previousPane?: ColumnDragTargetPane | null
  seamHysteresisPx?: number
}

interface ColumnTargetResolution {
  pane: ColumnDragTargetPane
  index: number | null
}

function resolveTargetPane({
  pointerClientX,
  scrollContainerLeft,
  frozenColumnsCount,
  previousPane,
  seamHysteresisPx,
}: Pick<
  GetColumnTargetVisibleIndexFromPointerClientXArgs,
  | "pointerClientX"
  | "scrollContainerLeft"
  | "frozenColumnsCount"
  | "previousPane"
  | "seamHysteresisPx"
>): ColumnDragTargetPane {
  const seamBuffer = seamHysteresisPx ?? 10

  if (frozenColumnsCount <= 0) {
    return "scrollable"
  }

  if (!previousPane) {
    return pointerClientX < scrollContainerLeft ? "frozen" : "scrollable"
  }

  if (previousPane === "frozen") {
    return pointerClientX > scrollContainerLeft + seamBuffer ? "scrollable" : "frozen"
  }

  return pointerClientX < scrollContainerLeft - seamBuffer ? "frozen" : "scrollable"
}

export function getColumnTargetVisibleIndexFromPointerClientX({
  pointerClientX,
  gridLeft,
  scrollContainerLeft,
  scrollLeft,
  columnWidths,
  frozenColumnsCount,
  previousPane = null,
  seamHysteresisPx = 10,
}: GetColumnTargetVisibleIndexFromPointerClientXArgs): ColumnTargetResolution | null {
  if (columnWidths.length === 0) {
    return null
  }

  const pane = resolveTargetPane({
    pointerClientX,
    scrollContainerLeft,
    frozenColumnsCount,
    previousPane,
    seamHysteresisPx,
  })

  const frozenWidths = columnWidths.slice(0, frozenColumnsCount)
  const scrollableWidths = columnWidths.slice(frozenColumnsCount)

  if (pane === "frozen") {
    return {
      pane,
      index: getTargetVisibleColumnIndexFromPointerX({
        pointerX: pointerClientX - gridLeft,
        columnWidths: frozenWidths,
      }),
    }
  }

  const scrollableTargetIndex = getTargetVisibleColumnIndexFromPointerX({
    pointerX: pointerClientX - scrollContainerLeft + scrollLeft,
    columnWidths: scrollableWidths,
  })

  if (scrollableTargetIndex === null) {
    return {
      pane,
      index: null,
    }
  }

  return {
    pane,
    index: frozenColumnsCount + scrollableTargetIndex,
  }
}
