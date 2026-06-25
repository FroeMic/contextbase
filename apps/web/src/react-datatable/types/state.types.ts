import type { ExpandedState, SortingState, VisibilityState } from "@tanstack/react-table"
import type { ColumnFilter } from "./filter.types"
import type { OnlineQueryStateInput } from "./props.types"

// Re-export ColumnFilter for convenience
export type { ColumnFilter }

export type DatatableQueryOptionValue = boolean | string | number | null
export type DatatableQueryOptions = Record<string, DatatableQueryOptionValue>

export interface ExplicitRowSelectionState {
  kind: "explicit"
  ids: Record<string, true>
  rangeRowIds: Record<string, true>
  lastSingleSelectedRowId: string | null
}

export interface AllMatchingRowSelectionState {
  kind: "allMatching"
  query: OnlineQueryStateInput
  includedIds: Record<string, true>
  excludedIds: Record<string, true>
  lastSingleSelectedRowId: string | null
  totalMatchingRows: number
}

export type DatatableRowSelectionState = ExplicitRowSelectionState | AllMatchingRowSelectionState

export interface DatatablePointerAnchorPoint {
  x: number
  y: number
}

/**
 * Core datatable state interface
 * All state managed by Zustand store
 */
export interface DatatableState {
  // Display
  showColumnHeaders: boolean
  stickyColumnsCount: number // Number of columns to freeze from the left
  showHorizontalLines: boolean // Show horizontal grid lines between rows
  showVerticalLines: boolean // Show vertical grid lines between columns
  showEmptyGroups: boolean // Show zero-count groups when a finite group domain is known
  showOrderingBadge: boolean // Show active sorting in the applied-state bar

  // Search & Filter
  globalFilter: string
  columnFilters: ColumnFilter[] // Custom filter type
  filterMode: "AND" | "OR" // How to combine multiple column filters
  queryOptions: DatatableQueryOptions // Domain-specific query options persisted with saved views

  // Layout
  columnOrder: string[]
  columnVisibility: VisibilityState
  columnWidths: Record<string, number>

  // Sorting
  sorting: SortingState

  // Transient row interaction state
  rowSelection: DatatableRowSelectionState
  activeRowId: string | null
  previewRowId: string | null
  previewAnchorPoint: DatatablePointerAnchorPoint | null

  // Expansion (TanStack native - for future use with nested rows, detail panels, etc.)
  expanded: ExpandedState

  // Row Grouping
  // Note: Named "rowGrouping" to avoid collision with TanStack's native column grouping feature
  grouping: string[] // Column IDs to group by, in order
  groupingOrder: Record<string, Record<string, number>> // Manual ordering for group values
  groupExpanded: ExpandedState // Custom expansion state for row grouping (separate from TanStack's expanded)

  // Saved Views
  activeViewId: string | null // ID of the currently applied saved view (null if no view is active)
}

/**
 * Default state values
 */
export const defaultDatatableState: DatatableState = {
  showColumnHeaders: true,
  stickyColumnsCount: 0, // No frozen columns by default
  showHorizontalLines: false, // Hide horizontal lines by default
  showVerticalLines: false, // Hide vertical lines by default
  showEmptyGroups: false, // Hide empty groups by default
  showOrderingBadge: true, // Show active sorting in the applied-state bar by default
  globalFilter: "",
  columnFilters: [],
  filterMode: "AND",
  queryOptions: {},
  columnOrder: [],
  columnVisibility: {},
  columnWidths: {},
  sorting: [],
  rowSelection: {
    kind: "explicit",
    ids: {},
    rangeRowIds: {},
    lastSingleSelectedRowId: null,
  },
  activeRowId: null,
  previewRowId: null,
  previewAnchorPoint: null,
  expanded: {}, // TanStack's native expanded state (available for future features)
  grouping: [], // Note: This maps to rowGrouping in TanStack state
  groupingOrder: {}, // Note: This maps to rowGroupingOrder in TanStack state
  groupExpanded: true, // Default to all groups expanded
  activeViewId: null, // No saved view active by default
}
