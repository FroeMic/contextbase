import type { SortingState } from "@tanstack/react-table"
import type { ReactNode } from "react"
import type { RenderedRowRange } from "../core/loading/range-loader"
import type { ViewportRenderMode } from "../core/viewport/viewport.types"
import type { ColumnVisibilityUIConfig } from "../features/column-visibility/column-visibility-presentation"
import type { DatatableRuntimeRestorationConfig } from "../state/lifecycle/runtime-restoration"
import type { TableStateAdapter } from "../state/persistence/table-state-adapter.types"
import type {
  DatatableView,
  DatatableViewAdapter,
} from "../state/saved-views/datatable-view-adapter.types"
import type { UseDatatableUrlOptions } from "../state/url-sync/use-datatable-url"
import type { DatatableColumn } from "./column.types"
import type { RenderableGroupHeader } from "./renderable-row.types"
import type { ColumnFilter, DatatableQueryOptions, DatatableState } from "./state.types"

export type OnlineNavigationMode = "infinite" | "pagination"

/**
 * Grouping options that affect the rendered row model.
 */
export interface OnlineGroupExpansionInput {
  /** Whether groups default to expanded when no per-group override exists. */
  defaultExpanded: boolean

  /** Sparse expansion overrides keyed by stable group identity/path. */
  overrides: Record<string, boolean>
}

export interface OnlineGroupingConfig {
  /** Group by these columns in order. Supports primary grouping and subgrouping. */
  columns: string[]

  /** Include zero-count groups when the backend knows a finite group domain. */
  showEmptyGroups?: boolean

  /** Explicit expansion/collapse state for groups and subgroups in online mode. */
  expansion?: OnlineGroupExpansionInput
}

/**
 * Shared state passed to online-mode query functions.
 *
 * This is the filter/sort/search contract between Datatable and the
 * consuming API layer. Navigation-specific fields are layered on top via
 * `InfiniteOnlineQueryInput` and `PaginationOnlineQueryInput`.
 */
export interface OnlineQueryStateInput {
  /** Number of items to fetch per request */
  limit: number

  /** Column filters in Datatable internal format */
  filters: ColumnFilter[]

  /** Sorting state in TanStack Table format */
  sorting: SortingState

  /** Global search/filter string (from QuickSearch) */
  globalFilter: string

  /** Grouping configuration for server-side row shaping. */
  grouping?: OnlineGroupingConfig
}

export interface DatatableExternalQueryState extends OnlineQueryStateInput {
  queryOptions: DatatableQueryOptions
}

/**
 * Input passed to the query function when online mode is configured for infinite loading.
 *
 * This mode uses data-row offsets so the table can load the visible window and
 * nearby rows without sequentially loading every earlier page first.
 *
 * @example
 * ```typescript
 * const query = async (input: InfiniteOnlineQueryInput) => {
 *   return trpc.contact.listOnline.query({
 *     offset: input.offset,
 *     limit: input.limit,
 *     filters: input.filters,
 *     sorting: input.sorting,
 *     globalFilter: input.globalFilter,
 *     grouping: input.grouping,
 *   })
 * }
 * ```
 */
export interface InfiniteOnlineQueryInput extends OnlineQueryStateInput {
  mode: "infinite"

  /** Data-row offset (0-based, number of matching records to skip) */
  offset: number
}

/**
 * Input passed to the query function when online mode is configured for pagination.
 */
export interface PaginationOnlineQueryInput extends OnlineQueryStateInput {
  mode: "pagination"

  /** Zero-based current page index */
  pageIndex: number

  /** Pagination offset derived from pageIndex * limit */
  offset: number
}

/**
 * Navigation-specific query input for online mode.
 */
export type OnlineQueryInput = InfiniteOnlineQueryInput | PaginationOnlineQueryInput

/**
 * Group metadata returned by the server for grouped online mode.
 *
 * The keys are group IDs chosen by the server. For two-level grouping, subgroup
 * metadata can be nested under each primary group.
 */
export interface OnlineGroupingSummary {
  groups: Record<
    string,
    {
      total: number
      renderedRowCount: number
      subgroups?: Record<
        string,
        {
          total: number
          renderedRowCount: number
        }
      >
    }
  >
}

