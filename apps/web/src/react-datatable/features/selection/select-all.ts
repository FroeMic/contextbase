import type { OnlineQueryStateInput } from "../../types/props.types"
import type { DatatableRowSelectionState } from "../../types/state.types"

export type SelectAllResolution =
  | { action: "deselect" }
  | {
      action: "selectAllMatching"
      query: OnlineQueryStateInput
      totalMatchingRows: number
    }
  | {
      action: "selectLoadedExplicitly"
      ids: Record<string, true>
      lastSingleSelectedRowId: string | null
    }

export function resolveSelectAllAction({
  currentSelection,
  allowSelectAllMatching,
  orderedSelectableRowIds,
  query,
  totalMatchingRows,
}: {
  currentSelection: DatatableRowSelectionState
  allowSelectAllMatching: boolean
  orderedSelectableRowIds: string[]
  query: OnlineQueryStateInput
  totalMatchingRows: number
}): SelectAllResolution {
  if (currentSelection.kind === "allMatching") {
    return { action: "deselect" }
  }

  if (allowSelectAllMatching) {
    return {
      action: "selectAllMatching",
      query,
      totalMatchingRows,
    }
  }

  return {
    action: "selectLoadedExplicitly",
    ids: Object.fromEntries(orderedSelectableRowIds.map((rowId) => [rowId, true])) as Record<
      string,
      true
    >,
    lastSingleSelectedRowId: orderedSelectableRowIds.at(-1) ?? null,
  }
}
