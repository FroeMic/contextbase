import type { AxisRange, AxisVisibleRangeSet, PaneAxisRanges, PaneRanges } from "./viewport.types"

interface PartitionPanesOptions {
  rowRanges: AxisVisibleRangeSet
  columnRanges: AxisVisibleRangeSet
  frozenRowsCount: number
  frozenColumnsCount: number
}

function createFrozenRange(count: number): AxisRange | null {
  if (count <= 0) {
    return null
  }

  return {
    startIndex: 0,
    endIndex: count - 1,
  }
}

function createPane(rows: AxisRange | null, columns: AxisRange | null): PaneAxisRanges {
  return { rows, columns }
}

export function partitionPanes({
  rowRanges,
  columnRanges,
  frozenRowsCount,
  frozenColumnsCount,
}: PartitionPanesOptions): PaneRanges {
  const frozenRowRange = createFrozenRange(frozenRowsCount)
  const frozenColumnRange = createFrozenRange(frozenColumnsCount)

  return {
    topLeft: createPane(frozenRowRange, frozenColumnRange),
    topRight: createPane(frozenRowRange, columnRanges.rendered),
    bottomLeft: createPane(rowRanges.rendered, frozenColumnRange),
    bottomRight: createPane(rowRanges.rendered, columnRanges.rendered),
  }
}
