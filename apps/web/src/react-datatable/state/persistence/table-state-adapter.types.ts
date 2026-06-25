/**
 * Table State Persistence Adapter Interface
 *
 * Defines the contract for table state persistence adapters.
 * Adapters can use localStorage, sessionStorage, tRPC, or any other backend.
 *
 * This abstraction allows us to:
 * - Start with localStorage for testing
 * - Swap to tRPC backend without changing hook logic
 * - Easily add new adapter types (e.g., IndexedDB)
 */

import { z } from "zod"
import type { DatatableState } from "../../types/state.types"
import type { PersistedTableStateSnapshot as PersistedTableStateSnapshotType } from "../lifecycle/table-state-snapshot"

/**
 * Subset of DatatableState that should be persisted
 *
 * Includes user preferences and current filter/search state.
 *
 * Excludes only transient state like:
 * - rowSelection (session-only)
 * - expanded (session-only, except groupExpanded which IS persisted)
 */
export interface PersistedTableState {
  // Display
  showColumnHeaders: boolean
  stickyColumnsCount: number
  showHorizontalLines: boolean
  showVerticalLines: boolean
  showEmptyGroups: boolean
  showOrderingBadge: boolean

  // Layout
  columnOrder: string[]
  columnVisibility: Record<string, boolean>
  columnWidths: Record<string, number>

  // Sorting
  sorting: DatatableState["sorting"]

  // Grouping
  grouping: string[]
  groupingOrder: Record<string, Record<string, number>>
  groupExpanded: DatatableState["groupExpanded"]

  // Search & Filters (now persisted!)
  globalFilter: string
  columnFilters: DatatableState["columnFilters"]
  filterMode: DatatableState["filterMode"]
  queryOptions: DatatableState["queryOptions"]

  // Active View (persisted only when explicitly selected by user)
  activeViewId?: string | null
}

/**
 * Table state adapter configuration
 */
export interface TableStateAdapterConfig {
  /**
   * Workspace ID (optional - some adapters might not need it)
   */
  workspaceId?: string

  /**
   * Table key (e.g., "contacts", "deals")
   * Used to scope preferences per table
   */
  tableKey: string

  /**
   * User ID (optional - inferred from context in most cases)
   */
  userId?: string
}

/**
 * Zod schema for PersistedTableState
 * Used to validate state when reading/writing from storage
 */
export const persistedTableStateSchema = z.object({
  showColumnHeaders: z.boolean(),
  stickyColumnsCount: z.number(),
  showHorizontalLines: z.boolean().optional().default(false),
  showVerticalLines: z.boolean().optional().default(false),
  showEmptyGroups: z.boolean().optional().default(false),
  showOrderingBadge: z.boolean().optional().default(true),
  columnOrder: z.array(z.string()),
  columnVisibility: z.record(z.string(), z.boolean()),
  columnWidths: z.record(z.string(), z.number()),
  sorting: z.array(
    z.object({
      id: z.string(),
      desc: z.boolean(),
    }),
  ),
  grouping: z.array(z.string()),
  groupingOrder: z.record(z.string(), z.record(z.string(), z.number())),
  groupExpanded: z.union([z.boolean(), z.record(z.string(), z.boolean())]),
  globalFilter: z.string(),
  // ColumnFilter type: {id: string, type: FilterType, payload: FilterPayload}
  // We use z.any() for payload since it's a union of many complex filter payload types
  columnFilters: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["text", "number", "date", "boolean", "text-list", "id-list", "custom"]),
      payload: z.any(), // FilterPayload is a complex union type
    }),
  ),
  filterMode: z.enum(["AND", "OR"]),
  queryOptions: z
    .record(z.string(), z.union([z.boolean(), z.string(), z.number(), z.null()]))
    .optional()
    .default({}),
  activeViewId: z.string().nullable().optional(),
})

/**
 * Adapter interface
 *
 * All adapters must implement these methods
 */
export interface TableStateAdapter {
  /**
   * Get saved state from storage
   * Returns null if no state exists
   */
  get(config: TableStateAdapterConfig): Promise<PersistedTableStateSnapshot | null>

  /**
   * Save state to storage
   * Creates or updates existing state
   */
  set(config: TableStateAdapterConfig, state: PersistedTableStateSnapshot): Promise<void>

  /**
   * Delete saved state
   * Useful for "reset to defaults"
   */
  delete(config: TableStateAdapterConfig): Promise<void>
}

/**
 * Helper to extract persistable state from full DatatableState
 */
export function extractPersistedState(state: DatatableState): PersistedTableState {
  return {
    showColumnHeaders: state.showColumnHeaders,
    stickyColumnsCount: state.stickyColumnsCount,
    showHorizontalLines: state.showHorizontalLines,
    showVerticalLines: state.showVerticalLines,
    showEmptyGroups: state.showEmptyGroups,
    showOrderingBadge: state.showOrderingBadge,
    columnOrder: state.columnOrder,
    columnVisibility: state.columnVisibility,
    columnWidths: state.columnWidths,
    sorting: state.sorting,
    grouping: state.grouping,
    groupingOrder: state.groupingOrder,
    groupExpanded: state.groupExpanded,
    globalFilter: state.globalFilter,
    columnFilters: state.columnFilters,
    filterMode: state.filterMode,
    queryOptions: state.queryOptions,
    activeViewId: state.activeViewId,
  }
}

export type PersistedTableStateSnapshot = PersistedTableStateSnapshotType
