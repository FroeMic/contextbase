import { deepEqual } from "../../shared/utils/deep-equal"
import type { DatatableRowSelectionState, OnlineQueryStateInput } from "../../types"

interface ShouldResetSelectionForQueryChangeParams {
  previousQuery: OnlineQueryStateInput | null
  nextQuery: OnlineQueryStateInput
  selection: DatatableRowSelectionState
  activeRowId: string | null
  previewRowId: string | null
}

function hasActiveSelection(selection: DatatableRowSelectionState) {
  if (selection.kind === "allMatching") {
    return selection.totalMatchingRows > Object.keys(selection.excludedIds).length
  }

  return Object.keys(selection.ids).length > 0 || Object.keys(selection.rangeRowIds).length > 0
}

export function shouldResetInteractionStateForQueryChange({
  previousQuery,
  nextQuery,
  selection,
  activeRowId,
  previewRowId,
}: ShouldResetSelectionForQueryChangeParams) {
  if (!previousQuery) {
    return false
  }

  if (!hasActiveSelection(selection) && !activeRowId && !previewRowId) {
    return false
  }

  return !deepEqual(previousQuery, nextQuery)
}
