/**
 * Renderable Row Types
 *
 * These types represent the view layer for row grouping.
 * Unlike the previous approach (synthetic TanStack Row objects), these types are:
 * - Pure domain types (no TanStack coupling)
 * - Type-safe (no assertions needed)
 * - Framework-agnostic (testable without React)
 *
 * Architecture:
 * Data Layer (TanStack) → Pure Transformation → View Layer (React Components)
 */

/**
 * Represents a data row in the renderable list
 * Points back to TanStack Row via rowId for full API access
 */
export interface RenderableDataRow<TData> {
  type: "data"
  rowId: string // TanStack Row ID - use table.getRow(rowId) to get full Row API
  data: TData // Direct reference to original data for quick access
  dataIndex?: number // Absolute data-row index in windowed infinite online mode
  groupPath: string[] // Breadcrumb of group IDs this row belongs to, e.g., ['status:active', 'priority:high']
}

/**
 * Represents an unloaded online row slot in a windowed infinite result set.
 *
 * The slot keeps scroll height and row indexes stable while its page is being
 * fetched. It is replaced by a data row when the corresponding offset loads.
 */
export interface RenderableLoadingRow {
  type: "loading"
  rowId: string
  dataIndex: number
  groupPath: string[]
}

/**
 * Represents a group header in the renderable list
 * Contains all data needed to render the header without Row API
 */
export interface RenderableGroupHeader {
  type: "group-header"
  groupId: string // Unique ID for this group (for expansion state)
  columnId: string // Which column this group is for
  value: string // The group value to display
  depth: number // Nesting level (0 = primary, 1 = secondary)
  count: number // Number of data rows in this group (before sub-grouping)
  isExpanded: boolean // Current expansion state
  groupPath: string[] // Breadcrumb of parent group IDs
}

/**
 * Discriminated union of renderable row types
 * Enables type-safe rendering with exhaustive switch checks
 */
export type RenderableRow<TData> =
  | RenderableDataRow<TData>
  | RenderableGroupHeader
  | RenderableLoadingRow

/**
 * Info passed to custom group header renderer
 *
 * Allows per-column customization of group header appearance.
 * The custom renderer receives all necessary data to render the group header
 * without needing access to TanStack Row objects.
 *
 * The renderer can check `depth` to render differently for:
 * - depth 0: Primary groups (top-level grouping)
 * - depth 1: Subgroups (nested within primary groups)
 *
 * The returned node represents the semantic leading content of the group row.
 * The grid renderer owns any pane continuation needed for frozen-column layouts.
 *
 * Example:
 * ```typescript
 * renderRowGroupHeader: ({ groupValue, count, depth, isExpanded, isActive, toggle }) => (
 *   <button
 *     type="button"
 *     onClick={toggle}
 *     className={depth === 0 ? "text-lg font-bold" : "text-sm pl-6"}
 *   >
 *     {isExpanded ? <ChevronDown /> : <ChevronRight />}
 *     <Badge>{groupValue}</Badge>
 *     <span>({count})</span>
 *   </button>
 * )
 * ```
 */
export interface GroupHeaderRenderInfo {
  /** Unique ID for this group (used for expansion state) */
  groupId: string

  /** Column ID being grouped by */
  columnId: string

  /** The value to display (e.g., "Active", "John Doe") */
  groupValue: string

  /** Number of rows in this group */
  count: number

  /** Nesting level: 0 = primary group, 1 = subgroup */
  depth: number

  /** Current expansion state of this group */
  isExpanded: boolean

  /** Whether this group header is the current active keyboard item */
  isActive: boolean

  /** Whether this group may currently be expanded/collapsed */
  isExpandable: boolean

  /** Toggle expansion state for this group */
  toggle: () => void
}

import type { ResolvedGroupingValue } from "../features/grouping/grouping-model"

/**
 * Configuration for building renderable rows
 */
export interface GroupingConfig<TData> {
  // Column IDs to group by, in order
  groupByColumns: string[]

  // Function to extract grouping value from data
  getGroupValue: (
    columnId: string,
    data: TData,
  ) => ResolvedGroupingValue | ResolvedGroupingValue[] | string | string[] | null | undefined

  // Optional finite domain for rendering zero-count groups
  getGroupDomain?: (columnId: string) => ResolvedGroupingValue[] | undefined

  // Optional exact count source for partially loaded cursor streams
  getGroupCount?: (groupId: string) => number | undefined

  // Whether groups from getGroupDomain should be shown even when they have no rows
  showEmptyGroups?: boolean

  // Set of expanded group IDs
  expandedGroups: Set<string>

  // Optional custom sort for group values
  sortGroupValues?: (columnId: string, a: string, b: string) => number

  // Optional manual ordering for group values
  manualOrder?: Record<string, Record<string, number>>

  // Function to get TanStack row ID from data
  getRowId: (data: TData, index: number) => string
}
