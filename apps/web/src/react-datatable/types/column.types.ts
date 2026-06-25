import type { ColumnDef } from "@tanstack/react-table"
import type { ColumnGroupingSpec } from "../features/grouping/grouping-model"
import type { FilterOptions, FilterType } from "./filter.types"

/**
 * Simplified column configuration that extends TanStack Table
 * Follows the data-table pattern, not the complex datatable-ark pattern
 */
export interface DatatableColumn<TData, TValue = unknown> {
  // Identity
  id: string

  // Display
  header: string
  order?: number
  defaultVisible?: boolean

  // Width (required for virtualization in future issues)
  width?: number
  minWidth?: number
  maxWidth?: number
  resizable?: boolean

  // Data access - use TanStack's pattern
  accessorKey?: keyof TData
  accessorFn?: (row: TData) => TValue
  cell?: ColumnDef<TData, TValue>["cell"]

  // Sorting
  enableSorting?: boolean
  sortingFn?: ColumnDef<TData, TValue>["sortingFn"]
  showSortInHeader?: boolean // Show sort icon in header (default: true if enableSorting !== false)

  // Filtering
  enableFiltering?: boolean
  enableGlobalFilter?: boolean
  filterType?: FilterType // Determines which filter UI to show
  filterOptions?: FilterOptions // Configuration for filter UI (e.g., list options)

  // Grouping (added in later issues)
  enableGrouping?: boolean
  groupingSpec?: ColumnGroupingSpec

  // Meta (for extensibility)
  meta?: {
    displayName?: string
    filterName?: string
    filterIcon?: React.ComponentType<{ className?: string }> // Custom icon for filter dropdown
    [key: string]: unknown
  }
}

/**
 * Column metadata interface for runtime column properties
 * Used by TanStack Table's columnDef.meta
 */
export interface ColumnMetadata {
  /** Resolved column width in pixels */
  width?: number
  /** Whether to show sort indicator in header */
  showSortInHeader?: boolean
  /** Whether this column is sticky (frozen) */
  isSticky?: boolean
  /** Whether this is the rightmost sticky (frozen) column */
  isLastStickyColumn?: boolean
  /** Left offset in pixels for sticky positioning */
  stickyLeftOffset?: number
  /** Filter type for determining sort labels */
  filterType?: FilterType
  /** Whether this is a spacer column (absorbs remaining width) */
  isSpacer?: boolean
  /** Original user-defined metadata */
  [key: string]: unknown
}
