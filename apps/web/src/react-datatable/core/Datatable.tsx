import { useEffect, useMemo } from "react"
import { LoadingState } from "../components/placeholders/LoadingState"
import { isGroupingSupportedForMode } from "../features/grouping/grouping-model"
import { debug as debugLog } from "../shared/utils/debug"
import { resolveRuntimeRestorationOptions } from "../state/lifecycle/runtime-restoration"
import { useDatatableStore } from "../state/store/use-datatable-store"
import type { DatatableProps } from "../types/props.types"
import { DatatableBody } from "./DatatableBody"
import { DatatableProvider } from "./DatatableProvider"
import { useOnlineData } from "./online/use-online-data"
import { useDatatableTable } from "./use-datatable-table"

/**
 * Main Datatable component
 *
 * Supports two modes:
 * - **Offline Mode**: Full dataset provided via `data` prop
 * - **Online Mode**: Data fetched via `online` prop with server-driven navigation
 *
 * @example Offline Mode
 * ```tsx
 * <Datatable
 *   data={items}
 *   columns={columns}
 *   getRowId={(row) => row.id}
 * />
 * ```
 *
 * @example Online Mode
 * ```tsx
 * <Datatable
 *   online={{
 *     mode: "infinite",
 *     queryKey: ["contacts", "listOnline"],
 *     pageSize: 50,
 *     query: (input) => trpc.contact.listOnline.query(input),
 *   }}
 *   columns={columns}
 * />
 * ```
 */
export function Datatable<TData>({
  tableKey,
  data,
  online,
  columns,
  getRowId,
  getGlobalSearchText,
  initialState,
  runtimeRestoration,
  onReadyStateChange,
  onQueryOptionsChange,
  onQueryStateChange,
  onRenderedRowRangeChange,
  cursorRows,
  debug,
  rowHeight = 40,
  headerHeight = 40,
  enableColumnResizing = true,
  columnResizeMode = "onChange",
  persistState,
  urlSync,
  views,
  stickyColumnsCount = 0,
  columnVisibilityUI,
  displayOptions = true,
  toolbar = true,
  viewColumnsButton = false,
  renderTrailingColumn = true,
  virtualization,
  columnReordering,
  selection,
  bulkActions,
  rowPresentation,
  keyboardNavigation,
  rowActions,
  rowIntent,
  preview,
}: DatatableProps<TData>) {
  const isOnlineMode = !!online
  const isLocalMode = data !== undefined

  if (isOnlineMode && isLocalMode) {
    throw new Error(
      "[Datatable] Provide either 'data' for local mode or 'online' for server-driven mode, not both",
    )
  }

  if (!isOnlineMode && !isLocalMode) {
    throw new Error(
      "[Datatable] Must provide either 'data' prop (local mode) or 'online' prop (server-driven mode)",
    )
  }

  if (!tableKey) {
    throw new Error("[Datatable] Must provide a stable 'tableKey' prop")
  }

  const resolvedPersistState = useMemo(
    () =>
      persistState
        ? {
            ...persistState,
            tableKey: persistState.tableKey ?? tableKey,
          }
        : undefined,
    [persistState, tableKey],
  )
  const resolvedViews = useMemo(
    () =>
      views
        ? {
            ...views,
            tableKey: views.tableKey ?? tableKey,
          }
        : undefined,
    [tableKey, views],
  )
  const resolvedRuntimeRestoration = useMemo(
    () => resolveRuntimeRestorationOptions(tableKey, runtimeRestoration),
    [runtimeRestoration, tableKey],
  )

  return (
    <DatatableProvider
      columns={columns}
      initialState={{
        ...initialState,
        stickyColumnsCount,
      }}
      persistState={resolvedPersistState}
      urlSync={urlSync}
      views={resolvedViews}
    >
      {online ? (
        <OnlineDatatableInner
          tableKey={tableKey}
          online={online}
          columns={columns}
          getRowId={getRowId}
          getGlobalSearchText={getGlobalSearchText}
          debug={debug}
          rowHeight={rowHeight}
          headerHeight={headerHeight}
          enableColumnResizing={enableColumnResizing}
          columnResizeMode={columnResizeMode}
          toolbar={toolbar}
          runtimeRestoration={resolvedRuntimeRestoration}
          views={resolvedViews}
          columnVisibilityUI={columnVisibilityUI}
          displayOptions={displayOptions}
          viewColumnsButton={viewColumnsButton}
          renderTrailingColumn={renderTrailingColumn}
          virtualization={virtualization}
          columnReordering={columnReordering}
          selection={selection}
          bulkActions={bulkActions}
          rowPresentation={rowPresentation}
          keyboardNavigation={keyboardNavigation}
          rowActions={rowActions}
          rowIntent={rowIntent}
          preview={preview}
          onReadyStateChange={onReadyStateChange}
          onQueryOptionsChange={onQueryOptionsChange}
          onQueryStateChange={onQueryStateChange}
          onRenderedRowRangeChange={onRenderedRowRangeChange}
          cursorRows={cursorRows}
        />
      ) : (
        <LocalDatatableInner
          tableKey={tableKey}
          data={data}
          columns={columns}
          getRowId={getRowId}
          getGlobalSearchText={getGlobalSearchText}
          debug={debug}
          rowHeight={rowHeight}
          headerHeight={headerHeight}
          enableColumnResizing={enableColumnResizing}
          columnResizeMode={columnResizeMode}
          toolbar={toolbar}
          runtimeRestoration={resolvedRuntimeRestoration}
          views={resolvedViews}
          columnVisibilityUI={columnVisibilityUI}
          displayOptions={displayOptions}
          viewColumnsButton={viewColumnsButton}
          renderTrailingColumn={renderTrailingColumn}
          virtualization={virtualization}
          columnReordering={columnReordering}
          selection={selection}
          bulkActions={bulkActions}
          rowPresentation={rowPresentation}
          keyboardNavigation={keyboardNavigation}
          rowActions={rowActions}
          rowIntent={rowIntent}
          preview={preview}
          onReadyStateChange={onReadyStateChange}
          onQueryOptionsChange={onQueryOptionsChange}
          onQueryStateChange={onQueryStateChange}
          onRenderedRowRangeChange={onRenderedRowRangeChange}
          cursorRows={cursorRows}
        />
      )}
    </DatatableProvider>
  )
}