/**
 * Unified online render row model.
 *
 * This is the canonical row shape for server-driven online mode. Ungrouped
 * mode simply returns only `data` rows. Grouped online mode returns both
 * `group-header` and `data` rows in final render order.
 */
export type OnlineTableRow<TData> =
  | {
      type: "group-header"
      groupId: string
      columnId: string
      value: string
      depth: number
      count: number
      isExpanded?: boolean
      groupPath: string[]
    }
  | {
      type: "data"
      rowId: string
      item: TData
      /**
       * Absolute data-row index in infinite online mode.
       *
       * Grouped responses can omit rows for collapsed groups while still using
       * data-row offsets for fetching. When present, this preserves hydration
       * into the correct virtual row slot.
       */
      dataIndex?: number
      groupPath: string[]
    }

/**
 * Unified response shape for online table queries.
 *
 * @example
 * ```typescript
 * {
 *   rows: [
 *     { type: "group-header", groupId: "status:active", columnId: "status", value: "active", depth: 0, count: 842, groupPath: [] },
 *     { type: "data", rowId: "con_1", item: { id: "con_1", name: "John" }, groupPath: ["status:active"] }
 *   ],
 *   totalDataRows: 1523,
 *   totalRenderedRows: 1530,
 *   hasMore: true,
 *   grouping: {
 *     groups: {
 *       "status:active": {
 *         total: 842,
 *         renderedRowCount: 843
 *       }
 *     }
 *   },
 *   facets: {
 *     status: [
 *       { value: "active", count: 842 },
 *       { value: "inactive", count: 681 }
 *     ]
 *   }
 * }
 * ```
 */
export interface OnlineQueryResponse<TData> {
  /** Rows in final render order. Ungrouped mode returns only `data` rows. */
  rows: OnlineTableRow<TData>[]

  /** Total number of matching data records across the full result set. */
  totalDataRows: number

  /**
   * Total number of rendered rows across the full result set.
   *
   * This includes structural rows such as group headers and subgroup headers.
   */
  totalRenderedRows: number

  /** Whether there are more pages available */
  hasMore: boolean

  /** Group and subgroup counts for grouped online mode (optional). */
  grouping?: OnlineGroupingSummary

  /** Aggregated facet counts for filters (optional) */
  facets?: Record<string, Array<{ value: string; count: number }>>
}

export interface OnlineConfig<TData> {
  /** Navigation behavior for server-driven data */
  mode: OnlineNavigationMode

  /** Stable query identity for cache signatures, diagnostics, and refetch resets */
  queryKey: readonly unknown[]

  /**
   * Optional render-only version for live data sources that hydrate already
   * loaded rows out of band.
   *
   * This intentionally does not participate in query identity. Use it when the
   * row universe is unchanged, but visible row objects should be re-read by the
   * rendered row model.
   */
  liveDataVersion?: unknown

  /**
   * Columns the backend can group by in online mode.
   *
   * When provided, the datatable will sanitize persisted/URL grouping state so
   * unsupported grouping columns do not reach the server or remain selected in
   * the UI.
   */
  supportedGroupingColumns?: string[]

  /**
   * Query function for online mode.
   *
   * The datatable passes current filter/sort/search state plus the navigation
   * cursor for the configured mode.
   */
  query: (input: OnlineQueryInput) => Promise<OnlineQueryResponse<TData>>

  /**
   * Optional observer fired whenever a page response is read from the network
   * or restored from the online query cache.
   */
  onResponse?: (input: OnlineQueryInput, response: OnlineQueryResponse<TData>) => void

  /**
   * Optional first response for the initial online query.
   *
   * Useful when a route loader or parent component prefetches the first page
   * before the datatable mounts.
   */
  initialData?: OnlineQueryResponse<TData>

  /**
   * Query state that produced `initialData`.
   *
   * When provided, the datatable only seeds `initialData` if the current table
   * state still matches this query state. This prevents a route-prefetched
   * first page from being shown for persisted filters or shared URL state.
   */
  initialDataQueryState?: OnlineQueryStateInput

  /**
   * Number of items to fetch per request.
   * @default 50
   */
  pageSize?: number

  /**
   * Number of data rows to prefetch before and after the visible online range.
   *
   * This is separate from virtualization overscan: virtualization overscan
   * controls mounted DOM rows, while this controls how aggressively online
   * mode warms server pages ahead of fast scrolling.
   *
   * @default pageSize
   */
  prefetchRows?: number

