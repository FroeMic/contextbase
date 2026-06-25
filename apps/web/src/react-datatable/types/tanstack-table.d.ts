import "@tanstack/react-table"
import type { GroupHeaderRenderInfo } from "./renderable-row.types"
import type { FilterOptions } from "./filter.types"
import type { ColumnGroupingSpec } from "../features/grouping/grouping-model"

/**
 * Module augmentation for TanStack Table
 * Extends ColumnMeta, TableState, and other interfaces to include our custom properties
 */
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Display name for filters and display options */
    displayName?: string
    /** Name shown in filter dropdown */
    filterName?: string
    /** Custom icon for filter dropdown */
    filterIcon?: React.ComponentType<{ className?: string }>
    /** Column width in pixels */
    width?: number
    /** Show sort icon in header (default: true if enableSorting !== false) */
    showSortInHeader?: boolean
    /** Whether this is a spacer column (absorbs remaining width) */
    isSpacer?: boolean
    /** Whether this column is sticky (frozen) */
    isSticky?: boolean
    /** Left offset in pixels for sticky positioning */
    stickyLeftOffset?: number

    // Row Grouping properties
    /** Enable/disable row grouping for this column */
    enableRowGrouping?: boolean
    /** Function to extract grouping value from data */
    getRowGroupingValue?: (row: TData) => string | string[] | null | undefined
    /** Custom sort function for group keys */
    sortRowGroupingValues?: (a: string, b: string) => number
    /**
     * Custom renderer for the semantic group-header content.
     * In frozen-column mode this content is rendered only in the semantic pane;
     * the scrollable pane draws the visual continuation separately.
     *
     * The renderer receives group metadata plus expansion helpers. It does not
     * own pane splitting, scroll behavior, borders, or accessibility semantics
     * outside the returned content.
     */
    renderRowGroupHeader?: (info: GroupHeaderRenderInfo) => React.ReactNode
    /** Shared grouping semantics for offline and online mode */
    groupingSpec?: ColumnGroupingSpec
    /** Filter options can also define a finite group domain for empty groups */
    filterOptions?: FilterOptions
  }

  interface TableState {
    /** Filter mode for combining multiple column filters (AND/OR) */
    filterMode?: "AND" | "OR"
  }
}
