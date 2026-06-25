import type { DatatableState } from "../../types/state.types"
import type { PersistedTableState } from "../persistence/table-state-adapter.types"
import type { DatatableView } from "../saved-views/datatable-view-adapter.types"
import { replaySavedViewState } from "./table-state-snapshot.ts"

export function applySavedViewState(state: DatatableState, view: DatatableView): DatatableState {
  const viewState = replaySavedViewState(view.state)

  return {
    ...state,
    ...viewState,
    activeViewId: view.id,
    columnWidths: view.readonly ? state.columnWidths : viewState.columnWidths,
  }
}

export function mergeStateWithPriority(sources: {
  base: DatatableState
  initialState?: Partial<DatatableState>
  workspaceDefaultView?: DatatableView
  userDefaultView?: DatatableView
  persistedState?: PersistedTableState | null
  linkedView?: DatatableView | null
  urlState?: Partial<DatatableState> | null
}): DatatableState {
  let state: DatatableState = { ...sources.base }

  if (sources.initialState) {
    state = { ...state, ...sources.initialState }
  }

  const hasPersistedState = sources.persistedState !== null && sources.persistedState !== undefined

  if (!hasPersistedState) {
    if (sources.workspaceDefaultView) {
      state = applySavedViewState(state, sources.workspaceDefaultView)
    }

    if (sources.userDefaultView) {
      state = applySavedViewState(state, sources.userDefaultView)
    }
  }

  if (hasPersistedState) {
    state = { ...state, ...sources.persistedState }
  }

  if (sources.linkedView) {
    state = applySavedViewState(state, sources.linkedView)
  }

  if (sources.urlState) {
    state = { ...state, ...sources.urlState }
  }

  return state
}