  /**
   * Initial page for pagination mode.
   * Ignored in infinite mode.
   * @default 0
   */
  initialPageIndex?: number
}

export interface DatatableVirtualizationConfig {
  /**
   * Rendering policy for the grid viewport.
   *
   * - `viewport`: render only the visible rows/columns plus overscan
   * - `full`: render the full loaded row/column range through the same engine
   *
   * `full` is intended for bounded datasets or debugging/parity checks.
   * In online infinite mode it applies to the currently loaded window only.
   *
   * @default "viewport"
   */
  mode?: ViewportRenderMode

  /**
   * Optional row overscan override for `viewport` mode.
   * Ignored in `full` mode.
   *
   * Defaults render at least 32 rows beyond the viewport, and scale at 1.5x the
   * visible row count to reduce blank-cell flicker during fast scrolling.
   */
  rowOverscanCount?: number

  /**
   * Optional column overscan override for `viewport` mode.
   * Ignored in `full` mode.
   *
   * Defaults render at least 8 columns beyond the viewport, and scale at 1.5x the
   * visible column count to reduce horizontal scroll flicker.
   */
  columnOverscanCount?: number
}

export interface DatatableAppliedStateConfig {
  /**
   * Whether active sorting should render as a chip in the applied-state bar.
   *
   * Sorting can stay active while hidden from the user-facing chip row, which
   * is useful for product-shaped tables with implementation-level default
   * ordering.
   *
   * @default true
   */
  showSorting?: boolean

  /**
   * Whether active column filters should render as chips in the applied-state bar.
   *
   * @default true
   */
  showFilters?: boolean
}

export interface DatatableDisplayOptionsConfig {
  /**
   * Controls which sections appear in the display options popover.
   *
   * Disable sections when a product surface needs to keep some table behavior
   * fixed while still exposing other controls.
   */
  sections?: {
    grouping?: boolean
    ordering?: boolean
    freezeColumns?: boolean
    displaySettings?: boolean
    columnVisibility?: boolean
    queryOptions?: boolean
  }

  /**
   * Controls which individual display settings are exposed to users.
   *
   * The underlying state can still be set through `initialState`, persistence,
   * or saved views when a control is hidden.
   */
  controls?: {
    showEmptyGroups?: boolean
    showOrderingBadge?: boolean
  }

  /**
   * Domain-declared query options rendered by the generic display options UI.
   *
   * These options change the query row universe and are persisted in
   * `query.options`, not presentation state.
   */
  queryOptions?: DatatableQueryOptionDeclaration[]
}

export type DatatableQueryOptionDeclaration = {
  key: string
  label: string
  type: "boolean"
  defaultValue: boolean
  description?: string
}

export type DatatableQueryOptionValueMap = DatatableQueryOptions

export interface DatatableColumnReorderingConfig {
  /**
   * Whether dragged columns may cross the frozen/non-frozen boundary.
   * When disabled, drag targets are clamped to the source region.
   *
   * @default false
   */
  allowFrozenBoundaryCrossing?: boolean

  /**
   * Visual width behavior for the lifted drag overlay.
   *
   * - `none`: keep the source column width
   * - `snap`: switch to the current target slot width
   * - `interpolate`: animate width changes between slot widths
   *
   * @default "interpolate"
   */
  widthMorph?: "none" | "snap" | "interpolate"
}

export interface DatatableRowSelectionConfig<TData> {
  enabled: boolean
  mode?: "multi"
  showSelectionColumn?: boolean
  showCheckboxes?: boolean
  showCheckboxOnHover?: boolean
  maxSelectedRows?: number
  allowSelectAllMatching?: boolean
  getRowCanSelect?: (row: TData) => boolean
}

