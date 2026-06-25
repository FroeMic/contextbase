import type { ColumnSizingState, Table as TanStackTable } from "@tanstack/react-table"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import { DatatableAppliedStateBar } from "../components/applied-state-bar/DatatableAppliedStateBar"
import { GridErrorBoundary } from "../components/grid/GridErrorBoundary"
import { VirtualizedGrid } from "../components/grid/VirtualizedGrid"
import { DatatableToolbar } from "../components/toolbar/DatatableToolbar"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../components/ui/pagination"
import { SearchableDropdown } from "../components/ui/searchable-dropdown"
import { ViewColumnsButton } from "../components/view-columns/ViewColumnsButton"
import { BulkActionDialog } from "../features/bulk-actions/BulkActionDialog"
import { BulkActionIsland } from "../features/bulk-actions/BulkActionIsland"
import { FloatingPreview } from "../features/floating-preview/FloatingPreview"
import { applyGroupExpansionToRenderableRows } from "../features/grouping/group-expansion"
import { shouldResetInteractionStateForQueryChange } from "../features/selection/selection-query-reset"
import { useIsMobile } from "@/shared/hooks/use-mobile"
import { useContainerSize } from "../shared/hooks/use-container-size"
import { debug as debugLog } from "../shared/utils/debug"
import type { DatatableRuntimeRestorationOptions } from "../state/lifecycle/runtime-restoration"
import {
  getRuntimeScrollStateByBucket,
  setRuntimeScrollStateByBucket,
} from "../state/lifecycle/runtime-restoration"
import { useDatatableStore } from "../state/store/use-datatable-store"
import type {
  DatatableAppliedStateConfig,
  DatatableExternalQueryState,
  DatatableProps,
  OnlineQueryStateInput,
} from "../types/props.types"
import { type ColumnResizeSession, ColumnResizeSessionContext } from "./ColumnResizeSessionContext"
import {
  appendCursorGrowthRunwayRows,
  buildCursorGrowthRenderableRows,
} from "./cursor/cursor-growth-virtualization"
import { useDatatableColumns } from "./DatatableProvider"
import { VIEW_COLUMNS_BUTTON_WIDTH } from "./layout/constants"
import { useOnlineRangeLoader } from "./loading/range-loader"
import type { UseOnlineDataReturn } from "./online/use-online-data"
import { buildPaginationItems, getEllipsisPageOptions } from "./pagination/pagination"
import {
  createDisplayRowModel,
  createOnlineVirtualDisplayRowModel,
} from "./row-model/display-row-model"
import { useRenderableRows } from "./row-model/use-renderable-rows"
import { buildVerticalScrollSignature } from "./scroll/scroll-restoration-signature"

/**
 * Context for setLocalColumnSizing setter
 * Allows components deep in the tree (like HeaderActionMenu) to update column widths
 */
const ColumnSizingContext = createContext<React.Dispatch<
  React.SetStateAction<ColumnSizingState>
> | null>(null)

/**
 * Hook to access setLocalColumnSizing from context
 * Used by components that need to programmatically update column widths (e.g., resize dialog)
 */
export function useDatatableColumnSizing() {
  const setter = useContext(ColumnSizingContext)
  if (!setter) {
    throw new Error("useDatatableColumnSizing must be used within DatatableBody")
  }
  return setter
}