type DatatableInnerProps<TData> = Omit<
  DatatableProps<TData>,
  | "data"
  | "online"
  | "initialState"
  | "stickyColumnsCount"
  | "persistState"
  | "urlSync"
  | "runtimeRestoration"
  | "views"
> & {
  runtimeRestoration: ReturnType<typeof resolveRuntimeRestorationOptions>
  views?: NonNullable<DatatableProps<TData>["views"]> & { tableKey: string }
}

/**
 * Inner component with access to store
 * Separated to ensure store context is available
 */
function LocalDatatableInner<TData>({
  tableKey,
  data,
  columns,
  getRowId,
  getGlobalSearchText,
  debug,
  rowHeight = 40,
  headerHeight = 40,
  enableColumnResizing = true,
  columnResizeMode = "onChange",
  toolbar = true,
  runtimeRestoration,
  views,
  columnVisibilityUI,
  displayOptions = true,
  viewColumnsButton = false,
  renderTrailingColumn = true,
  virtualization,
  columnReordering,
  selection,
  bulkActions,
  rowPresentation,
  keyboardNavigation,
  rowActions,
  rowIntent,
  preview,
  onReadyStateChange,
  onQueryOptionsChange,
  onQueryStateChange,
  onRenderedRowRangeChange,
  cursorRows,
}: DatatableInnerProps<TData> & { data: TData[] }) {
  const queryOptions = useDatatableStore((s) => s.queryOptions)

  useEffect(() => {
    onReadyStateChange?.(true)
  }, [onReadyStateChange])

  useEffect(() => {
    onQueryOptionsChange?.(queryOptions)
  }, [onQueryOptionsChange, queryOptions])

  const { table, setLocalColumnSizing } = useDatatableTable(
    data,
    columns,
    getRowId,
    getGlobalSearchText,
    enableColumnResizing,
    columnResizeMode,
    viewColumnsButton,
    false,
  )

  useEffect(() => {
    if (!debug) {
      return
    }

    debugLog("datatable state", {
      mode: "local",
      dataLength: data.length,
      columnCount: columns.length,
      isLoading: false,
      isFetching: false,
      totalDataRows: data.length,
      totalRenderedRows: data.length,
    })
  }, [columns.length, data.length, debug])

  return (
    <DatatableBody
      table={table}
      tableKey={tableKey}
      setLocalColumnSizing={setLocalColumnSizing}
      rowHeight={rowHeight}
      headerHeight={headerHeight}
      toolbar={toolbar}
      viewsConfig={views}
      runtimeRestoration={runtimeRestoration}
      columnVisibilityUI={columnVisibilityUI}
      displayOptions={displayOptions}
      viewColumnsButton={viewColumnsButton}
      renderTrailingColumn={renderTrailingColumn}
      virtualization={virtualization}
      columnReordering={columnReordering}
      selection={selection}
      bulkActions={bulkActions}
      rowPresentation={rowPresentation}
      keyboardNavigation={keyboardNavigation}
      rowActions={rowActions}
      rowIntent={rowIntent}
      preview={preview}
      debug={debug}
      onQueryStateChange={onQueryStateChange}
      onRenderedRowRangeChange={onRenderedRowRangeChange}
      cursorRows={cursorRows}
    />
  )
}

