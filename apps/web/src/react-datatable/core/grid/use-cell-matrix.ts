import type { Cell, Table } from "@tanstack/react-table"
import { useMemo } from "react"
import type { CellMatrix } from "../../types/grid.types"

/**
 * Build a cell matrix for O(1) cell lookups
 *
 * Instead of calling row.getVisibleCells().find() in render (O(n)),
 * we build a Map with keys like "rowId-columnId" (O(1) lookup).
 *
 * @param table - TanStack Table instance
 * @returns Map<"rowId-columnId", Cell>
 */
export function useCellMatrix<TData>(table: Table<TData>, enabled = true): CellMatrix<TData> {
  const rows = enabled ? table.getRowModel().rows : []
  const visibleColumnSignature = enabled
    ? table
        .getVisibleLeafColumns()
        .map((column) => column.id)
        .join("|")
    : ""

  return useMemo(() => {
    // Row objects can stay stable while visible columns change.
    visibleColumnSignature
    const matrix = new Map<string, Cell<TData, unknown>>()

    for (const row of rows) {
      const cells = row.getVisibleCells()

      cells.forEach((cell) => {
        const key = `${row.id}-${cell.column.id}`
        matrix.set(key, cell)
      })
    }

    return matrix
  }, [rows, visibleColumnSignature])
}