export interface DatatableRowPresentationConfig<TData> {
  getRowClassName?: (
    info:
      | {
          rowKind: "data"
          row: TData
          rowId: string
          isSelected: boolean
          isActive: boolean
          isPreviewOpen: boolean
        }
      | {
          rowKind: "group-header"
          rowId: string
          groupHeader: RenderableGroupHeader
          isSelected: false
          isActive: boolean
          isPreviewOpen: false
        },
  ) => string | undefined
  getCellClassName?: (info: {
    row: TData
    rowId: string
    columnId: string
    isSelected: boolean
    isActive: boolean
    isPreviewOpen: boolean
  }) => string | undefined
  getRowAttributes?: (
    info:
      | {
          rowKind: "data"
          row: TData
          rowId: string
          isSelected: boolean
          isActive: boolean
          isPreviewOpen: boolean
        }
      | {
          rowKind: "group-header"
          rowId: string
          groupHeader: RenderableGroupHeader
          isSelected: false
          isActive: boolean
          isPreviewOpen: false
        },
  ) => Record<string, unknown>
  getCellAttributes?: (info: {
    row: TData
    rowId: string
    columnId: string
    isSelected: boolean
    isActive: boolean
    isPreviewOpen: boolean
  }) => Record<string, unknown>
}

export interface DatatableKeyboardNavigationConfig {
  /**
   * Enable active-row keyboard navigation for the grid.
   *
   * When enabled, the grid can own an active row independent from checkbox
   * selection and react to `ArrowUp`, `ArrowDown`, `Enter`, and `Space`.
   */
  enabled?: boolean

  /**
   * Whether the grid should claim focus on mount when keyboard interactions are
   * enabled and no editable control currently owns focus.
   *
   * @default true
   */
  autoFocus?: boolean
}

export interface DatatableRowActionContext<TData> {
  row: TData
  rowId: string
  trigger: "keyboard" | "mouse"
}

export interface DatatableRowPreviewActionContext<TData> extends DatatableRowActionContext<TData> {
  nextOpen: boolean
}

export interface DatatableRowActionsConfig<TData> {
  onOpenRow?: (context: DatatableRowActionContext<TData>) => void | Promise<void>
  onTogglePreviewRow?: (context: DatatableRowPreviewActionContext<TData>) => void | Promise<void>
}

export interface DatatableRowIntentContext<TData> {
  row: TData
  rowId: string
  trigger: "keyboard" | "pointer"
}

export interface DatatableRowIntentConfig<TData> {
  onRowIntent?: (context: DatatableRowIntentContext<TData>) => void | Promise<void>
}

export interface DatatableRowPreviewConfig<TData> {
  enabled?: boolean
  /**
   * Whether pointer clicks on a data row should open the preview.
   *
   * Disable this when row clicks should perform the primary open action while
   * preview remains available through keyboard Space/hover affordances.
   *
   * @default true
   */
  openOnClick?: boolean
  /** When true, hovering a different data row while preview is already open switches preview to that row. */
  followRowHoverWhenOpen?: boolean
  floating?: {
    draggable?: boolean
    storageKey?: string
    /** Preferred preview panel width in pixels. Clamped to viewport bounds. */
    width?: number
    /** Preferred preview panel height in pixels. Clamped to viewport bounds. */
    height?: number
  }
  renderPreview: (info: { row: TData; rowId: string; close: () => void }) => ReactNode
}

export interface DatatableBulkActionsConfig<TData> {
  actions: DatatableBulkAction<TData>[]
  triggerLabel?: string
  serverExecutor?: (request: DatatableBulkServerActionRequest) => void | Promise<void>
}

export type DatatableSelectionDescriptor =
  | {
      kind: "explicit"
      ids: string[]
    }
  | {
      kind: "allMatching"
      query: OnlineQueryStateInput
      includedIds: string[]
      excludedIds: string[]
      totalMatchingRows: number
    }

export interface DatatableBulkActionContext<TData> {
  selection: DatatableSelectionDescriptor
  selectedRowIds: string[]
  selectedRows: TData[]
  selectedCount: number
  clearSelection: () => void
  closeDialog: () => void
}

export interface DatatableBulkServerActionRequest {
  actionId: string
  selection: DatatableSelectionDescriptor
  payload?: unknown
}

export interface DatatableBulkActionItem<TData> {
  id: string
  title: string
  subtitle?: string
  keywords?: string[]
  isVisible?: (context: DatatableBulkActionContext<TData>) => boolean
  execution?: "client" | "server"
  serverActionId?: string
  getServerPayload?: (context: DatatableBulkActionContext<TData>) => unknown
  onSelect?: (context: DatatableBulkActionContext<TData>) => void | Promise<void>
  getNextStep?: (
    context: DatatableBulkActionContext<TData>,
  ) => DatatableBulkActionStep<TData> | Promise<DatatableBulkActionStep<TData>>
}