function OnlineDatatableInner<TData>({
  tableKey,
  online,
  columns,
  getRowId,
  getGlobalSearchText,
  debug,
  rowHeight = 40,
  headerHeight = 40,
  enableColumnResizing = true,
  columnResizeMode = "onChange",
  toolbar = true,
  runtimeRestoration,
  views,
  columnVisibilityUI,
  displayOptions = true,
  viewColumnsButton = false,
  renderTrailingColumn = true,
  virtualization,
  columnReordering,
  selection,
  bulkActions,
  rowPresentation,
  keyboardNavigation,
  rowActions,
  rowIntent,
  preview,
  onReadyStateChange,
  onQueryOptionsChange,
  onQueryStateChange,
  onRenderedRowRangeChange,
  cursorRows,
}: DatatableInnerProps<TData> & { online: NonNullable<DatatableProps<TData>["online"]> }) {
  const queryOptions = useDatatableStore((s) => s.queryOptions)
  const sorting = useDatatableStore((s) => s.sorting)
  const setSorting = useDatatableStore((s) => s.setSorting)
  const supportedGroupingColumnsForMode = useMemo(() => {
    return columns
      .filter(
        (column) =>
          (column.enableGrouping ?? false) &&
          isGroupingSupportedForMode(column.groupingSpec, "online"),
      )
      .map((column) => column.id)
  }, [columns])
  const supportedSortingColumnsForMode = useMemo(() => {
    return columns.filter((column) => column.enableSorting !== false).map((column) => column.id)
  }, [columns])

  // Online mode: fetch data through the configured query function.
  const onlineQuery = useOnlineData<TData>(
    online,
    supportedGroupingColumnsForMode,
    supportedSortingColumnsForMode,
    runtimeRestoration,
  )
  const grouping = useDatatableStore((s) => s.grouping)
  const setGrouping = useDatatableStore((s) => s.setGrouping)

  const sanitizedGrouping = useMemo(() => {
    const supported = new Set(supportedGroupingColumnsForMode)
    return grouping.filter((columnId) => supported.has(columnId))
  }, [grouping, supportedGroupingColumnsForMode])
  const sanitizedSorting = useMemo(() => {
    const supported = new Set(supportedSortingColumnsForMode)
    return sorting.filter((entry) => supported.has(entry.id))
  }, [sorting, supportedSortingColumnsForMode])

  useEffect(() => {
    if (sanitizedGrouping.length === grouping.length) {
      return
    }

    setGrouping(sanitizedGrouping)
  }, [grouping, sanitizedGrouping, setGrouping])

  useEffect(() => {
    if (sanitizedSorting.length === sorting.length) {
      return
    }

    setSorting(sanitizedSorting)
  }, [sanitizedSorting, setSorting, sorting])

  const finalData = onlineQuery.data
  const isLoadingData = onlineQuery.isLoading
  const shouldShowInitialLoadingState = isLoadingData

  useEffect(() => {
    onReadyStateChange?.(!isLoadingData)
  }, [isLoadingData, onReadyStateChange])

  useEffect(() => {
    onQueryOptionsChange?.(queryOptions)
  }, [onQueryOptionsChange, queryOptions])

  // ALWAYS call all hooks before any conditional returns (Rules of Hooks)
  const { table, setLocalColumnSizing } = useDatatableTable(
    finalData,
    columns,
    getRowId,
    getGlobalSearchText,
    enableColumnResizing,
    columnResizeMode,
    viewColumnsButton,
    true,
  )

  useEffect(() => {
    if (!debug) {
      return
    }

    debugLog("datatable state", {
      mode: online.mode,
      dataLength: finalData.length,
      columnCount: columns.length,
      isLoading: isLoadingData,
      isFetching: onlineQuery.isFetching,
      totalDataRows: onlineQuery.totalDataRows,
      totalRenderedRows: onlineQuery.totalRenderedRows,
    })
  }, [
    columns.length,
    debug,
    finalData.length,
    isLoadingData,
    online.mode,
    onlineQuery.isFetching,
    onlineQuery.totalDataRows,
    onlineQuery.totalRenderedRows,
  ])

  // Show loading state during initial fetch (online mode only)
  // Moved AFTER all hooks to avoid hook order violation
  if (shouldShowInitialLoadingState) {
    return (
      <LoadingState
        rowCount={10}
        columnCount={Math.min(columns.length, 5)}
        rowHeight={rowHeight}
        message="Loading data..."
      />
    )
  }

  return (
    <>
      {/* Screen reader announcement for refetch state */}
      {onlineQuery.isFetching && !onlineQuery.isLoading && (
        <output className="sr-only">Updating results...</output>
      )}

      <DatatableBody
        table={table}
        tableKey={tableKey}
        setLocalColumnSizing={setLocalColumnSizing}
        rowHeight={rowHeight}
        headerHeight={headerHeight}
        toolbar={toolbar}
        viewsConfig={views}
        runtimeRestoration={runtimeRestoration}
        columnVisibilityUI={columnVisibilityUI}
        displayOptions={displayOptions}
        viewColumnsButton={viewColumnsButton}
        renderTrailingColumn={renderTrailingColumn}
        onlineQuery={onlineQuery}
        virtualization={virtualization}
        columnReordering={columnReordering}
        selection={selection}
        bulkActions={bulkActions}
        rowPresentation={rowPresentation}
        keyboardNavigation={keyboardNavigation}
        rowActions={rowActions}
        rowIntent={rowIntent}
        preview={preview}
        debug={debug}
        onQueryStateChange={onQueryStateChange}
        onRenderedRowRangeChange={onRenderedRowRangeChange}
        cursorRows={cursorRows}
      />
    </>
  )
}
