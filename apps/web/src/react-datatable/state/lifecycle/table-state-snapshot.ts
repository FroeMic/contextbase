import type { ExpandedState, SortingState } from "@tanstack/react-table"
import type { ColumnFilter, IdListFilterPayload } from "../../types/filter.types"
import type { DatatableQueryOptions } from "../../types/state.types"
import type { PersistedTableState } from "../persistence/table-state-adapter.types"

export interface BackendGroupExpansionState {
  defaultExpanded: boolean
  overrides: Record<string, boolean>
}

export interface BackendGroupingState {
  columns: string[]
  showEmptyGroups: boolean
  expansion: BackendGroupExpansionState
}

export interface BackendQueryState {
  filters: ColumnFilter[]
  sorting: SortingState
  globalFilter: string
  grouping: BackendGroupingState | null
  filterMode: "AND" | "OR"
  options?: DatatableQueryOptions
}

export interface BackendPresentationState {
  showColumnHeaders: boolean
  stickyColumnsCount: number
  showHorizontalLines: boolean
  showVerticalLines: boolean
  showOrderingBadge: boolean
  columnOrder: string[]
  columnVisibility: Record<string, boolean>
  columnWidths: Record<string, number>
  activeViewId: string | null
}

export interface BackendTableStateSnapshot {
  version: 1
  query: BackendQueryState
  presentation: BackendPresentationState
}

export type DatatableViewState = BackendTableStateSnapshot
export type PersistedTableStateSnapshot = BackendTableStateSnapshot

export function normalizeGroupingColumns(columns: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const column of columns) {
    const trimmed = column.trim()
    if (!trimmed || seen.has(trimmed)) {
      continue
    }
    seen.add(trimmed)
    normalized.push(trimmed)
  }

  return normalized
}

export function normalizeGroupExpansionState(
  expanded: ExpandedState | undefined,
): BackendGroupExpansionState {
  if (expanded === undefined || expanded === true) {
    return {
      defaultExpanded: true,
      overrides: {},
    }
  }

  return {
    defaultExpanded: true,
    overrides: Object.fromEntries(Object.entries(expanded).sort(([a], [b]) => a.localeCompare(b))),
  }
}

export function buildBackendQueryState(input: {
  filters: ColumnFilter[]
  sorting: SortingState
  globalFilter: string
  filterMode: "AND" | "OR"
  grouping?: {
    columns: string[]
    showEmptyGroups?: boolean
    expansion?: BackendGroupExpansionState
  }
  groupExpanded?: ExpandedState
  queryOptions?: DatatableQueryOptions
}): BackendQueryState {
  const groupingColumns = normalizeGroupingColumns(input.grouping?.columns ?? [])

  return {
    filters: input.filters,
    sorting: input.sorting,
    globalFilter: input.globalFilter,
    filterMode: input.filterMode,
    options: input.queryOptions ?? {},
    grouping:
      groupingColumns.length > 0
        ? {
            columns: groupingColumns,
            showEmptyGroups: input.grouping?.showEmptyGroups ?? false,
            expansion:
              input.grouping?.expansion ?? normalizeGroupExpansionState(input.groupExpanded),
          }
        : null,
  }
}

export function splitPersistedTableState(state: PersistedTableState): BackendTableStateSnapshot {
  return {
    version: 1,
    query: buildBackendQueryState({
      filters: state.columnFilters,
      sorting: state.sorting,
      globalFilter: state.globalFilter,
      filterMode: state.filterMode,
      grouping: {
        columns: state.grouping,
        showEmptyGroups: state.showEmptyGroups,
      },
      groupExpanded: state.groupExpanded,
      queryOptions: state.queryOptions,
    }),
    presentation: {
      showColumnHeaders: state.showColumnHeaders,
      stickyColumnsCount: state.stickyColumnsCount,
      showHorizontalLines: state.showHorizontalLines,
      showVerticalLines: state.showVerticalLines,
      showOrderingBadge: state.showOrderingBadge,
      columnOrder: state.columnOrder,
      columnVisibility: state.columnVisibility,
      columnWidths: state.columnWidths,
      activeViewId: state.activeViewId ?? null,
    },
  }
}

export function buildPersistedTableStateSnapshot(
  state: PersistedTableState,
): PersistedTableStateSnapshot {
  return splitPersistedTableState(state)
}

export function buildDatatableViewState(state: PersistedTableState): DatatableViewState {
  return splitPersistedTableState(state)
}

function replayExpandedState(expansion: BackendGroupExpansionState | undefined): ExpandedState {
  if (!expansion || (expansion.defaultExpanded && Object.keys(expansion.overrides).length === 0)) {
    return true
  }

  if (!expansion.defaultExpanded) {
    throw new Error(
      "Saved view replay does not yet support default-collapsed grouped expansion state.",
    )
  }

  return Object.fromEntries(
    Object.entries(expansion.overrides).sort(([left], [right]) => left.localeCompare(right)),
  )
}

function normalizeLegacyColumnFilter(filter: ColumnFilter): ColumnFilter {
  if (filter.type !== "id-list") {
    return filter
  }

  const payload = filter.payload as Partial<IdListFilterPayload>

  if (!Array.isArray(payload.ids)) {
    return filter
  }

  return {
    id: filter.id,
    type: "text-list",
    payload: {
      mode: payload.mode === "exclude" ? "exclude" : "include",
      values: payload.ids,
    },
  }
}

function replayBackendTableState(snapshot: BackendTableStateSnapshot): PersistedTableState {
  const { query, presentation } = snapshot
  return {
    showColumnHeaders: presentation.showColumnHeaders,
    stickyColumnsCount: presentation.stickyColumnsCount,
    showHorizontalLines: presentation.showHorizontalLines,
    showVerticalLines: presentation.showVerticalLines,
    showEmptyGroups: query.grouping?.showEmptyGroups ?? false,
    showOrderingBadge: presentation.showOrderingBadge,
    columnOrder: presentation.columnOrder,
    columnVisibility: presentation.columnVisibility,
    columnWidths: presentation.columnWidths,
    sorting: query.sorting,
    grouping: query.grouping?.columns ?? [],
    groupingOrder: {},
    groupExpanded: replayExpandedState(query.grouping?.expansion),
    globalFilter: query.globalFilter,
    columnFilters: query.filters.map(normalizeLegacyColumnFilter),
    filterMode: query.filterMode,
    queryOptions: query.options ?? {},
    activeViewId: presentation.activeViewId,
  }
}

export function replaySavedViewState(snapshot: DatatableViewState): PersistedTableState {
  return replayBackendTableState(snapshot)
}

export function replayPersistedTableState(
  snapshot: PersistedTableStateSnapshot,
): PersistedTableState {
  return replayBackendTableState(snapshot)
}

export function replayQueryState(state: BackendTableStateSnapshot): BackendQueryState {
  return state.query
}
