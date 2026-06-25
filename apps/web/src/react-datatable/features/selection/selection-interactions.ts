interface GetShiftSelectionRangeRowIdsParams {
  orderedRowIds: string[]
  anchorRowId: string | null
  targetRowId: string
}

interface GetNextActiveRowIdParams {
  orderedRowIds: string[]
  currentRowId: string | null
  direction: "next" | "previous"
}

type ActiveItemKeyboardAction =
  | {
      type: "open-row"
      rowId: string
    }
  | {
      type: "toggle-preview-row"
      rowId: string
      nextPreviewRowId: string | null
    }
  | {
      type: "toggle-group"
      groupId: string
    }

export function getShiftSelectionRangeRowIds({
  orderedRowIds,
  anchorRowId,
  targetRowId,
}: GetShiftSelectionRangeRowIdsParams): string[] {
  if (!anchorRowId) {
    return []
  }

  const anchorIndex = orderedRowIds.indexOf(anchorRowId)
  const targetIndex = orderedRowIds.indexOf(targetRowId)

  if (anchorIndex === -1 || targetIndex === -1 || anchorIndex === targetIndex) {
    return []
  }

  if (anchorIndex < targetIndex) {
    return orderedRowIds.slice(anchorIndex + 1, targetIndex + 1)
  }

  return orderedRowIds.slice(targetIndex, anchorIndex)
}

export function getNextActiveRowId({
  orderedRowIds,
  currentRowId,
  direction,
}: GetNextActiveRowIdParams): string | null {
  if (orderedRowIds.length === 0) {
    return null
  }

  if (!currentRowId) {
    return direction === "next" ? orderedRowIds[0] : orderedRowIds[orderedRowIds.length - 1]
  }

  const currentIndex = orderedRowIds.indexOf(currentRowId)
  if (currentIndex === -1) {
    return direction === "next" ? orderedRowIds[0] : orderedRowIds[orderedRowIds.length - 1]
  }

  if (direction === "next") {
    return orderedRowIds[Math.min(currentIndex + 1, orderedRowIds.length - 1)]
  }

  return orderedRowIds[Math.max(currentIndex - 1, 0)]
}

export function getNextActivePreviewRowId({
  previewRowId,
  nextActiveItemId,
  nextActiveItemKind,
}: {
  previewRowId: string | null
  nextActiveItemId: string | null
  nextActiveItemKind: "data" | "group-header" | null
}): string | null {
  if (!previewRowId) {
    return null
  }

  if (!nextActiveItemId || nextActiveItemKind !== "data") {
    return previewRowId
  }

  return nextActiveItemId
}

export function getActiveItemKeyboardAction({
  key,
  metaKey,
  ctrlKey,
  altKey,
  keyboardNavigationEnabled,
  activeItemId,
  activeItemKind,
  previewRowId,
  canOpenRow,
  canTogglePreview,
}: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  keyboardNavigationEnabled: boolean
  activeItemId: string | null
  activeItemKind: "data" | "group-header" | null
  previewRowId: string | null
  canOpenRow: boolean
  canTogglePreview: boolean
}): ActiveItemKeyboardAction | null {
  if (
    !keyboardNavigationEnabled ||
    metaKey ||
    ctrlKey ||
    altKey ||
    !activeItemId ||
    !activeItemKind
  ) {
    return null
  }

  if ((key === "Enter" || key === " " || key === "Space") && activeItemKind === "group-header") {
    return {
      type: "toggle-group",
      groupId: activeItemId,
    }
  }

  if (key === "Enter" && canOpenRow && activeItemKind === "data") {
    return {
      type: "open-row",
      rowId: activeItemId,
    }
  }

  if ((key === " " || key === "Space") && canTogglePreview && activeItemKind === "data") {
    return {
      type: "toggle-preview-row",
      rowId: activeItemId,
      nextPreviewRowId: previewRowId === activeItemId ? null : activeItemId,
    }
  }

  return null
}