export interface DatatableBulkActionStepContext<TData> extends DatatableBulkActionContext<TData> {
  goBack: () => void
  pushStep: (step: DatatableBulkActionStep<TData>) => void
  replaceStep: (step: DatatableBulkActionStep<TData>) => void
  executeServerAction: (
    request: Omit<DatatableBulkServerActionRequest, "selection">,
  ) => Promise<void>
}

export type DatatableBulkActionStep<TData> =
  | {
      kind: "items"
      title: string
      searchPlaceholder?: string
      items: DatatableBulkActionItem<TData>[]
    }
  | {
      kind: "confirm"
      title: string
      description?: string
      confirmLabel?: string
      cancelLabel?: string
      execution?: "client" | "server"
      serverActionId?: string
      buildServerPayload?: (context: DatatableBulkActionContext<TData>) => unknown
      onConfirm: (context: DatatableBulkActionContext<TData>) => void | Promise<void>
    }
  | {
      kind: "custom"
      title: string
      render: (context: DatatableBulkActionStepContext<TData>) => ReactNode
    }

export interface DatatableBulkAction<TData> {
  id: string
  title: string
  keywords?: string[]
  isVisible?: (context: DatatableBulkActionContext<TData>) => boolean
  execution?: "client" | "server"
  serverActionId?: string
  buildServerPayload?: (context: DatatableBulkActionContext<TData>) => unknown
  onSelect?: (context: DatatableBulkActionContext<TData>) => void | Promise<void>
  getInitialStep?: (
    context: DatatableBulkActionContext<TData>,
  ) => DatatableBulkActionStep<TData> | Promise<DatatableBulkActionStep<TData>>
}

/**
 * Props for Datatable component
 *
 * Shared props for Datatable component.
 */
interface DatatableBaseProps<TData> {
  /**
   * Stable identity for this table product surface.
   *
   * Used as the default key for runtime restoration, persistence, saved views,
   * and floating preview position unless those features provide an override.
   */
  tableKey: string

  // Columns
  columns: DatatableColumn<TData>[]

  // Row identification
  getRowId?: (row: TData) => string

  /**
   * Optional row-level text used by local-mode QuickSearch before falling back
   * to searchable column values.
   */
  getGlobalSearchText?: (row: TData) => string | null | undefined

  // Initial state (optional)
  initialState?: Partial<DatatableState>

  /**
   * Short-lived restoration for SPA unmount/remount flows.
   *
   * Enabled by default from `tableKey`. Pagination and scroll position are
   * restored from sessionStorage so they survive remounts and hard refreshes
   * within the current browser session.
   */
  runtimeRestoration?: DatatableRuntimeRestorationConfig

  /**
   * Called when the table has finished loading persisted state, saved views,
   * and initial URL state and is ready to render interactive content.
   */
  onReadyStateChange?: (ready: boolean) => void

  /**
   * Called when domain-specific query options change after table state has
   * initialized. Consumers can bridge these options into external row queries
   * without making the generic datatable aware of domain semantics.
   */
  onQueryOptionsChange?: (queryOptions: DatatableQueryOptions) => void

  /**
   * Called when table state that affects the row universe changes.
   * Domain-owned data sources can bridge this into Zero/server query planners.
   */
  onQueryStateChange?: (queryState: DatatableExternalQueryState) => void

  /**
   * Called when the virtualized grid reports the currently rendered row window.
   * Cursor-mode adapters can use this to load the next sequential page.
   */
  onRenderedRowRangeChange?: (range: RenderedRowRange) => void

  /**
   * Sequential cursor stream presentation for data already owned by the caller.
   *
   * This keeps the table in local-data mode for cells/selection/actions while
   * rendering a finite loading runway after loaded rows. It must not be used to
   * fake full-result scroll height.
   */
  cursorRows?: {
    hasMore: boolean
    /**
     * Data rows loaded per sequential cursor page. Used for external query
     * state and restoration signatures because cursor mode has no online config.
     */
    pageSize?: number
    /**
     * Number of loaded rows before the end of the current cursor window where
     * consumers should start fetching the next sequential page.
     */
    prefetchThresholdRows?: number
    runwayRows?: number
    summary?: {
      grouping?: OnlineGroupingSummary
      totalDataRows?: number
    }
  }

  // Dimensions
  rowHeight?: number // Default: 48
  headerHeight?: number // Default: 48

