import type { FilterPayloadMap, FilterType } from "../../types/filter.types"
import type { DatatableState } from "../../types/state.types"

/**
 * Store actions interface
 * Actions will be extended in future issues
 */
export interface DatatableActions {
  // State management
  setState: (state: Partial<DatatableState>) => void
  resetState: () => void

  // Search & Filter
  setGlobalFilter: (filter: string) => void
  setColumnFilters: (filters: DatatableState["columnFilters"]) => void
  setQueryOption: (key: string, value: DatatableState["queryOptions"][string]) => void
  setQueryOptions: (options: DatatableState["queryOptions"]) => void
  resetQueryOptions: () => void

  // Column Filter Actions
  /**
   * Set a column filter with type-safe payload
   * @param columnId - The column ID to filter
   * @param filterType - The type of filter (text, number, date, etc.)
   * @param payload - The filter payload (must match filterType)
   *
   * Example:
   * setColumnFilter("email", "text", { conditions: [{ mode: "contains", value: "john" }], operator: "AND" })
   */
  setColumnFilter: <T extends FilterType>(
    columnId: string,
    filterType: T,
    payload: FilterPayloadMap[T] | null,
  ) => void
  removeColumnFilter: (columnId: string) => void
  clearAllFilters: () => void
  toggleFilterMode: () => void // Toggle between AND/OR (cross-column filters)

  // Sorting
  setSorting: (sorting: DatatableState["sorting"]) => void
  toggleColumnSort: (columnId: string, multi?: boolean) => void
  toggleSortDirection: (columnId: string) => void // Toggle between asc/desc only (no unsorted)
  reorderSorting: (newOrder: DatatableState["sorting"]) => void // Reorder sort columns (for drag & drop)

  // Column management
  setColumnVisibility: (visibility: DatatableState["columnVisibility"]) => void
  toggleColumnVisibility: (columnId: string) => void
  resetColumnVisibility: () => void
  setColumnWidths: (widths: DatatableState["columnWidths"]) => void
  setColumnOrder: (order: string[]) => void
  reorderColumns: (fromIndex: number, toIndex: number) => void
  resetColumnOrder: () => void

  // Selection
  setRowSelection: (selection: DatatableState["rowSelection"]) => void
  toggleRowSelection: (rowId: string) => void
  setRowSelectionRange: (params: { anchorRowId: string | null; rowIds: string[] }) => void
  selectAllMatching: (params: {
    query: {
      limit: number
      filters: DatatableState["columnFilters"]
      sorting: DatatableState["sorting"]
      globalFilter: string
      grouping?: { columns: string[]; showEmptyGroups?: boolean }
    }
    totalMatchingRows: number
  }) => void
  selectAll: () => void
  deselectAll: () => void
  setActiveRow: (rowId: string | null) => void
  setPreviewRow: (rowId: string | null, anchorPoint?: DatatableState["previewAnchorPoint"]) => void

  // Column width management
  setColumnWidth: (columnId: string, width: number) => void
  resetColumnWidths: () => void

  // Grouping
  setGrouping: (grouping: string[]) => void
  setGroupingOrder: (order: Record<string, Record<string, number>>) => void
  resetGrouping: () => void

  // Group Expansion - custom expansion state for row grouping
  setGroupExpanded: (expanded: DatatableState["groupExpanded"]) => void
  toggleGroupExpanded: (groupId: string) => void
  resetGroupExpanded: () => void

  // Sticky columns
  setStickyColumnsCount: (count: number) => void

  // Grid lines
  setShowHorizontalLines: (show: boolean) => void
  setShowVerticalLines: (show: boolean) => void
  setShowEmptyGroups: (show: boolean) => void
  setShowOrderingBadge: (show: boolean) => void

  // Display options reset
  resetDisplayOptions: () => void

  // Saved Views
  setActiveViewId: (viewId: string | null) => void
}

/**
 * Complete store interface
 */
export type DatatableStore = DatatableState & DatatableActions
