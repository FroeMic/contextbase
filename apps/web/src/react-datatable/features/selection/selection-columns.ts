export const DATATABLE_SELECTION_COLUMN_ID = "__datatable_selection__"
export const DATATABLE_SELECTION_COLUMN_WIDTH = 40

export function buildGridVisibleColumnOrder<TColumnId extends string | null>(
  visibleColumnOrder: TColumnId[],
  selectionEnabled: boolean,
  showSelectionColumn = selectionEnabled,
): Array<TColumnId | typeof DATATABLE_SELECTION_COLUMN_ID> {
  if (!selectionEnabled || !showSelectionColumn) {
    return visibleColumnOrder
  }

  return [DATATABLE_SELECTION_COLUMN_ID, ...visibleColumnOrder]
}

export function getEffectiveFrozenColumnsCount(
  stickyColumnsCount: number,
  selectionEnabled: boolean,
  showSelectionColumn = selectionEnabled,
): number {
  if (!selectionEnabled || !showSelectionColumn) {
    return stickyColumnsCount
  }

  return stickyColumnsCount > 0 ? stickyColumnsCount + 1 : 0
}

export function isSelectionColumnId(columnId: string | null | undefined): boolean {
  return columnId === DATATABLE_SELECTION_COLUMN_ID
}