  // Viewport rendering policy
  virtualization?: DatatableVirtualizationConfig

  /**
   * Column reordering interaction configuration.
   */
  columnReordering?: DatatableColumnReorderingConfig

  /**
   * Optional row-selection feature.
   *
   * When enabled, the grid prepends a synthetic visual selection column that is
   * not part of the user column model or saved column order.
   */
  selection?: DatatableRowSelectionConfig<TData>

  /**
   * Optional bulk action island for selected rows.
   *
   * This currently provides the bottom action shell only. Deeper command flows
   * will be layered on later.
   */
  bulkActions?: DatatableBulkActionsConfig<TData>

  /**
   * Optional row/cell presentation hooks for transient interaction state such
   * as selection, active-row navigation, and preview state.
   */
  rowPresentation?: DatatableRowPresentationConfig<TData>

  /**
   * Optional active-row keyboard navigation behavior.
   */
  keyboardNavigation?: DatatableKeyboardNavigationConfig

  /**
   * Optional row intent callbacks for open/preview behavior.
   *
   * The datatable owns active-row state and keyboard handling; the implementing
   * feature decides what "open" and "preview" actually mean.
   */
  rowActions?: DatatableRowActionsConfig<TData>

  /**
   * Optional row intent callbacks for preloading or warming adjacent data.
   *
   * The grid fires this only for data rows from user intent signals such as
   * pointer hover and keyboard active-row movement. It does not fire when rows
   * merely mount due to virtualization.
   */
  rowIntent?: DatatableRowIntentConfig<TData>

  /**
   * Optional built-in floating preview surface for the current preview row.
   *
   * The datatable owns preview state and keyboard handling; the implementing
   * feature provides the preview contents.
   */
  preview?: DatatableRowPreviewConfig<TData>

  // Column resizing
  enableColumnResizing?: boolean // Default: true
  columnResizeMode?: "onChange" | "onEnd" // Default: 'onChange' (real-time resizing)

  /**
   * Table state persistence configuration
   *
   * Auto-saves user's table preferences (display options, layout, sorting, grouping) to storage.
   * State is automatically loaded on mount and saved when changed (debounced).
   *
   * **What gets persisted:**
   * - Column visibility, widths, and order
   * - Sticky columns count
   * - Column headers visibility
   * - Sorting configuration
   * - Grouping configuration and group expansion state
   * - Global search (QuickSearch)
   * - Column filters
   * - Filter mode (AND/OR)
   *
   * **What doesn't get persisted (transient):**
   * - Row selection
   * - Active row focus/keyboard cursor
   * - Preview open/close state and position
   *
   * @default false (opt-in)
   *
   * @example
   * // Simple enable with localStorage
   * import { localStorageAdapter } from '@/components/react-datatable/state/persistence/table-state-adapter-localstorage'
   *
   * <Datatable
   *   tableKey="contacts"
   *   persistState={{
   *     adapter: localStorageAdapter,
   *     workspaceId: "wsp_123",
   *   }}
   * />
   *
   * @example
   * // With sessionStorage (clears on browser close)
   * import { sessionStorageAdapter } from '@/components/react-datatable/state/persistence/table-state-adapter-localstorage'
   *
   * <Datatable
   *   tableKey="contacts"
   *   persistState={{
   *     adapter: sessionStorageAdapter,
   *   }}
   * />
   *
   * @example
   * // Full configuration with callbacks
   * <Datatable
   *   tableKey="contacts"
   *   persistState={{
   *     adapter: localStorageAdapter,
   *     workspaceId: "wsp_123",
   *     userId: "usr_456",
   *     debounceMs: 2000,
   *     onError: (error) => console.error("Save failed:", error),
   *     onSave: () => console.log("Preferences saved"),
   *   }}
   * />
   */
  persistState?: {
    /**
     * Adapter to use for persistence
     * Examples: localStorageAdapter, sessionStorageAdapter, trpcAdapter
     */
    adapter: TableStateAdapter

    /**
     * Optional override for the top-level tableKey.
     * Use only when migrating existing storage keys or splitting one table surface across namespaces.
     */
    tableKey?: string

    /**
     * Workspace ID (optional - depends on adapter)
     */
    workspaceId?: string

    /**
     * User ID (optional - inferred from context in most cases)
     */
    userId?: string

    /**
     * Debounce delay for auto-save in milliseconds
     * @default 1000ms
     */
    debounceMs?: number

    /**
     * Error callback
     */
    onError?: (error: Error) => void

    /**
     * Success callback after save
     */
    onSave?: () => void
  }