interface DatatableBodyProps<TData> {
  table: TanStackTable<TData>
  tableKey: string
  setLocalColumnSizing: React.Dispatch<React.SetStateAction<ColumnSizingState>>
  rowHeight: number
  headerHeight: number
  toolbar?:
    | {
        quickSearch?:
          | boolean
          | {
              placeholder?: string
              debounceMs?: number
            }
        filterButton?: boolean
        displayOptions?: boolean
        copyLink?: boolean
        views?: boolean
        appliedState?: DatatableAppliedStateConfig
      }
    | boolean
  viewsConfig?: DatatableProps<TData>["views"]
  columnVisibilityUI?: DatatableProps<TData>["columnVisibilityUI"]
  displayOptions?: DatatableProps<TData>["displayOptions"]
  viewColumnsButton?:
    | boolean
    | {
        show?: boolean
        width?: number
      }
  renderTrailingColumn?: boolean
  onlineQuery?: UseOnlineDataReturn<TData>
  runtimeRestoration?: DatatableRuntimeRestorationOptions | null
  virtualization?: DatatableProps<TData>["virtualization"]
  columnReordering?: DatatableProps<TData>["columnReordering"]
  selection?: DatatableProps<TData>["selection"]
  bulkActions?: DatatableProps<TData>["bulkActions"]
  rowPresentation?: DatatableProps<TData>["rowPresentation"]
  keyboardNavigation?: DatatableProps<TData>["keyboardNavigation"]
  rowActions?: DatatableProps<TData>["rowActions"]
  rowIntent?: DatatableProps<TData>["rowIntent"]
  preview?: DatatableProps<TData>["preview"]
  onQueryStateChange?: (queryState: DatatableExternalQueryState) => void
  onRenderedRowRangeChange?: (range: { rowStartIndex: number; rowStopIndex: number }) => void
  cursorRows?: DatatableProps<TData>["cursorRows"]
  debug?: boolean
}

/**
 * Main table body component
 * Renders toolbar, filters, header and rows using shadcn/ui table components
 * Supports virtual scrolling for large datasets
 */
