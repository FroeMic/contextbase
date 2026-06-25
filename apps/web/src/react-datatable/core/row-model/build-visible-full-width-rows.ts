import type { RenderableRow } from "../../types/renderable-row.types"

interface BuildVisibleFullWidthRowsArgs<TData> {
  visibleRowIndices: number[]
  frozenRowsCount: number
  frozenHeight: number
  renderableRows: RenderableRow<TData>[]
  getRenderableRowAt?: (rowIndex: number) => RenderableRow<TData> | null
  isFullWidthRow: (row: RenderableRow<TData>) => boolean
  getRowOffset: (rowIndex: number) => number
}

interface VisibleFullWidthRow<TData> {
  rowIndex: number
  y: number
  row: RenderableRow<TData>
}

export function buildVisibleFullWidthRows<TData>({
  visibleRowIndices,
  frozenRowsCount,
  frozenHeight,
  renderableRows,
  getRenderableRowAt,
  isFullWidthRow,
  getRowOffset,
}: BuildVisibleFullWidthRowsArgs<TData>): VisibleFullWidthRow<TData>[] {
  if (visibleRowIndices.length === 0) {
    return []
  }

  return visibleRowIndices.flatMap((rowIndex) => {
    const dataIndex = rowIndex - frozenRowsCount
    const row = getRenderableRowAt?.(rowIndex) ?? renderableRows[dataIndex]

    if (!row || !isFullWidthRow(row)) {
      return []
    }

    return [
      {
        rowIndex,
        y: getRowOffset(rowIndex) - frozenHeight,
        row,
      },
    ]
  })
}