  /**
   * URL state synchronization configuration
   *
   * Controls how the datatable syncs state (filters, sorting, grouping) with URL parameters.
   *
   * @default false (equivalent to: { enabled: false, acceptUrlParams: true, historyMode: "push" })
   *
   * **Simple usage:**
   * - `false` - Shareable links work, URL auto-clears after load (default, recommended)
   * - `true` - Full bidirectional sync, URL always reflects state
   *
   * **Advanced configuration:**
   * ```tsx
   * // Shareable links with auto-clear (default behavior, explicitly configured)
   * urlSync={{
   *   enabled: false,         // Don't write state changes to URL
   *   acceptUrlParams: true,  // Accept URL params on initial load
   *   historyMode: "replace", // Use replace mode (optional)
   * }}
   *
   * // Full bidirectional sync (like Google Sheets)
   * urlSync={{
   *   enabled: true,          // Write state changes to URL
   *   acceptUrlParams: true,  // Accept URL params on initial load
   *   historyMode: "push",    // Create history entries for back/forward nav
   * }}
   *
   * // Disable URL usage completely
   * urlSync={{
   *   enabled: false,
   *   acceptUrlParams: false, // Ignore URL params completely
   * }}
   * ```
   *
   * **What gets synced:**
   * - Global search (q)
   * - Column filters (f.columnId)
   * - Sorting (s)
   * - Filter mode (fm)
   * - Grouping (g)
   *
   * **What doesn't get synced (stored in localStorage):**
   * - Column visibility, widths, order
   * - Sticky columns count
   * - Display preferences
   *
   * ⚠️ **Limitation:** Only one table per page should have `urlSync.enabled=true`.
   * Multiple tables will collide on URL params (q, f.*, s, etc.). If you need multiple
   * tables with URL sync, contact the team to discuss namespace support.
   */
  urlSync?: boolean | Omit<UseDatatableUrlOptions<TData>, "columns">

  // Sticky columns
  stickyColumnsCount?: number // Default: 0 - Number of columns to freeze from the left (initial value, can be changed in Display Options)

  /**
   * Column visibility presentation configuration for display settings.
   *
   * - `badges`: always show reorderable visibility badges
   * - `dropdown`: always show the searchable dropdown manager
   * - `auto`: choose based on the hideable column count and threshold
   *
   * @default { mode: "auto", autoThreshold: 10 }
   */
  columnVisibilityUI?: ColumnVisibilityUIConfig

  /**
   * Display options popover configuration.
   *
   * `false` hides the display options button. An object keeps the button visible
   * while controlling which sections are exposed.
   *
   * @default true
   */
  displayOptions?: boolean | DatatableDisplayOptionsConfig