export function DatatableBody<TData>({
  table,
  tableKey,
  setLocalColumnSizing,
  rowHeight,
  headerHeight,
  toolbar = true,
  viewsConfig,
  columnVisibilityUI,
  displayOptions = true,
  viewColumnsButton = false,
  renderTrailingColumn = true,
  onlineQuery,
  runtimeRestoration,
  virtualization,
  columnReordering,
  selection,
  bulkActions,
  rowPresentation,
  keyboardNavigation,
  rowActions,
  rowIntent,
  preview,
  onQueryStateChange,
  onRenderedRowRangeChange,
  cursorRows,
  debug,
}: DatatableBodyProps<TData>) {
  const isMobile = useIsMobile()
  const pageSizeSelectId = useId()
  const gridContainerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [activeResizeSession, setActiveResizeSession] = useState<ColumnResizeSession | null>(null)

  // Track scrollbar width for ViewColumnsButton positioning (grid mode only)
  const [verticalScrollbarWidth, setVerticalScrollbarWidth] = useState(0)
  const [horizontalScrollbarWidth, setHorizontalScrollbarWidth] = useState(0)
  const [isBulkActionDialogOpen, setIsBulkActionDialogOpen] = useState(false)
  const [openEllipsisIndex, setOpenEllipsisIndex] = useState<number | null>(null)
  const previousQueryRef = useRef<OnlineQueryStateInput | null>(null)

  const clearAllFilters = useDatatableStore((s) => s.clearAllFilters)
  const setGlobalFilter = useDatatableStore((s) => s.setGlobalFilter)
  const groupExpanded = useDatatableStore((s) => s.groupExpanded)
  const rowSelection = useDatatableStore((s) => s.rowSelection)
  const deselectAll = useDatatableStore((s) => s.deselectAll)
  const activeRowId = useDatatableStore((s) => s.activeRowId)
  const previewRowId = useDatatableStore((s) => s.previewRowId)
  const previewAnchorPoint = useDatatableStore((s) => s.previewAnchorPoint)
  const setPreviewRow = useDatatableStore((s) => s.setPreviewRow)
  const columnFilters = useDatatableStore((s) => s.columnFilters)
  const sorting = useDatatableStore((s) => s.sorting)
  const globalFilter = useDatatableStore((s) => s.globalFilter)
  const grouping = useDatatableStore((s) => s.grouping)
  const showEmptyGroups = useDatatableStore((s) => s.showEmptyGroups)
  const showColumnHeaders = useDatatableStore((s) => s.showColumnHeaders)
  const showOrderingBadge = useDatatableStore((s) => s.showOrderingBadge)
  const queryOptions = useDatatableStore((s) => s.queryOptions)
  const resolvedRowHeight = isMobile ? Math.max(rowHeight, 48) : rowHeight
  const resolvedHeaderHeight = isMobile ? Math.max(headerHeight, 48) : headerHeight
  const resolvedGroupHeaderHeight = isMobile ? Math.max(rowHeight, 48) : 44

  // Get renderable rows (group headers + data rows) using new architecture
  // Offline mode builds rows locally. Online mode can provide server-shaped rows.
  const offlineRenderableRows = useRenderableRows(table, cursorRows?.summary?.grouping)
  const cursorRenderableRows = useMemo(() => {
    if (!cursorRows) {
      return null
    }

    if (grouping.length > 0) {
      return appendCursorGrowthRunwayRows({
        hasMore: cursorRows.hasMore,
        renderableRows: offlineRenderableRows,
        runwayRows: cursorRows.runwayRows ?? 20,
      })
    }

    const coreRows = table.getCoreRowModel().rows
    return buildCursorGrowthRenderableRows({
      getRowId: (_row, index) => coreRows[index]?.id ?? String(index),
      hasMore: cursorRows.hasMore,
      rows: coreRows.map((row) => row.original),
      runwayRows: cursorRows.runwayRows ?? 20,
    })
  }, [cursorRows, grouping.length, offlineRenderableRows, table])
  const renderableRows = useMemo(() => {
    if (cursorRenderableRows) {
      return cursorRenderableRows
    }

    if (!onlineQuery) {
      return offlineRenderableRows
    }

    if (!onlineQuery.renderableRows) {
      return []
    }

    return applyGroupExpansionToRenderableRows(onlineQuery.renderableRows, groupExpanded)
  }, [cursorRenderableRows, groupExpanded, offlineRenderableRows, onlineQuery])

  // Check if we should show empty state (no data after loading)
  // In online mode, also check isFetching to prevent showing empty state during refetch
  const shouldShowEmptyState =
    onlineQuery?.mode === "infinite"
      ? onlineQuery.totalDataRows === 0 && !onlineQuery.isLoading && !onlineQuery.isFetching
      : renderableRows.length === 0 && !onlineQuery?.isLoading && !onlineQuery?.isFetching

  // Get column definitions for grid mode
  const columns = useDatatableColumns()

  // Measure grid container size (used in grid mode)
  const containerSize = useContainerSize(gridContainerRef)

  // Get filtered row count for button height calculation (excludes group headers)
  const filteredRowCount =
    onlineQuery?.mode === "infinite"
      ? onlineQuery.totalRenderedRows
      : table.getFilteredRowModel().rows.length

  // View Columns Button configuration
  const showViewColumnsButton =
    typeof viewColumnsButton === "boolean" ? viewColumnsButton : (viewColumnsButton?.show ?? true)
  const viewColumnsButtonWidth =
    typeof viewColumnsButton === "object" && viewColumnsButton?.width
      ? viewColumnsButton.width
      : VIEW_COLUMNS_BUTTON_WIDTH

  // Toolbar configuration
  const showToolbar = toolbar !== false
  const toolbarConfig =
    typeof toolbar === "object"
      ? toolbar
      : {
          quickSearch: true,
          filterButton: true,
          displayOptions: true,
          copyLink: true,
          views: false,
        }
  const shouldShowDisplayOptions =
    toolbarConfig.displayOptions !== false && displayOptions !== false

  const gridOnlineState = useMemo(
    () =>
      onlineQuery
        ? {
            isEnabled: onlineQuery.mode !== null,
            mode: onlineQuery.mode,
            isLoading: onlineQuery.isLoading,
            isFetching: onlineQuery.isFetching,
            isRefetching: onlineQuery.isRefetching,
            isFetchingNextPage: onlineQuery.isFetchingNextPage,
            totalDataRowCount: onlineQuery.totalDataRows,
            totalRenderedRowCount: onlineQuery.totalRenderedRows,
            groupingSummary: onlineQuery.grouping,
          }
        : undefined,
    [onlineQuery],
  )

  const bodyRowModel = useMemo(() => {
    void onlineQuery?.liveDataVersion

    if (onlineQuery?.mode === "infinite" && onlineQuery.virtualPagesByOffset) {
      return createOnlineVirtualDisplayRowModel({
        pagesByOffset: onlineQuery.virtualPagesByOffset,
        totalDataRows: onlineQuery.totalDataRows,
        totalRenderedRows: onlineQuery.totalRenderedRows,
        groupingSummary: onlineQuery.grouping,
        groupExpanded,
        showColumnHeaders,
        rowHeight: resolvedRowHeight,
        headerHeight: resolvedHeaderHeight,
        groupHeaderHeight: resolvedGroupHeaderHeight,
      })
    }

    return createDisplayRowModel({
      renderableRows,
      showColumnHeaders,
      rowHeight: resolvedRowHeight,
      headerHeight: resolvedHeaderHeight,
      groupHeaderHeight: resolvedGroupHeaderHeight,
    })
  }, [
    onlineQuery?.mode,
    onlineQuery?.totalDataRows,
    onlineQuery?.totalRenderedRows,
    onlineQuery?.liveDataVersion,
    onlineQuery?.grouping,
    onlineQuery?.virtualPagesByOffset,
    groupExpanded,
    resolvedGroupHeaderHeight,
    resolvedHeaderHeight,
    resolvedRowHeight,
    renderableRows,
    showColumnHeaders,
  ])

  const handleRenderedRowRangeChange = useOnlineRangeLoader({
    onlineQuery,
    displayRowModel: bodyRowModel,
    rowHeight: resolvedRowHeight,
    debug,
  })
  const handleRenderedRowRangeChangeWithObservers = useCallback(
    (range: { rowStartIndex: number; rowStopIndex: number }) => {
      handleRenderedRowRangeChange(range)
      onRenderedRowRangeChange?.(range)
    },
    [handleRenderedRowRangeChange, onRenderedRowRangeChange],
  )

  useEffect(() => {
    if (!debug) {
      return
    }

    debugLog("body model", {
      mode: onlineQuery?.mode ?? "local",
      renderableRows: renderableRows.length,
      displayRows: bodyRowModel.rowCount,
      loadedRows: bodyRowModel.loadedRowCount,
      totalDataRows: onlineQuery?.totalDataRows,
      totalRenderedRows: onlineQuery?.totalRenderedRows,
      virtualPages: onlineQuery?.virtualPagesByOffset?.size,
      isFetching: onlineQuery?.isFetching ?? false,
    })
  }, [
    bodyRowModel.loadedRowCount,
    bodyRowModel.rowCount,
    debug,
    onlineQuery?.isFetching,
    onlineQuery?.mode,
    onlineQuery?.totalDataRows,
    onlineQuery?.totalRenderedRows,
    onlineQuery?.virtualPagesByOffset?.size,
    renderableRows.length,
  ])

  const paginationSummary = useMemo(() => {
    if (!onlineQuery || onlineQuery.mode !== "pagination" || onlineQuery.totalRenderedRows === 0) {
      return null
    }

    const currentPageRowCount = renderableRows.length
    const start = onlineQuery.pageIndex * onlineQuery.pageSize + 1
    const end = Math.min(start + currentPageRowCount - 1, onlineQuery.totalRenderedRows)

    return { start, end }
  }, [onlineQuery, renderableRows.length])

  const formatNumber = useCallback((value: number) => value.toLocaleString(), [])

  const paginationItems = useMemo(() => {
    if (onlineQuery?.mode !== "pagination") {
      return []
    }

    return buildPaginationItems({
      currentPage: onlineQuery.pageCount === 0 ? 0 : onlineQuery.pageIndex + 1,
      pageCount: onlineQuery.pageCount,
    })
  }, [onlineQuery?.mode, onlineQuery?.pageCount, onlineQuery?.pageIndex])
  const paginationRenderItems = useMemo(
    () =>
      paginationItems.map((item, index) => ({
        item,
        itemIndex: index,
        key:
          item === "ellipsis"
            ? `ellipsis-${getEllipsisPageOptions(paginationItems, index).join("-")}`
            : `page-${item}`,
      })),
    [paginationItems],
  )

  const getRowCanSelect = selection?.getRowCanSelect

  const queryState = useMemo(
    () => ({
      limit: onlineQuery?.pageSize ?? cursorRows?.pageSize ?? 50,
      filters: columnFilters,
      sorting,
      globalFilter,
      grouping: grouping.length > 0 ? { columns: grouping, showEmptyGroups } : undefined,
    }),
    [
      columnFilters,
      cursorRows?.pageSize,
      globalFilter,
      grouping,
      onlineQuery?.pageSize,
      showEmptyGroups,
      sorting,
    ],
  )

  useEffect(() => {
    onQueryStateChange?.({ ...queryState, queryOptions })
  }, [onQueryStateChange, queryOptions, queryState])

  const horizontalScrollSignature = useMemo(
    () =>
      JSON.stringify([
        tableKey,
        "horizontal",
        // Keep horizontal scroll independent from query changes.
      ]),
    [tableKey],
  )
  const verticalScrollSignature = useMemo(
    () =>
      buildVerticalScrollSignature({
        coreRowCount: table.getCoreRowModel().rows.length,
        mode: cursorRows ? "cursor" : "local",
        onlineQuerySignature: onlineQuery?.querySignature ?? undefined,
        queryShape: {
          limit: queryState.limit,
          filters: queryState.filters,
          globalFilter: queryState.globalFilter,
          grouping: queryState.grouping,
        },
        rowCount: bodyRowModel.rowCount,
        tableKey,
      }),
    [
      bodyRowModel.rowCount,
      cursorRows,
      onlineQuery?.querySignature,
      queryState.filters,
      queryState.globalFilter,
      queryState.grouping,
      queryState.limit,
      table,
      tableKey,
    ],
  )
  const runtimeScrollState = useMemo(() => {
    if (runtimeRestoration?.scroll !== true) {
      return undefined
    }

    const horizontal = getRuntimeScrollStateByBucket(
      runtimeRestoration.key,
      horizontalScrollSignature,
      "horizontal",
    )
    const vertical = getRuntimeScrollStateByBucket(
      runtimeRestoration.key,
      verticalScrollSignature,
      "vertical",
    )
    return {
      scrollLeft: horizontal?.scrollLeft ?? 0,
      scrollTop: vertical?.scrollTop ?? 0,
    }
  }, [horizontalScrollSignature, runtimeRestoration, verticalScrollSignature])
  const scrollRestorationKey = useMemo(() => {
    if (runtimeRestoration?.scroll !== true) {
      return undefined
    }

    return `${runtimeRestoration.key}:${horizontalScrollSignature}:${verticalScrollSignature}`
  }, [horizontalScrollSignature, runtimeRestoration, verticalScrollSignature])

  const handleScrollPositionChange = useCallback(
    (state: { scrollLeft: number; scrollTop: number }) => {
      if (runtimeRestoration?.scroll !== true) {
        return
      }

      setRuntimeScrollStateByBucket(
        runtimeRestoration.key,
        horizontalScrollSignature,
        {
          scrollLeft: state.scrollLeft,
          scrollTop: 0,
        },
        "horizontal",
      )
      setRuntimeScrollStateByBucket(
        runtimeRestoration.key,
        verticalScrollSignature,
        {
          scrollLeft: 0,
          scrollTop: state.scrollTop,
        },
        "vertical",
      )
    },
    [horizontalScrollSignature, runtimeRestoration, verticalScrollSignature],
  )

  const totalMatchingRows = useMemo(() => {
    if (onlineQuery) {
      return onlineQuery.totalDataRows
    }

    if (cursorRows?.summary?.totalDataRows !== undefined) {
      return cursorRows.summary.totalDataRows
    }

    const canSelect = selection?.getRowCanSelect
    const filteredRows = table.getFilteredRowModel().rows
    return canSelect
      ? filteredRows.filter((row) => canSelect(row.original)).length
      : filteredRows.length
  }, [cursorRows?.summary?.totalDataRows, onlineQuery, selection, table])

  useEffect(() => {
    if (
      shouldResetInteractionStateForQueryChange({
        previousQuery: previousQueryRef.current,
        nextQuery: queryState,
        selection: rowSelection,
        activeRowId,
        previewRowId,
      })
    ) {
      deselectAll()
    }

    previousQueryRef.current = queryState
  }, [activeRowId, deselectAll, previewRowId, queryState, rowSelection])

  const selectedRowIds = useMemo(
    () =>
      rowSelection.kind === "allMatching"
        ? bodyRowModel.orderedDataRows
            .filter((row) => !rowSelection.excludedIds[row.rowId])
            .filter((row) => (getRowCanSelect ? getRowCanSelect(row.data) : true))
            .map((row) => row.rowId)
        : Array.from(
            new Set([...Object.keys(rowSelection.ids), ...Object.keys(rowSelection.rangeRowIds)]),
          ),
    [bodyRowModel, getRowCanSelect, rowSelection],
  )

  const selectedRows = useMemo(() => {
    if (selectedRowIds.length === 0) {
      return []
    }

    const selectedRowIdSet = new Set(selectedRowIds)
    return selectedRowIds.flatMap((rowId) => {
      const row = bodyRowModel.getDataRowById(rowId)
      return row && selectedRowIdSet.has(row.rowId) ? [row.data] : []
    })
  }, [bodyRowModel, selectedRowIds])

  const selectionDescriptor = useMemo(
    () =>
      rowSelection.kind === "allMatching"
        ? {
            kind: "allMatching" as const,
            query: rowSelection.query,
            includedIds: Object.keys(rowSelection.includedIds),
            excludedIds: Object.keys(rowSelection.excludedIds),
            totalMatchingRows: rowSelection.totalMatchingRows,
          }
        : {
            kind: "explicit" as const,
            ids: Array.from(
              new Set([...Object.keys(rowSelection.ids), ...Object.keys(rowSelection.rangeRowIds)]),
            ),
          },
    [rowSelection],
  )

  const selectedCount = useMemo(
    () =>
      rowSelection.kind === "allMatching"
        ? Math.max(0, rowSelection.totalMatchingRows - Object.keys(rowSelection.excludedIds).length)
        : selectedRowIds.length,
    [rowSelection, selectedRowIds.length],
  )

  const showBulkActionIsland = !!bulkActions && selectedCount > 0
  const previewDataRow = useMemo(() => {
    if (!previewRowId) {
      return null
    }

    const row = bodyRowModel.getDataRowById(previewRowId)
    return row ? { rowId: row.rowId, row: row.data } : null
  }, [bodyRowModel, previewRowId])
  const previewEnabled = preview?.enabled ?? true

  return (
    <ColumnSizingContext.Provider value={setLocalColumnSizing}>
      <ColumnResizeSessionContext.Provider value={{ activeResizeSession, setActiveResizeSession }}>
        <div className="flex h-full flex-col px-1 pb-1">
          {/* Toolbar */}
          {showToolbar && (
            <DatatableToolbar
              {...toolbarConfig}
              displayOptions={shouldShowDisplayOptions}
              viewsConfig={viewsConfig}
              columnVisibilityUI={columnVisibilityUI}
              displayOptionsConfig={displayOptions}
              table={table}
            />
          )}

          {/* Applied Filters */}
          <DatatableAppliedStateBar
            showSorting={(toolbarConfig.appliedState?.showSorting ?? true) && showOrderingBadge}
            showFilters={toolbarConfig.appliedState?.showFilters}
          />

          {/* Grid container - measured with ResizeObserver */}
          <div ref={gridContainerRef} className="relative flex-1 overflow-hidden">
            {/* Only render grid once we have measurements */}
            {containerSize.width > 0 && containerSize.height > 0 && (
              <GridErrorBoundary key={`grid-${columns.length}`}>
                <VirtualizedGrid
                  table={table}
                  renderableRows={renderableRows}
                  rowModel={bodyRowModel}
                  columns={columns}
                  rowHeight={resolvedRowHeight}
                  headerHeight={resolvedHeaderHeight}
                  width={containerSize.width}
                  height={containerSize.height}
                  onlineState={gridOnlineState}
                  selectionQueryState={queryState}
                  totalMatchingRows={totalMatchingRows}
                  onRenderedRowRangeChange={handleRenderedRowRangeChangeWithObservers}
                  initialScrollState={runtimeScrollState}
                  scrollRestorationKey={scrollRestorationKey}
                  onScrollPositionChange={handleScrollPositionChange}
                  shouldShowEmptyState={shouldShowEmptyState}
                  onEmptyStateReset={() => {
                    clearAllFilters()
                    setGlobalFilter("")
                  }}
                  bottomRightGridRef={scrollContainerRef}
                  onScrollbarWidthChange={setVerticalScrollbarWidth}
                  onScrollbarHeightChange={setHorizontalScrollbarWidth}
                  viewColumnsButtonWidth={showViewColumnsButton ? viewColumnsButtonWidth : 0}
                  verticalScrollbarWidth={verticalScrollbarWidth}
                  renderTrailingColumn={renderTrailingColumn}
                  virtualization={virtualization}
                  columnReordering={columnReordering}
                  selection={selection}
                  rowPresentation={rowPresentation}
                  keyboardNavigation={keyboardNavigation}
                  rowActions={rowActions}
                  rowIntent={rowIntent}
                  preview={preview}
                  debug={debug}
                />
              </GridErrorBoundary>
            )}

            {/* View Columns Button */}
            {showViewColumnsButton && containerSize.height > 0 && (
              <ViewColumnsButton
                headerHeight={resolvedHeaderHeight}
                rowHeight={resolvedRowHeight}
                visibleRowCount={filteredRowCount}
                width={viewColumnsButtonWidth}
                verticalScrollbarWidth={verticalScrollbarWidth}
                horizontalScrollbarWidth={horizontalScrollbarWidth}
              />
            )}

            {showBulkActionIsland && (
              <BulkActionIsland
                selectedCount={selectedCount}
                onClear={deselectAll}
                onTrigger={() => setIsBulkActionDialogOpen(true)}
                triggerLabel={bulkActions?.triggerLabel}
              />
            )}

            {preview && previewEnabled && previewDataRow && (
              <FloatingPreview
                open={true}
                rowId={previewDataRow.rowId}
                row={previewDataRow.row}
                onClose={() => setPreviewRow(null)}
                floating={preview.floating}
                anchorPoint={previewAnchorPoint}
                tableKey={preview.floating?.storageKey ?? tableKey}
                renderPreview={preview.renderPreview}
              />
            )}
          </div>
          {bulkActions && (
            <BulkActionDialog
              open={isBulkActionDialogOpen}
              onOpenChange={setIsBulkActionDialogOpen}
              actions={bulkActions.actions}
              selection={selectionDescriptor}
              selectedRowIds={selectedRowIds}
              selectedRows={selectedRows}
              selectedCount={selectedCount}
              onClearSelection={deselectAll}
              serverExecutor={bulkActions.serverExecutor}
            />
          )}
          {onlineQuery?.mode === "pagination" && (
            <div className="@container border-t">
              <div className="border-border flex flex-col gap-2 px-3 py-1.5 text-xs @[500px]:flex-row @[500px]:items-center @[500px]:justify-between">
                <div className="text-muted-foreground flex items-center justify-between gap-3 @[500px]:w-auto @[500px]:justify-start @[500px]:gap-4">
                  <label
                    className="flex items-center gap-2 whitespace-nowrap"
                    htmlFor={pageSizeSelectId}
                  >
                    <select
                      id={pageSizeSelectId}
                      value={String(onlineQuery.pageSize)}
                      onChange={(event) => onlineQuery.setPageSize(Number(event.target.value))}
                      className="border-input bg-background text-foreground h-7 rounded-md border px-2 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    >
                      {[10, 25, 50, 100].map((pageSize) => (
                        <option key={pageSize} value={pageSize}>
                          {pageSize}
                        </option>
                      ))}
                    </select>
                    <span>rows per page</span>
                  </label>
                  <span className="whitespace-nowrap">
                    {paginationSummary
                      ? `${formatNumber(paginationSummary.start)}-${formatNumber(paginationSummary.end)} of ${formatNumber(onlineQuery.totalRenderedRows)}`
                      : "0 rows"}
                  </span>
                </div>

                <Pagination className="mx-0 w-full @[500px]:w-auto">
                  <PaginationContent className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 @[500px]:flex @[500px]:w-auto @[500px]:gap-0.5">
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        aria-disabled={!onlineQuery.canPreviousPage || onlineQuery.isFetching}
                        tabIndex={
                          !onlineQuery.canPreviousPage || onlineQuery.isFetching ? -1 : undefined
                        }
                        onClick={(event) => {
                          event.preventDefault()
                          if (!onlineQuery.canPreviousPage || onlineQuery.isFetching) {
                            return
                          }

                          onlineQuery.setPageIndex(Math.max(0, onlineQuery.pageIndex - 1))
                        }}
                      />
                    </PaginationItem>

                    <PaginationItem className="justify-self-center @[500px]:justify-self-auto">
                      <div className="flex items-center justify-center gap-0.5">
                        {paginationRenderItems.map(({ item, itemIndex, key }) =>
                          item === "ellipsis" ? (
                            <SearchableDropdown
                              key={key}
                              open={openEllipsisIndex === itemIndex}
                              onOpenChange={(open) => setOpenEllipsisIndex(open ? itemIndex : null)}
                              items={getEllipsisPageOptions(paginationItems, itemIndex)}
                              getItemKey={(page) => String(page)}
                              renderItem={(page) => `Page ${page}`}
                              onSelect={(page) => {
                                if (onlineQuery.isFetching) {
                                  return
                                }

                                onlineQuery.setPageIndex(page - 1)
                              }}
                              filterFn={(page, search) =>
                                `${page}`.includes(search) ||
                                `page ${page}`.includes(search.toLowerCase())
                              }
                              searchPlaceholder="Jump to page..."
                              emptyText="No pages found"
                              align="center"
                              width="w-40 max-h-56"
                            >
                              <button
                                type="button"
                                aria-label="Jump to page"
                                className="hover:bg-accent hover:text-accent-foreground rounded transition-colors"
                              >
                                <PaginationEllipsis />
                              </button>
                            </SearchableDropdown>
                          ) : (
                            <PaginationLink
                              key={key}
                              href="#"
                              isActive={item === onlineQuery.pageIndex + 1}
                              onClick={(event) => {
                                event.preventDefault()
                                if (onlineQuery.isFetching) {
                                  return
                                }

                                onlineQuery.setPageIndex(item - 1)
                              }}
                            >
                              {item}
                            </PaginationLink>
                          ),
                        )}
                      </div>
                    </PaginationItem>

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        aria-disabled={!onlineQuery.canNextPage || onlineQuery.isFetching}
                        tabIndex={
                          !onlineQuery.canNextPage || onlineQuery.isFetching ? -1 : undefined
                        }
                        onClick={(event) => {
                          event.preventDefault()
                          if (!onlineQuery.canNextPage || onlineQuery.isFetching) {
                            return
                          }

                          onlineQuery.setPageIndex(onlineQuery.pageIndex + 1)
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </div>
          )}
        </div>
      </ColumnResizeSessionContext.Provider>
    </ColumnSizingContext.Provider>
  )
}
