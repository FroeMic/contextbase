export function resolveOnlineColumnValue<TData>({
  row,
  columnId,
  accessorFn,
}: {
  row: TData
  columnId: string
  accessorFn?: (row: TData, index: number) => unknown
}) {
  if (accessorFn) {
    return accessorFn(row, 0)
  }

  return (row as Record<string, unknown>)[columnId]
}

export function createOnlineCellContext<TData>({
  rowId,
  row,
  columnId,
  value,
  column,
  table,
  getColumnValue,
}: {
  rowId: string
  row: TData
  columnId: string
  value: unknown
  column?: unknown
  table?: unknown
  getColumnValue: (columnId: string) => unknown
}) {
  const contextColumn = column ?? { id: columnId }
  const context = {
    getValue: () => value,
    renderValue: () => value,
    table,
    row: {
      id: rowId,
      original: row,
      getValue: getColumnValue,
    },
    column: contextColumn,
    cell: {
      id: `${rowId}_${columnId}`,
      column: contextColumn,
      getValue: () => value,
      renderValue: () => value,
    },
  }

  Object.assign(context.cell, { row: context.row })

  return context
}