  /**
   * Views configuration
   *
   * Allows users to save and load named table configurations (filters, sorting, layout, etc).
   * Views can be private (user-only) or shared (workspace-wide) depending on adapter support.
   *
   * **What gets saved in a view:**
   * - All fields from PersistedTableState (same as persistState)
   * - Column visibility, widths, order
   * - Sticky columns count
   * - Column headers visibility
   * - Sorting configuration
   * - Grouping configuration
   * - Global filter (QuickSearch)
   * - Column filters
   * - Filter mode (AND/OR)
   *
   * **Adapter support:**
   * - localStorage: Private views only, no sharing
   * - sessionStorage: Private views only, no sharing (clears on browser close)
   * - tRPC: Full support (private views, sharing, workspace defaults)
   *
   * **Important:** Must also enable in toolbar config (`toolbar.views: true`) to show UI
   *
   * @default undefined (disabled)
   *
   * @example
   * // With localStorage adapter (private views only)
   * import { localStorageDatatableViewAdapter } from '@/components/react-datatable/state/saved-views/datatable-view-adapter-localstorage'
   *
   * <Datatable
   *   tableKey="contacts"
   *   views={{
   *     adapter: localStorageDatatableViewAdapter,
   *     workspaceId: "wsp_123",
   *   }}
   *   toolbar={{ views: true }}
   * />
   *
   * @example
   * // With tRPC adapter (full sharing support)
   * const trpcAdapter = useTRPCDatatableViewAdapter()
   *
   * <Datatable
   *   tableKey="contacts"
   *   views={{
   *     adapter: trpcAdapter,
   *     workspaceId: "wsp_123",
   *     userId: "usr_456",
   *   }}
   *   toolbar={{ views: true }}
   * />
   */
  views?: {
    /**
     * Adapter to use for persistence
     * Examples: localStorageDatatableViewAdapter, sessionStorageDatatableViewAdapter, useTRPCDatatableViewAdapter()
     */
    adapter: DatatableViewAdapter

    /**
     * Optional override for the top-level tableKey.
     * Use only when saved views intentionally need a separate namespace.
     */
    tableKey?: string

    /**
     * Workspace ID (optional - depends on adapter)
     * Required for sharing features
     */
    workspaceId?: string

    /**
     * User ID (optional - inferred from context in most cases)
     */
    userId?: string

    /**
     * Code-defined views owned by this table. Fixed views are readonly in the
     * saved-view UI and are never sent to adapter mutation methods.
     */
    fixedViews?: DatatableView[]

    /**
     * One-shot fixed-view slug read from route/search params before initial
     * table state coordination.
     */
    linkedViewSlug?: string | null

    /**
     * Called once after initial state coordination consumes linkedViewSlug.
     * Consumers can clear the route/search param here before continuous URL
     * sync starts.
     */
    onLinkedViewConsumed?: () => void

    /**
     * Whether workspace sharing actions should be exposed in the saved views UI.
     * Disable this for anonymous/public tables that do not have a workspace.
     *
     * @default true
     */
    enableWorkspaceSharing?: boolean

    /**
     * Whether user-default saved view actions should be exposed in the saved views UI.
     * Disable this for anonymous/public tables that should not imply account state.
     *
     * @default true
     */
    enableUserDefaults?: boolean

    /**
     * Error callback
     */
    onError?: (error: Error) => void

    /**
     * Success callback after mutations
     */
    onSuccess?: () => void
  }

  // Toolbar
  toolbar?:
    | {
        quickSearch?:
          | boolean
          | {
              placeholder?: string // Default: 'Search...'
              debounceMs?: number // Default: 300
            }
        filterButton?: boolean // Default: true
        displayOptions?: boolean // Default: true
        copyLink?: boolean // Default: true - Show button to copy current URL with filters
        views?: boolean // Default: false - Show views dropdown (requires views prop to be configured)
        appliedState?: DatatableAppliedStateConfig // Controls applied sorting/filter chips
      }
    | boolean // true = show with defaults, false = hide completely

  // View Columns Button
  viewColumnsButton?:
    | boolean
    | {
        show?: boolean // Default: true
        width?: number // Default: 32 (pixels)
      }

  /**
   * When true (default), the grid includes a **trailing column** after visible data columns.
   * Its width is horizontal slack: `max(0, viewport − sum(column widths))`, so extra
   * space is empty filler and the row visually fills the viewport when columns are narrower
   * than the container. When columns are wider than the viewport, slack is zero (unchanged
   * horizontal scroll).
   *
   * When false, that trailing filler column is omitted unless `viewColumnsButton` is shown
   * (the view-columns control still uses the same gutter slot with its minimum width).
   *
   * When `viewColumnsButton` is active, behavior matches the single gutter column used today
   * (no double gutter).
   *
   * @default true
   */
  renderTrailingColumn?: boolean

  // Debug
  debug?: boolean
}

type DatatableLocalModeProps<TData> = {
  /**
   * Local mode: full dataset provided upfront.
   *
   * All filtering, sorting, and grouping happens client-side.
   */
  data: TData[]
  online?: never
}

type DatatableOnlineModeProps<TData> = {
  /**
   * Online mode: server-driven data with explicit navigation mode.
   *
   * Use `online.initialData` when a route loader or parent cache already has
   * the first online response. Do not pass top-level `data` in online mode.
   */
  online: OnlineConfig<TData>
  data?: never
}

/**
 * Props for Datatable component.
 *
 * Provide either `data` for local mode or `online` for server-driven mode.
 */
export type DatatableProps<TData> = DatatableBaseProps<TData> &
  (DatatableLocalModeProps<TData> | DatatableOnlineModeProps<TData>)
