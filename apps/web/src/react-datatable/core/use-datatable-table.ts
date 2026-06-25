import {
  type ColumnDef,
  type ColumnSizingState,
  type FilterFn,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  type OnChangeFn,
  useReactTable,
} from "@tanstack/react-table"
import { useCallback, useEffect, useMemo, useState } from "react"
import { filterFunctions } from "../features/filters/filter-functions"
import { getFilteredRowModelWithMode } from "../features/filters/get-filtered-row-model-with-mode"
import { isGroupingSupportedForMode } from "../features/grouping/grouping-model"
import { useDatatableStore } from "../state/store/use-datatable-store"
import type { DatatableColumn } from "../types/column.types"
import {
  getColumnMaxWidth,
  getColumnMinWidth,
  resolveColumnWidth,
} from "./column-sizing/column-width"
import { useCoordinatorReady } from "./DatatableProvider"

/**
 * Resolves the appropriate filter function for a column
 *
 * Priority:
 * 1. Column-specific filterType (e.g., textFilterFn for "text" columns)
 * 2. Global filter function (for simple string search)
 * 3. Undefined (column doesn't support filtering)
 */
function resolveFilterFn<TData>(
  col: DatatableColumn<TData>,
  globalFilterFn: FilterFn<TData>,
): FilterFn<TData> | undefined {
  if (col.filterType && col.filterType in filterFunctions) {
    return filterFunctions[col.filterType as keyof typeof filterFunctions] as FilterFn<TData>
  }
  if (col.enableGlobalFilter !== false) {
    return globalFilterFn
  }
  return undefined
}

/**
 * Resolves the appropriate sorting function for a column
 *
 * Priority:
 * 1. User-specified sortingFn
 * 2. Auto-mapped based on filterType
 * 3. "auto" (TanStack Table auto-detects)
 */
function resolveSortingFn<TData>(col: DatatableColumn<TData>): ColumnDef<TData>["sortingFn"] {
  // User-specified takes precedence
  if (col.sortingFn) {
    return col.sortingFn
  }

  // Auto-map based on filterType
  switch (col.filterType) {
    case "date":
      return "datetime"
    case "number":
      return "basic"
    case "text":
      return "text"
    default:
      return "auto"
  }
}

/**
 * Hook to create TanStack Table instance
 * Integrates with Zustand store for state management
 *
 * Filtering Architecture:
 * Uses a custom getFilteredRowModel that supports AND/OR filter modes.
 * The custom row model respects our filterMode state directly, allowing
 * OR mode to show rows that match ANY filter instead of ALL filters.
 *
 * Online Mode:
 * When isOnlineMode=true, enables manual filtering/sorting/pagination.
 * This tells TanStack Table to skip client-side processing since the
 * server handles it. Filter/sort state is still tracked for UI purposes
 * (filter chips, sort indicators).
 *
 * See: features/filters/get-filtered-row-model-with-mode.ts
 */
