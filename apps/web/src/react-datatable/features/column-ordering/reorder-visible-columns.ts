import { arrayMove } from "@dnd-kit/sortable"

interface ReorderVisibleColumnsArgs {
  columnOrder: string[]
  columnVisibility: Record<string, boolean>
  activeId: string
  overId: string
}

/**
 * Reorder only the visible columns while preserving the relative positions of hidden columns.
 */
export function reorderVisibleColumns({
  columnOrder,
  columnVisibility,
  activeId,
  overId,
}: ReorderVisibleColumnsArgs): string[] {
  const visibleColumnOrder = columnOrder.filter((id) => columnVisibility[id] !== false)
  const oldVisibleIndex = visibleColumnOrder.indexOf(activeId)
  const newVisibleIndex = visibleColumnOrder.indexOf(overId)

  if (oldVisibleIndex === -1 || newVisibleIndex === -1 || oldVisibleIndex === newVisibleIndex) {
    return columnOrder
  }

  const nextVisibleOrder = arrayMove(visibleColumnOrder, oldVisibleIndex, newVisibleIndex)
  let nextVisibleIndex = 0

  return columnOrder.map((id) => {
    if (columnVisibility[id] === false) {
      return id
    }

    const nextId = nextVisibleOrder[nextVisibleIndex]
    nextVisibleIndex += 1
    return nextId
  })
}
