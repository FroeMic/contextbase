interface BuildVisibleColumnSlotsForDragArgs {
  visibleColumnOrder: string[]
  activeId: string | null
  sourceIndex: number | null
  targetIndex: number | null
}

export function buildVisibleColumnSlotsForDrag({
  visibleColumnOrder,
  activeId,
  sourceIndex,
  targetIndex,
}: BuildVisibleColumnSlotsForDragArgs): Array<string | null> {
  if (!activeId || targetIndex === null) {
    return visibleColumnOrder
  }

  if (sourceIndex === null || sourceIndex === targetIndex) {
    return visibleColumnOrder
  }

  const withoutActive = visibleColumnOrder.filter((columnId) => columnId !== activeId)

  if (withoutActive.length === visibleColumnOrder.length) {
    return visibleColumnOrder
  }

  const clampedTargetIndex = Math.min(Math.max(targetIndex, 0), visibleColumnOrder.length - 1)
  const nextSlots: Array<string | null> = [...withoutActive]
  nextSlots.splice(clampedTargetIndex, 0, null)
  return nextSlots
}