export function useDatatableTable<TData>(
  data: TData[],
  columns: DatatableColumn<TData>[],
  getRowId?: (row: TData) => string,
  getGlobalSearchText?: (row: TData) => string | null | undefined,
  enableColumnResizing: boolean = true,
  columnResizeMode: "onChange" | "onEnd" = "onChange",
  _viewColumnsButton?: boolean | { show?: boolean; width?: number },
  isOnlineMode: boolean = false,
) {
  // Get coordinator ready state
  const isCoordinatorReady = useCoordinatorReady()

  // Subscribe to relevant store state
  const sorting = useDatatableStore((s) => s.sorting)
  const setSorting = useDatatableStore((s) => s.setSorting)
  const columnVisibility = useDatatableStore((s) => s.columnVisibility)
  const setColumnVisibility = useDatatableStore((s) => s.setColumnVisibility)
  const globalFilter = useDatatableStore((s) => s.globalFilter)
  const setGlobalFilter = useDatatableStore((s) => s.setGlobalFilter)
  const columnFilters = useDatatableStore((s) => s.columnFilters)
  const filterMode = useDatatableStore((s) => s.filterMode)
  const columnWidths = useDatatableStore((s) => s.columnWidths)
  const columnOrder = useDatatableStore((s) => s.columnOrder)
  const setColumnOrder = useDatatableStore((s) => s.setColumnOrder)
  const stickyColumnsCount = useDatatableStore((s) => s.stickyColumnsCount)
  const expanded = useDatatableStore((s) => s.expanded)
  const setState = useDatatableStore((s) => s.setState)

  // Convert our ColumnFilter[] to TanStack's ColumnFiltersState
  // Our format: { id, type, payload }
  // TanStack format: { id, value }
  const tanstackColumnFilters = useMemo(
    () => columnFilters.map((f) => ({ id: f.id, value: f.payload })),
    [columnFilters],
  )

  // Local state for live column resizing (not connected to Zustand during drag)
  // This prevents re-renders while dragging - CSS variables handle visual updates
  const [localColumnSizing, setLocalColumnSizing] = useState<ColumnSizingState>(() => {
    // Initialize from both store (user resizes) AND column definitions (defaults)
    const sizing: ColumnSizingState = {}

    // First, set default widths from column definitions
    columns.forEach((col) => {
      if (col.width) {
        sizing[col.id] = col.width
      }
    })

    // Then override with user-resized widths from store
    Object.entries(columnWidths).forEach(([columnId, width]) => {
      sizing[columnId] = width
    })

    return sizing
  })

  // Update local state during resize (doesn't trigger Zustand updates)
  const handleColumnSizingChange: OnChangeFn<ColumnSizingState> = (updaterOrValue) => {
    const newValue =
      typeof updaterOrValue === "function" ? updaterOrValue(localColumnSizing) : updaterOrValue

    setLocalColumnSizing(newValue)
  }

  // Global filter function - searches across all columns
  // CRITICAL: Must memoize to prevent infinite re-renders
  const globalFilterFn = useCallback<FilterFn<TData>>(
    (row, columnId, filterValue) => {
      if (!filterValue) {
        return true
      }

      const searchValue = String(filterValue).toLowerCase()
      const rowSearchText = getGlobalSearchText?.(row.original)

      if (rowSearchText?.toLowerCase().includes(searchValue)) {
        return true
      }

      const cellValue = row.getValue(columnId)

      if (cellValue == null) {
        return false
      }

      return String(cellValue).toLowerCase().includes(searchValue)
    },
    [getGlobalSearchText],
  )

  // Convert our column format to TanStack format
  const tableColumns = useMemo<ColumnDef<TData>[]>(() => {
    let cumulativeStickyWidth = 0

    // Build columns in columnOrder sequence (render order, not definition order)
    // This ensures sticky columns are determined by visual position after drag-and-drop
    // Fallback to definition order when columnOrder is empty (initial render before persistence)
    const resolvedColumnOrder = resolveDatatableColumnOrder(
      columns.map((column) => column.id),
      columnOrder,
    )
    const columnsById = new Map(columns.map((column) => [column.id, column]))
    const orderedColumns = resolvedColumnOrder
      .map((id) => columnsById.get(id))
      .filter((col): col is DatatableColumn<TData> => col !== undefined)

    const userColumns = orderedColumns.map((col, index) => {
      // Keep column definitions stable during drag.
      // Live resize width comes from table state/viewport math, not rebuilt column defs.
      const resolvedWidth = resolveColumnWidth(col, columnWidths[col.id])
      const minWidth = getColumnMinWidth(col)
      const maxWidth = getColumnMaxWidth(col)

      // Calculate sticky column metadata using visual position (index in columnOrder)
      const isSticky = index < stickyColumnsCount
      const isLastStickyColumn = isSticky && index === stickyColumnsCount - 1
      const stickyLeftOffset = isSticky ? cumulativeStickyWidth : undefined

      // Accumulate width for next sticky column
      if (isSticky) {
        cumulativeStickyWidth += resolvedWidth
      }

      // Build column definition with proper typing
      // Use accessorKey OR accessorFn (not both) to avoid conflicts
      const isGroupingEnabledForMode =
        (col.enableGrouping ?? false) &&
        isGroupingSupportedForMode(col.groupingSpec, isOnlineMode ? "online" : "offline")

      const baseColumn = {
        id: col.id,
        header: col.header,
        enableSorting: col.enableSorting ?? true,
        enableResizing: col.resizable ?? true,
        enableGrouping: isGroupingEnabledForMode,
        sortingFn: resolveSortingFn(col),
        cell: col.cell,
        size: resolvedWidth,
        minSize: minWidth,
        maxSize: maxWidth,
        // Register filter function based on filterType
        enableColumnFilter: col.enableFiltering ?? true,
        enableGlobalFilter: col.enableGlobalFilter ?? true,
        filterFn: resolveFilterFn(col, globalFilterFn),
        meta: {
          ...col.meta,
          width: resolvedWidth,
          showSortInHeader: col.showSortInHeader,
          isSticky,
          isLastStickyColumn,
          stickyLeftOffset,
          filterType: col.filterType, // For HeaderActionMenu sort labels
          filterOptions: col.filterOptions,
          groupingSpec: col.groupingSpec,
        },
      }

      if (col.accessorKey) {
        return {
          ...baseColumn,
          accessorKey: col.accessorKey as string,
        } as ColumnDef<TData>
      } else {
        return {
          ...baseColumn,
          accessorFn: col.accessorFn,
        } as ColumnDef<TData>
      }
    })

    return userColumns
  }, [columns, columnWidths, columnOrder, globalFilterFn, stickyColumnsCount, isOnlineMode])

  // Initialize or reconcile columnOrder AFTER coordinator finishes. Persisted table state can
  // outlive domain column changes, so newly added columns must be appended instead of hidden.
  useEffect(() => {
    if (!isCoordinatorReady) {
      return
    }

    const nextColumnOrder = resolveDatatableColumnOrder(
      columns.map((column) => column.id),
      columnOrder,
    )
    const columnOrderChanged =
      nextColumnOrder.length !== columnOrder.length ||
      nextColumnOrder.some((columnId, index) => columnId !== columnOrder[index])

    if (columnOrderChanged) {
      setColumnOrder(nextColumnOrder)
    }
  }, [isCoordinatorReady, columnOrder, columns, setColumnOrder])

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      columnVisibility,
      globalFilter,
      columnFilters: tanstackColumnFilters,
      columnSizing: localColumnSizing,
      columnOrder, // Column order for drag & drop reordering
      filterMode, // Custom state passed to row model
      expanded, // TanStack's native expanded state (available for future features)
    },
    onSortingChange: (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === "function" ? updaterOrValue(sorting) : updaterOrValue
      setSorting(newValue)
    },
    onColumnVisibilityChange: (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === "function" ? updaterOrValue(columnVisibility) : updaterOrValue
      setColumnVisibility(newValue)
    },
    onGlobalFilterChange: (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === "function" ? updaterOrValue(globalFilter) : updaterOrValue
      setGlobalFilter(newValue)
    },
    onExpandedChange: (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === "function" ? updaterOrValue(expanded) : updaterOrValue
      setState({ expanded: newValue })
    },
    onColumnSizingChange: handleColumnSizingChange,
    onColumnOrderChange: (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === "function" ? updaterOrValue(columnOrder) : updaterOrValue
      setColumnOrder(newValue)
    },

    // Global filter function - searches across all columns
    globalFilterFn,

    // Column sizing configuration
    columnResizeMode,
    columnResizeDirection: "ltr",
    enableColumnResizing,

    // NOTE: Row grouping is now handled at the view layer (useRenderableRows hook)
    // No need for TanStack Table features or custom row model transformations
    enableGrouping: false,

    // Online mode: Skip client-side processing (server handles it)
    // State is still tracked for UI (filter chips, sort indicators)
    manualFiltering: isOnlineMode,
    manualSorting: isOnlineMode,
    manualPagination: isOnlineMode,

    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModelWithMode(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowId: getRowId,
  })

  // Sync localColumnSizing with columnWidths when store updates.
  useEffect(() => {
    setLocalColumnSizing((prev) => {
      const newSizing = { ...prev }

      columns.forEach((col) => {
        if (col.width && !columnWidths[col.id]) {
          newSizing[col.id] = col.width
        }
      })

      Object.entries(columnWidths).forEach(([id, width]) => {
        newSizing[id] = width
      })

      return newSizing
    })
  }, [columnWidths, columns])

  return { table, setLocalColumnSizing }
}

export function resolveDatatableColumnOrder(
  definedColumnIds: readonly string[],
  persistedColumnOrder: readonly string[],
) {
  if (definedColumnIds.length === 0) return []

  const definedColumnIdSet = new Set(definedColumnIds)
  const resolvedColumnIds = persistedColumnOrder.filter((columnId) =>
    definedColumnIdSet.has(columnId),
  )
  const persistedColumnIdSet = new Set(resolvedColumnIds)

  for (const columnId of definedColumnIds) {
    if (!persistedColumnIdSet.has(columnId)) {
      resolvedColumnIds.push(columnId)
    }
  }

  return resolvedColumnIds
}
