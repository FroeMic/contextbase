import type { Modifier } from "@dnd-kit/core"
import { DndContext, DragOverlay } from "@dnd-kit/core"
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers"
import { horizontalListSortingStrategy, SortableContext } from "@dnd-kit/sortable"
import { useIsMobile } from "@/shared/hooks/use-mobile"
import type { Table } from "@tanstack/react-table"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDatatableResizeSession } from "../../core/ColumnResizeSessionContext"
import {
  createOnlineVirtualDataCellRenderer,
  createTanStackDataCellRenderer,
} from "../../core/cell-rendering/data-cell-renderer"
import { useCellMatrix } from "../../core/grid/use-cell-matrix"
import type { RenderedRowRange } from "../../core/loading/range-loader"
import type { DisplayRowModel } from "../../core/row-model/display-row-model"
import { createDisplayRowModel } from "../../core/row-model/display-row-model"
import { resolveRowPresentation } from "../../core/row-model/row-presentation"
import { createViewportLayout } from "../../core/viewport/create-viewport-layout"
import { PositionCache } from "../../core/viewport/position-cache"
import { useColumnReorderController } from "../../features/column-ordering/use-column-reorder-controller"
import { calculateVisibleGroupedCounts } from "../../features/grouping/group-expansion"
import { setDataRowStateAttribute } from "../../features/selection/dom-row-attributes"
import { SelectionGridCell } from "../../features/selection/SelectionGridCell"
import { SelectionGridHeaderCell } from "../../features/selection/SelectionGridHeaderCell"
import { resolveSelectAllAction } from "../../features/selection/select-all"
import {
  buildGridVisibleColumnOrder,
  DATATABLE_SELECTION_COLUMN_WIDTH,
  getEffectiveFrozenColumnsCount,
  isSelectionColumnId,
} from "../../features/selection/selection-columns"
import {
  shouldAutofocusInteractiveGrid,
  shouldHandleDocumentGridNavigation,
} from "../../features/selection/selection-focus"
import {
  getActiveItemKeyboardAction,
  getNextActivePreviewRowId,
  getNextActiveRowId,
  getShiftSelectionRangeRowIds,
} from "../../features/selection/selection-interactions"
import { isSelectionSelectAllShortcut } from "../../features/selection/selection-shortcuts"
import { shouldShowSelectionCheckbox } from "../../features/selection/selection-visibility"
import { cn } from "../../shared/utils/cn"
import { debug as debugLog } from "../../shared/utils/debug"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import type { DatatableColumn } from "../../types/column.types"
import type {
  DatatableColumnReorderingConfig,
  DatatableKeyboardNavigationConfig,
  DatatableRowActionsConfig,
  DatatableRowIntentConfig,
  DatatableRowPresentationConfig,
  DatatableRowPreviewConfig,
  DatatableRowSelectionConfig,
  DatatableVirtualizationConfig,
  OnlineGroupingSummary,
  OnlineQueryStateInput,
} from "../../types/props.types"
import type { RenderableRow } from "../../types/renderable-row.types"
import { EmptyState } from "../placeholders/EmptyState"
import { DraggedColumnOverlay } from "./DraggedColumnOverlay"
import { EngineGridRenderer } from "./EngineGridRenderer"
import { GridHeaderCell } from "./GridHeaderCell"
import { GridGroupHeader } from "./GridGroupHeader"
import { LoadingGridCell } from "./LoadingGridCell"
import { SortableGridHeaderCell } from "./SortableGridHeaderCell"

interface GridOnlineState {
  isEnabled: boolean
  mode: "infinite" | "pagination" | null
  isLoading: boolean
  isFetching: boolean
  isRefetching: boolean
  isFetchingNextPage: boolean
  totalDataRowCount: number
  totalRenderedRowCount: number
  groupingSummary?: OnlineGroupingSummary
}

interface VirtualizedGridProps<TData> {
  /** TanStack Table instance containing all table state and methods */
  table: Table<TData>

  /** Flat array of renderable rows including both data rows and group headers */
  renderableRows: RenderableRow<TData>[]

  rowModel?: DisplayRowModel<TData>

  /** Column definitions with metadata for rendering, filtering, and sorting */
  columns: DatatableColumn<TData>[]

  /** Height in pixels for each data row */
  rowHeight: number

  /** Height in pixels for the header row */
  headerHeight: number

  /** Height in pixels for group header rows (default: 44) */
  groupHeaderHeight?: number

  /** Container width in pixels for grid rendering */
  width: number

  /** Container height in pixels for grid rendering */
  height: number

  /** Online-mode rendering and scroll state (optional) */
  onlineState?: GridOnlineState
  selectionQueryState: OnlineQueryStateInput
  totalMatchingRows: number

  /** Callback fired when the grid's rendered row range changes */
  onRenderedRowRangeChange?: (range: RenderedRowRange) => void

  initialScrollState?: { scrollLeft: number; scrollTop: number }
  scrollRestorationKey?: string
  onScrollPositionChange?: (state: { scrollLeft: number; scrollTop: number }) => void

  /** Whether to show empty state in content area */
  shouldShowEmptyState?: boolean

  /** Callback when empty state reset button is clicked */
  onEmptyStateReset?: () => void

  /** Ref to the bottom-right grid for scrollbar measurement */
  bottomRightGridRef?: React.RefObject<HTMLDivElement | null>

  /** Callback when scrollbar width changes */
  onScrollbarWidthChange?: (width: number) => void

  /** Callback when scrollbar height changes */
  onScrollbarHeightChange?: (height: number) => void

  /** Width of the ViewColumnsButton to add as buffer to total width */
  viewColumnsButtonWidth?: number

  /** Width of vertical scrollbar (to account for in spacer calculation) */
  verticalScrollbarWidth?: number

  /**
   * When true (default), include the trailing gutter column for horizontal slack / view-columns.
   * @see DatatableProps.renderTrailingColumn
   */
  renderTrailingColumn?: boolean

  /** Viewport rendering policy */
  virtualization?: DatatableVirtualizationConfig

  /** Column drag and drop configuration */
  columnReordering?: DatatableColumnReorderingConfig

  /** Optional row-selection feature */
  selection?: DatatableRowSelectionConfig<TData>

  /** Optional row/cell presentation hooks */
  rowPresentation?: DatatableRowPresentationConfig<TData>
  keyboardNavigation?: DatatableKeyboardNavigationConfig
  rowActions?: DatatableRowActionsConfig<TData>
  rowIntent?: DatatableRowIntentConfig<TData>
  preview?: DatatableRowPreviewConfig<TData>
  debug?: boolean
}

function setHoveredRowAttributes(gridElement: HTMLElement, rowId: string | null) {
  setDataRowStateAttribute(gridElement, {
    attribute: "data-hovered",
    rowId,
    skipActive: true,
    skipSelected: true,
  })
}

function setActiveRowAttributes(gridElement: HTMLElement, rowId: string | null) {
  setDataRowStateAttribute(gridElement, {
    attribute: "data-active",
    rowId,
    skipSelected: true,
  })
}

function keepColumnOverlayPinnedToHeader(
  gridContainerRef: React.RefObject<HTMLDivElement | null>,
): Modifier {
  return ({ draggingNodeRect, transform }) => {
    const gridTop = gridContainerRef.current?.getBoundingClientRect().top
    if (!draggingNodeRect || gridTop === undefined) {
      return { ...transform, y: 0 }
    }

    return {
      ...transform,
      y: transform.y + gridTop - draggingNodeRect.top,
    }
  }
}

/**
 * Grid rendering using the next viewport engine
 *
 * This component:
 * 1. Builds row/column measurement caches
 * 2. Computes viewport layout via the headless engine
 * 3. Renders only pane-visible cells via EngineGridRenderer
 * 4. Handles frozen columns and header row without react-window
 *
 * Performance:
 * - Headless viewport math keeps rendering proportional to the viewport
 * - Memoized cell renderer
 * - Data-cell adapter keeps online virtual rendering off the global TanStack cell path
 */
export function VirtualizedGrid<TData>({
  table,
  renderableRows,
  rowModel,
  columns,
  rowHeight,
  headerHeight,
  groupHeaderHeight = 44,
  width,
  height,
  onlineState,
  selectionQueryState,
  totalMatchingRows,
  onRenderedRowRangeChange,
  initialScrollState,
  scrollRestorationKey,
  onScrollPositionChange,
  shouldShowEmptyState = false,
  onEmptyStateReset,
  bottomRightGridRef: externalBottomRightGridRef,
  onScrollbarWidthChange,
  onScrollbarHeightChange,
  viewColumnsButtonWidth = 0,
  verticalScrollbarWidth = 0,
  renderTrailingColumn = true,
  virtualization,
  columnReordering,
  selection,
  rowPresentation,
  keyboardNavigation,
  rowActions,
  rowIntent,
  preview,
  debug,
}: VirtualizedGridProps<TData>) {
  const isMobile = useIsMobile()
  // Get state from store
  const columnOrder = useDatatableStore((s) => s.columnOrder)
  const setColumnOrder = useDatatableStore((s) => s.setColumnOrder)
  const stickyColumnsCount = useDatatableStore((s) => s.stickyColumnsCount)
  const showColumnHeaders = useDatatableStore((s) => s.showColumnHeaders)
  const showHorizontalLines = false
  const showVerticalLines = false
  const groupExpanded = useDatatableStore((s) => s.groupExpanded)
  const toggleGroupExpanded = useDatatableStore((s) => s.toggleGroupExpanded)
  const rowSelection = useDatatableStore((s) => s.rowSelection)
  const setRowSelection = useDatatableStore((s) => s.setRowSelection)
  const setRowSelectionRange = useDatatableStore((s) => s.setRowSelectionRange)
  const selectAllMatching = useDatatableStore((s) => s.selectAllMatching)
  const toggleRowSelection = useDatatableStore((s) => s.toggleRowSelection)
  const deselectAll = useDatatableStore((s) => s.deselectAll)
  const setActiveRow = useDatatableStore((s) => s.setActiveRow)
  const setPreviewRow = useDatatableStore((s) => s.setPreviewRow)
  const activeRowId = useDatatableStore((s) => s.activeRowId)
  const previewRowId = useDatatableStore((s) => s.previewRowId)
  const { activeResizeSession } = useDatatableResizeSession()
  const selectionEnabled = selection?.enabled === true
  const selectionColumnVisible = selectionEnabled && selection?.showSelectionColumn !== false
  const selectionCheckboxesVisible = selection?.showCheckboxes !== false
  const previewEnabled = preview?.enabled ?? true
  const previewOpenOnClick = preview?.openOnClick ?? true
  const canRenderPreview = Boolean(preview && previewEnabled)
  const keyboardNavigationEnabled =
    keyboardNavigation?.enabled ?? Boolean(canRenderPreview || rowActions?.onOpenRow)
  const shouldAutofocusGrid =
    selectionEnabled || (keyboardNavigationEnabled && (keyboardNavigation?.autoFocus ?? true))
  const columnReorderingEnabled = !isMobile

  // Get live column sizing from table (includes in-progress resize)
  const columnSizing = table.getState().columnSizing
  const columnVisibility = table.getState().columnVisibility

  // Filter columns to only include visible ones, maintaining columnOrder
  // Note: Includes the spacer column to extend scrollable area for ViewColumnsButton
  const visibleColumns = useMemo(() => {
    // First filter by visibility (include spacer)
    const visible = columns.filter((col) => columnVisibility[col.id] !== false)

    // Then sort by columnOrder to maintain visual order (create new array to avoid mutation)
    return [...visible].sort((a, b) => {
      const indexA = columnOrder.indexOf(a.id)
      const indexB = columnOrder.indexOf(b.id)
      // Handle columns not in columnOrder (shouldn't happen, but defensive)
      if (indexA === -1) {
        return 1
      }
      if (indexB === -1) {
        return -1
      }
      return indexA - indexB
    })
  }, [columns, columnVisibility, columnOrder])

  // Use the resolved column definitions, not the raw persisted order. Persisted table state can
  // outlive removed domain columns; unknown IDs must not allocate ghost grid tracks.
  const visibleColumnOrder = useMemo(() => {
    return visibleColumns.map((column) => column.id)
  }, [visibleColumns])
  const renderedVisibleColumnOrder = useMemo(
    () => buildGridVisibleColumnOrder(visibleColumnOrder, selectionEnabled, selectionColumnVisible),
    [visibleColumnOrder, selectionEnabled, selectionColumnVisible],
  )
  const effectiveStickyColumnsCount = useMemo(
    () =>
      getEffectiveFrozenColumnsCount(stickyColumnsCount, selectionEnabled, selectionColumnVisible),
    [stickyColumnsCount, selectionEnabled, selectionColumnVisible],
  )

  // Ref to grid container for collision detection offset calculation
  const gridContainerRef = useRef<HTMLDivElement>(null)
  const gridKeyboardRootRef = useRef<HTMLDivElement | null>(null)

  // Ref to bottom-right scrollable grid for reading scroll offset
  // Always call useRef (Rules of Hooks), then use external ref if provided
  const localBottomRightGridRef = useRef<HTMLDivElement | null>(null)
  const bottomRightGridRef = externalBottomRightGridRef || localBottomRightGridRef

  // Ref for throttling infinite scroll
  const shouldScrollActiveRowIntoViewRef = useRef(false)
  const ownsDocumentNavigationRef = useRef(false)
  const hoveredDomRowRef = useRef<string | null>(null)
  const activeDomRowRef = useRef<string | null>(activeRowId)
  const activeCommitFrameRef = useRef<number | null>(null)
  const committedActiveRowRef = useRef<string | null>(activeRowId)
  const previewRowIdRef = useRef<string | null>(previewRowId)
  previewRowIdRef.current = previewRowId

  // Constants
  const requestedRenderMode = virtualization?.mode ?? "viewport"
  const renderMode = onlineState?.mode === "infinite" ? "viewport" : requestedRenderMode
  const shouldShowRefetchOverlay =
    onlineState?.isRefetching === true && !onlineState.isLoading && onlineState.mode !== "infinite"

  const loadedDataRowCount = useMemo(() => {
    return renderableRows.filter((row) => row.type === "data").length
  }, [renderableRows])

  useEffect(() => {
    const gridElement = gridKeyboardRootRef.current
    if (!gridElement || typeof document === "undefined") {
      return
    }

    if (
      !shouldAutofocusInteractiveGrid({
        interactionEnabled: shouldAutofocusGrid,
        activeElement: document.activeElement,
        gridElement,
      })
    ) {
      return
    }

    const focusId = window.requestAnimationFrame(() => {
      gridElement.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(focusId)
  }, [shouldAutofocusGrid])

  const visibleGroupedCounts = useMemo(
    () => calculateVisibleGroupedCounts(onlineState?.groupingSummary, groupExpanded),
    [groupExpanded, onlineState?.groupingSummary],
  )

  const estimatedTotalRowCount = useMemo(() => {
    if (!onlineState?.isEnabled || onlineState.mode !== "infinite") {
      return renderableRows.length
    }

    if (visibleGroupedCounts) {
      return Math.max(renderableRows.length, visibleGroupedCounts.totalRenderedRows)
    }

    if (onlineState.totalRenderedRowCount > 0) {
      return Math.max(renderableRows.length, onlineState.totalRenderedRowCount)
    }

    return Math.max(renderableRows.length, onlineState.totalDataRowCount)
  }, [onlineState, renderableRows, visibleGroupedCounts])

  const targetDataRows = useMemo(
    () =>
      visibleGroupedCounts?.totalDataRows ?? onlineState?.totalDataRowCount ?? loadedDataRowCount,
    [loadedDataRowCount, onlineState?.totalDataRowCount, visibleGroupedCounts?.totalDataRows],
  )

  const remainingDataRows = useMemo(
    () =>
      onlineState?.isEnabled && onlineState.mode === "infinite"
        ? Math.max(0, targetDataRows - loadedDataRowCount)
        : 0,
    [loadedDataRowCount, onlineState?.isEnabled, onlineState?.mode, targetDataRows],
  )

  const displayRowModel = useMemo(() => {
    if (rowModel) {
      return rowModel
    }

    return createDisplayRowModel({
      renderableRows,
      showColumnHeaders,
      rowHeight,
      headerHeight,
      groupHeaderHeight,
      bodyRowCount: estimatedTotalRowCount,
      unloadedDataRowCount: remainingDataRows,
    })
  }, [
    estimatedTotalRowCount,
    groupHeaderHeight,
    headerHeight,
    remainingDataRows,
    renderableRows,
    rowHeight,
    rowModel,
    showColumnHeaders,
  ])

  // Reset scroll on filter change (online mode only)
  const columnFilters = useDatatableStore((s) => s.columnFilters)
  const globalFilter = useDatatableStore((s) => s.globalFilter)
  const queryResetSignature = useMemo(
    // Sort changes should not force vertical reset.
    () => JSON.stringify([columnFilters, globalFilter]),
    [columnFilters, globalFilter],
  )

  const previousQueryResetSignatureRef = useRef(queryResetSignature)

  useEffect(() => {
    const previousQueryResetSignature = previousQueryResetSignatureRef.current
    previousQueryResetSignatureRef.current = queryResetSignature

    if (previousQueryResetSignature === queryResetSignature) {
      return
    }

    if (!bottomRightGridRef.current || !onlineState?.isEnabled) {
      return
    }

    // Use setTimeout to ensure element is available (same as infinite scroll setup)
    const timer = setTimeout(() => {
      const gridRef = bottomRightGridRef.current
      if (!gridRef) {
        return
      }

      gridRef.scrollTop = 0
    }, 0)

    return () => clearTimeout(timer)
    // Only reset on filter/search changes, not on sorting, pagination state, or mode changes.
  }, [bottomRightGridRef, onlineState?.isEnabled, queryResetSignature])

  const shouldUseOnlineVirtualCellRenderer = onlineState?.mode === "infinite"
  // Build TanStack cells only for modes that still render through TanStack row/cell objects.
  const cellMatrix = useCellMatrix(table, !shouldUseOnlineVirtualCellRenderer)
  const dataCellRenderer = useMemo(
    () =>
      shouldUseOnlineVirtualCellRenderer
        ? createOnlineVirtualDataCellRenderer({ table })
        : createTanStackDataCellRenderer({ cellMatrix }),
    [cellMatrix, shouldUseOnlineVirtualCellRenderer, table],
  )
  const triggerRowIntent = useCallback(
    (rowId: string | null, trigger: "keyboard" | "pointer") => {
      if (!rowId || !rowIntent?.onRowIntent) {
        return
      }

      const row = displayRowModel.getDataRowById(rowId)
      if (!row) {
        return
      }

      void rowIntent.onRowIntent({
        row: row.data,
        rowId,
        trigger,
      })
    },
    [displayRowModel, rowIntent],
  )

  // Column width getter - reads from table sizing state (live during resize)
  const getColumnWidth = useCallback(
    (columnId: string) => {
      if (activeResizeSession?.columnId === columnId) {
        return activeResizeSession.previewWidth
      }

      return columnSizing[columnId] ?? visibleColumns.find((c) => c.id === columnId)?.width ?? 150
    },
    [activeResizeSession, columnSizing, visibleColumns],
  )

  // Cleanup cursor on unmount (in case component unmounts during drag)
  useEffect(() => {
    return () => {
      document.body.style.cursor = ""
    }
  }, [])

  const {
    activeId,
    sourceIndex,
    targetIndex,
    displayedColumnSlots,
    displayedColumnWidths,
    totalDisplayedColumnsWidth,
    previewVisibleColumnSlots,
    overlayWidth,
    handleDragStart,
    handleDragMove,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    collisionDetection,
    sensors: dndSensors,
  } = useColumnReorderController({
    visibleColumnOrder,
    columnOrder,
    columnVisibility,
    stickyColumnsCount,
    allowFrozenBoundaryCrossing: columnReordering?.allowFrozenBoundaryCrossing ?? false,
    widthMorph: columnReordering?.widthMorph ?? "none",
    getColumnWidth,
    gridContainerRef,
    scrollContainerRef: bottomRightGridRef,
    setColumnOrder,
  })
  const columnDragOverlayModifiers = useMemo(
    () => [restrictToHorizontalAxis, keepColumnOverlayPinnedToHeader(gridContainerRef)],
    [],
  )
  const renderedDisplayedColumnSlots = useMemo(
    () =>
      buildGridVisibleColumnOrder(displayedColumnSlots, selectionEnabled, selectionColumnVisible),
    [displayedColumnSlots, selectionEnabled, selectionColumnVisible],
  )
  const renderedPreviewVisibleColumnSlots = useMemo(
    () =>
      buildGridVisibleColumnOrder(
        previewVisibleColumnSlots,
        selectionEnabled,
        selectionColumnVisible,
      ),
    [previewVisibleColumnSlots, selectionEnabled, selectionColumnVisible],
  )
  const shouldFreezeHeaderPreviewAcrossSeam = useMemo(() => {
    if (
      !activeId ||
      sourceIndex === null ||
      targetIndex === null ||
      effectiveStickyColumnsCount <= 0
    ) {
      return false
    }

    const sourceInFrozenPane = sourceIndex < effectiveStickyColumnsCount
    const targetInFrozenPane = targetIndex < effectiveStickyColumnsCount
    return sourceInFrozenPane !== targetInFrozenPane
  }, [activeId, effectiveStickyColumnsCount, sourceIndex, targetIndex])
  const renderedHeaderVisibleColumnSlots = useMemo(
    () =>
      shouldFreezeHeaderPreviewAcrossSeam
        ? renderedVisibleColumnOrder
        : renderedPreviewVisibleColumnSlots,
    [
      renderedPreviewVisibleColumnSlots,
      renderedVisibleColumnOrder,
      shouldFreezeHeaderPreviewAcrossSeam,
    ],
  )
  const renderedDisplayedColumnWidths = useMemo(
    () =>
      selectionColumnVisible
        ? [DATATABLE_SELECTION_COLUMN_WIDTH, ...displayedColumnWidths]
        : displayedColumnWidths,
    [displayedColumnWidths, selectionColumnVisible],
  )
  const totalRenderedColumnsWidth = useMemo(
    () =>
      totalDisplayedColumnsWidth + (selectionColumnVisible ? DATATABLE_SELECTION_COLUMN_WIDTH : 0),
    [selectionColumnVisible, totalDisplayedColumnsWidth],
  )
  const orderedDataRows = displayRowModel.orderedDataRows
  const orderedDataRowIds = useMemo(
    () => orderedDataRows.map((row) => row.rowId),
    [orderedDataRows],
  )
  const orderedActiveItems = displayRowModel.orderedActiveItems
  const orderedActiveItemIds = useMemo(
    () => orderedActiveItems.map((item) => item.id),
    [orderedActiveItems],
  )
  const orderedActiveItemsById = useMemo(
    () => new Map(orderedActiveItems.map((item) => [item.id, item])),
    [orderedActiveItems],
  )
  const orderedSelectableRowIds = useMemo(() => {
    if (!selection?.getRowCanSelect) {
      return orderedDataRowIds
    }

    return orderedDataRows
      .filter((row) => selection.getRowCanSelect?.(row.data) !== false)
      .map((row) => row.rowId)
  }, [orderedDataRowIds, orderedDataRows, selection])
  const selectedRowIds = useMemo(
    () =>
      rowSelection.kind === "allMatching"
        ? new Set(orderedSelectableRowIds.filter((rowId) => !rowSelection.excludedIds[rowId]))
        : new Set([...Object.keys(rowSelection.ids), ...Object.keys(rowSelection.rangeRowIds)]),
    [orderedSelectableRowIds, rowSelection],
  )
  const areAllLoadedSelectableRowsSelected =
    orderedSelectableRowIds.length > 0 &&
    orderedSelectableRowIds.every((rowId) => selectedRowIds.has(rowId))
  const areSomeLoadedSelectableRowsSelected = orderedSelectableRowIds.some((rowId) =>
    selectedRowIds.has(rowId),
  )

  const cancelActiveRowCommit = useCallback(() => {
    if (activeCommitFrameRef.current === null || typeof window === "undefined") {
      activeCommitFrameRef.current = null
      return
    }

    window.cancelAnimationFrame(activeCommitFrameRef.current)
    activeCommitFrameRef.current = null
  }, [])

  const applyActiveRow = useCallback(
    (
      rowId: string | null,
      options: {
        deferCommit?: boolean
        followPreview?: boolean
        intentTrigger?: "keyboard"
        scrollIntoView?: boolean
      } = {},
    ) => {
      activeDomRowRef.current = rowId
      if (options.intentTrigger) {
        triggerRowIntent(rowId, options.intentTrigger)
      }
      shouldScrollActiveRowIntoViewRef.current = options.scrollIntoView === true && rowId !== null

      const gridElement = gridKeyboardRootRef.current
      if (gridElement) {
        setActiveRowAttributes(gridElement, rowId)
        setHoveredRowAttributes(gridElement, hoveredDomRowRef.current)
      }

      if (!options.deferCommit || typeof window === "undefined") {
        cancelActiveRowCommit()
        committedActiveRowRef.current = rowId
        setActiveRow(rowId)
        if (options.followPreview) {
          const nextActiveItem = rowId ? (orderedActiveItemsById.get(rowId) ?? null) : null
          const nextPreviewRowId = getNextActivePreviewRowId({
            previewRowId: previewRowIdRef.current,
            nextActiveItemId: nextActiveItem?.id ?? null,
            nextActiveItemKind: nextActiveItem?.kind ?? null,
          })

          if (previewRowIdRef.current !== nextPreviewRowId) {
            previewRowIdRef.current = nextPreviewRowId
            setPreviewRow(nextPreviewRowId)
          }
        }
        return
      }

      cancelActiveRowCommit()
      activeCommitFrameRef.current = window.requestAnimationFrame(() => {
        activeCommitFrameRef.current = null
        const rowIdToCommit = activeDomRowRef.current

        if (committedActiveRowRef.current === rowIdToCommit) {
          return
        }

        committedActiveRowRef.current = rowIdToCommit
        setActiveRow(rowIdToCommit)

        if (options.followPreview) {
          const nextActiveItem = rowIdToCommit
            ? (orderedActiveItemsById.get(rowIdToCommit) ?? null)
            : null
          const nextPreviewRowId = getNextActivePreviewRowId({
            previewRowId: previewRowIdRef.current,
            nextActiveItemId: nextActiveItem?.id ?? null,
            nextActiveItemKind: nextActiveItem?.kind ?? null,
          })

          if (previewRowIdRef.current !== nextPreviewRowId) {
            previewRowIdRef.current = nextPreviewRowId
            setPreviewRow(nextPreviewRowId)
          }
        }
      })
    },
    [cancelActiveRowCommit, orderedActiveItemsById, setActiveRow, setPreviewRow, triggerRowIntent],
  )

  const handleSelectionToggle = useCallback(
    ({ rowId, shiftKey }: { rowId: string; shiftKey: boolean }) => {
      ownsDocumentNavigationRef.current = true
      applyActiveRow(rowId)

      if (rowSelection.kind === "allMatching") {
        toggleRowSelection(rowId)
        return
      }

      if (shiftKey && rowSelection.lastSingleSelectedRowId) {
        const rangeRowIds = getShiftSelectionRangeRowIds({
          orderedRowIds: orderedSelectableRowIds,
          anchorRowId: rowSelection.lastSingleSelectedRowId,
          targetRowId: rowId,
        })

        if (rangeRowIds.length > 0) {
          setRowSelectionRange({
            anchorRowId: rowSelection.lastSingleSelectedRowId,
            rowIds: rangeRowIds,
          })
          return
        }
      }

      toggleRowSelection(rowId)
    },
    [
      applyActiveRow,
      orderedSelectableRowIds,
      rowSelection,
      setRowSelectionRange,
      toggleRowSelection,
    ],
  )

  const handleHeaderSelectionToggle = useCallback(() => {
    if (areAllLoadedSelectableRowsSelected) {
      deselectAll()
      return
    }

    const action = resolveSelectAllAction({
      currentSelection: rowSelection,
      allowSelectAllMatching: selection?.allowSelectAllMatching === true,
      orderedSelectableRowIds,
      query: selectionQueryState,
      totalMatchingRows,
    })

    if (action.action === "deselect") {
      deselectAll()
      return
    }

    if (action.action === "selectAllMatching") {
      selectAllMatching({
        query: action.query,
        totalMatchingRows: action.totalMatchingRows,
      })
      return
    }

    setRowSelection({
      kind: "explicit",
      ids: action.ids,
      rangeRowIds: {},
      lastSingleSelectedRowId: action.lastSingleSelectedRowId,
    })
  }, [
    areAllLoadedSelectableRowsSelected,
    deselectAll,
    orderedSelectableRowIds,
    rowSelection,
    selectAllMatching,
    selection?.allowSelectAllMatching,
    selectionQueryState,
    setRowSelection,
    totalMatchingRows,
  ])

  const moveActiveRow = useCallback(
    (direction: "next" | "previous") => {
      const currentRowId = activeDomRowRef.current ?? activeRowId ?? hoveredDomRowRef.current
      const nextActiveRowId = getNextActiveRowId({
        orderedRowIds: orderedActiveItemIds,
        currentRowId,
        direction,
      })

      ownsDocumentNavigationRef.current = true
      applyActiveRow(nextActiveRowId, {
        deferCommit: true,
        followPreview: true,
        intentTrigger: "keyboard",
        scrollIntoView: true,
      })
    },
    [activeRowId, applyActiveRow, orderedActiveItemIds],
  )

  const activatePreviewRow = useCallback(
    (
      rowId: string,
      trigger: "keyboard" | "mouse" = "keyboard",
      anchorPoint?: { x: number; y: number },
    ) => {
      const row = displayRowModel.getDataRowById(rowId)
      if (!row) {
        return false
      }

      ownsDocumentNavigationRef.current = true
      applyActiveRow(rowId)
      setPreviewRow(rowId, anchorPoint)
      void rowActions?.onTogglePreviewRow?.({
        row: row.data,
        rowId,
        trigger,
        nextOpen: true,
      })
      return true
    },
    [applyActiveRow, displayRowModel, rowActions, setPreviewRow],
  )

  const handleGridKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) {
        return
      }

      if (
        isSelectionSelectAllShortcut({
          key: event.key,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          selectionEnabled,
        })
      ) {
        event.preventDefault()
        handleHeaderSelectionToggle()
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      const currentActiveRowId = activeDomRowRef.current ?? activeRowId

      if (keyboardNavigationEnabled && event.key === "ArrowDown") {
        event.preventDefault()
        moveActiveRow("next")
        return
      }

      if (keyboardNavigationEnabled && event.key === "ArrowUp") {
        event.preventDefault()
        moveActiveRow("previous")
        return
      }

      if (
        keyboardNavigationEnabled &&
        !currentActiveRowId &&
        (event.key === " " || event.key === "Space") &&
        hoveredDomRowRef.current &&
        canRenderPreview
      ) {
        if (activatePreviewRow(hoveredDomRowRef.current, "keyboard")) {
          event.preventDefault()
          return
        }
      }

      const activeItem = currentActiveRowId
        ? (orderedActiveItemsById.get(currentActiveRowId) ?? null)
        : null
      const rowKeyboardAction = getActiveItemKeyboardAction({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        keyboardNavigationEnabled,
        activeItemId: activeItem?.id ?? null,
        activeItemKind: activeItem?.kind ?? null,
        previewRowId,
        canOpenRow: Boolean(rowActions?.onOpenRow),
        canTogglePreview: canRenderPreview,
      })

      if (rowKeyboardAction?.type === "open-row") {
        event.preventDefault()
        const row = displayRowModel.getDataRowById(rowKeyboardAction.rowId)
        if (row) {
          void rowActions?.onOpenRow?.({
            row: row.data,
            rowId: row.rowId,
            trigger: "keyboard",
          })
        }
        return
      }

      if (rowKeyboardAction?.type === "toggle-group") {
        event.preventDefault()
        toggleGroupExpanded(rowKeyboardAction.groupId)
        return
      }

      if (rowKeyboardAction?.type === "toggle-preview-row") {
        event.preventDefault()
        const row = displayRowModel.getDataRowById(rowKeyboardAction.rowId)
        setPreviewRow(rowKeyboardAction.nextPreviewRowId)
        if (row) {
          void rowActions?.onTogglePreviewRow?.({
            row: row.data,
            rowId: row.rowId,
            trigger: "keyboard",
            nextOpen: rowKeyboardAction.nextPreviewRowId !== null,
          })
        }
        return
      }

      if (event.key === "Escape") {
        if (previewRowId) {
          event.preventDefault()
          setPreviewRow(null)
          return
        }

        if (selectedRowIds.size > 0) {
          event.preventDefault()
          deselectAll()
          return
        }

        if (currentActiveRowId) {
          event.preventDefault()
          applyActiveRow(null)
        }
      }
    },
    [
      activeRowId,
      activatePreviewRow,
      deselectAll,
      handleHeaderSelectionToggle,
      keyboardNavigationEnabled,
      moveActiveRow,
      orderedActiveItemsById,
      displayRowModel,
      previewRowId,
      canRenderPreview,
      rowActions,
      selectedRowIds.size,
      selectionEnabled,
      applyActiveRow,
      setPreviewRow,
      toggleGroupExpanded,
    ],
  )

  useEffect(() => {
    if (!keyboardNavigationEnabled || typeof document === "undefined") {
      return
    }

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return
      }

      const gridElement = gridKeyboardRootRef.current
      const hoveredDomRowId = hoveredDomRowRef.current
      const currentActiveRowId = activeDomRowRef.current ?? activeRowId
      const isSpaceKey = event.key === " " || event.key === "Space"
      if (
        !shouldHandleDocumentGridNavigation({
          key: event.key,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          keyboardNavigationEnabled,
          hasNavigationAnchor: ownsDocumentNavigationRef.current || currentActiveRowId !== null,
          hasHoveredRowAnchor:
            hoveredDomRowId !== null && (!isSpaceKey || (!currentActiveRowId && canRenderPreview)),
          target: event.target,
          gridElement,
        })
      ) {
        return
      }

      event.preventDefault()
      if (isSpaceKey) {
        if (hoveredDomRowId) {
          activatePreviewRow(hoveredDomRowId, "keyboard")
        }
        return
      }

      moveActiveRow(event.key === "ArrowDown" ? "next" : "previous")
    }

    document.addEventListener("keydown", handleDocumentKeyDown)
    return () => document.removeEventListener("keydown", handleDocumentKeyDown)
  }, [activeRowId, activatePreviewRow, canRenderPreview, keyboardNavigationEnabled, moveActiveRow])

  const hasTrailingRemainderGutter = viewColumnsButtonWidth > 0 || renderTrailingColumn
  const totalColumns = renderedVisibleColumnOrder.length + (hasTrailingRemainderGutter ? 1 : 0)
  const totalRows = displayRowModel.rowCount
  const fullRenderRowCount = useMemo(() => renderableRows.length, [renderableRows.length])
  const fullRenderColumnCount = useMemo(() => totalColumns, [totalColumns])
  const visibleRowEstimate = Math.max(
    1,
    Math.ceil(
      Math.max(height - (showColumnHeaders ? headerHeight : 0), 0) / Math.max(rowHeight, 1),
    ),
  )
  const averageVisibleColumnWidth =
    renderedDisplayedColumnSlots.length > 0
      ? totalRenderedColumnsWidth / renderedDisplayedColumnSlots.length
      : 150
  const visibleColumnEstimate = Math.max(
    1,
    Math.ceil(width / Math.max(averageVisibleColumnWidth, 1)),
  )
  const rowOverscanCount =
    virtualization?.rowOverscanCount ??
    Math.min(40, Math.max(32, Math.ceil(visibleRowEstimate * 1.5)))
  const columnOverscanCount =
    virtualization?.columnOverscanCount ??
    Math.min(24, Math.max(8, Math.ceil(visibleColumnEstimate * 1.5)))

  const getColumnWidthByIndex = useCallback(
    (index: number) => {
      const availableWidth = width - verticalScrollbarWidth

      if (index === renderedDisplayedColumnSlots.length) {
        const remainingSpace = availableWidth - totalRenderedColumnsWidth
        const minGutterWidth = viewColumnsButtonWidth > 0 ? viewColumnsButtonWidth : 0
        return Math.max(minGutterWidth, remainingSpace)
      }

      return renderedDisplayedColumnWidths[index] ?? 150
    },
    [
      renderedDisplayedColumnSlots.length,
      renderedDisplayedColumnWidths,
      width,
      totalRenderedColumnsWidth,
      viewColumnsButtonWidth,
      verticalScrollbarWidth,
    ],
  )

  const rowCache = useMemo(
    () =>
      new PositionCache({
        count: totalRows,
        defaultSize: rowHeight,
        getSizeAt: (index) => displayRowModel.getRowHeight(index),
      }),
    [displayRowModel, rowHeight, totalRows],
  )

  const columnCache = useMemo(
    () =>
      new PositionCache({
        count: totalColumns,
        defaultSize: 150,
        getSizeAt: (index) => getColumnWidthByIndex(index),
      }),
    [getColumnWidthByIndex, totalColumns],
  )

  const [scrollState, setScrollState] = useState(
    () => initialScrollState ?? { scrollLeft: 0, scrollTop: 0 },
  )

  const activeGridRowIndex = useMemo(() => {
    if (!activeRowId) {
      return null
    }

    return displayRowModel.getIndexByRowId(activeRowId)
  }, [activeRowId, displayRowModel])

  useEffect(() => {
    committedActiveRowRef.current = activeRowId
    activeDomRowRef.current = activeRowId

    const gridElement = gridKeyboardRootRef.current
    if (!gridElement) {
      return
    }

    setActiveRowAttributes(gridElement, activeRowId)
    setHoveredRowAttributes(gridElement, hoveredDomRowRef.current)
  }, [activeRowId])

  useEffect(() => () => cancelActiveRowCommit(), [cancelActiveRowCommit])

  useEffect(() => {
    const gridElement = gridKeyboardRootRef.current
    if (!gridElement) {
      return
    }

    const updateHoveredRow = (rowId: string | null) => {
      if (hoveredDomRowRef.current === rowId) {
        return
      }

      hoveredDomRowRef.current = rowId
      setHoveredRowAttributes(gridElement, rowId)
      triggerRowIntent(rowId, "pointer")

      if (
        preview?.followRowHoverWhenOpen &&
        previewRowIdRef.current &&
        rowId &&
        rowId !== previewRowIdRef.current
      ) {
        activatePreviewRow(rowId, "mouse")
      }
    }

    const handlePointerOver = (event: PointerEvent) => {
      const target = event.target as Element | null
      const rowElement = target?.closest?.("[data-row-id]") as HTMLElement | null
      updateHoveredRow(
        rowElement && gridElement.contains(rowElement)
          ? rowElement.getAttribute("data-row-id")
          : null,
      )
    }

    const handlePointerLeave = () => {
      updateHoveredRow(null)
    }

    gridElement.addEventListener("pointerover", handlePointerOver)
    gridElement.addEventListener("pointerleave", handlePointerLeave)

    return () => {
      gridElement.removeEventListener("pointerover", handlePointerOver)
      gridElement.removeEventListener("pointerleave", handlePointerLeave)
      setHoveredRowAttributes(gridElement, null)
      hoveredDomRowRef.current = null
    }
  }, [activatePreviewRow, preview?.followRowHoverWhenOpen, triggerRowIntent])

  useEffect(() => {
    if (
      !keyboardNavigationEnabled ||
      activeGridRowIndex === null ||
      !shouldScrollActiveRowIntoViewRef.current
    ) {
      return
    }

    shouldScrollActiveRowIntoViewRef.current = false
    const scrollElement = bottomRightGridRef.current
    if (!scrollElement) {
      return
    }

    const frozenHeaderHeight = showColumnHeaders ? headerHeight : 0
    const rowTop = rowCache.getOffset(activeGridRowIndex) - frozenHeaderHeight
    const rowBottom = rowTop + rowCache.getSizeAt(activeGridRowIndex)
    const visibleBodyHeight = Math.max(scrollElement.clientHeight - frozenHeaderHeight, 0)
    const viewportTop = scrollElement.scrollTop
    const viewportBottom = viewportTop + visibleBodyHeight

    if (rowTop < viewportTop) {
      scrollElement.scrollTop = rowTop
      return
    }

    if (rowBottom > viewportBottom) {
      scrollElement.scrollTop = rowBottom - visibleBodyHeight
    }
  }, [
    activeGridRowIndex,
    bottomRightGridRef,
    headerHeight,
    keyboardNavigationEnabled,
    rowCache,
    showColumnHeaders,
  ])

  const viewportLayout = useMemo(
    () =>
      createViewportLayout({
        rowCache,
        columnCache,
        viewport: {
          scrollLeft: scrollState.scrollLeft,
          scrollTop: scrollState.scrollTop,
          width,
          height,
        },
        frozenRowsCount: showColumnHeaders ? 1 : 0,
        frozenColumnsCount: effectiveStickyColumnsCount,
        renderMode,
        fullRenderRowCount,
        fullRenderColumnCount,
        rowOverscanCount,
        columnOverscanCount,
      }),
    [
      columnCache,
      columnOverscanCount,
      fullRenderColumnCount,
      fullRenderRowCount,
      height,
      renderMode,
      rowCache,
      rowOverscanCount,
      scrollState.scrollLeft,
      scrollState.scrollTop,
      showColumnHeaders,
      effectiveStickyColumnsCount,
      width,
    ],
  )

  useEffect(() => {
    if (!debug) {
      return
    }

    const renderedRange = viewportLayout.rows.rendered
    const rowCounts = { data: 0, group: 0, loading: 0, missing: 0 }
    if (renderedRange) {
      for (
        let rowIndex = renderedRange.startIndex;
        rowIndex <= renderedRange.endIndex;
        rowIndex += 1
      ) {
        const row = displayRowModel.getRenderableRowAt(rowIndex)
        if (!row) {
          rowCounts.missing += 1
        } else if (row.type === "data") {
          rowCounts.data += 1
        } else if (row.type === "group-header") {
          rowCounts.group += 1
        } else {
          rowCounts.loading += 1
        }
      }
    }

    const renderedRowCount = renderedRange
      ? renderedRange.endIndex - renderedRange.startIndex + 1
      : 0
    const renderedColumnRange = viewportLayout.columns.rendered
    const renderedColumnCount = renderedColumnRange
      ? renderedColumnRange.endIndex - renderedColumnRange.startIndex + 1
      : 0

    debugLog("grid commit", {
      mode: onlineState?.mode ?? "local",
      renderMode,
      scrollTop: scrollState.scrollTop,
      rows: {
        visible: viewportLayout.rows.visible,
        rendered: renderedRange,
        overscan: rowOverscanCount,
        counts: rowCounts,
        total: totalRows,
      },
      columns: {
        visible: viewportLayout.columns.visible,
        rendered: renderedColumnRange,
        overscan: columnOverscanCount,
        total: totalColumns,
      },
      estimatedRenderedCells: renderedRowCount * renderedColumnCount,
      loadedRows: displayRowModel.loadedRowCount,
      online: onlineState
        ? {
            isFetching: onlineState.isFetching,
            isRefetching: onlineState.isRefetching,
            totalDataRows: onlineState.totalDataRowCount,
            totalRenderedRows: onlineState.totalRenderedRowCount,
          }
        : undefined,
    })
  }, [
    columnOverscanCount,
    debug,
    displayRowModel,
    onlineState,
    renderMode,
    rowOverscanCount,
    scrollState.scrollTop,
    totalColumns,
    totalRows,
    viewportLayout,
  ])

  const hasWarnedAboutFullModeRef = useRef(false)

  useEffect(() => {
    if (!import.meta.env?.DEV || renderMode !== "full" || hasWarnedAboutFullModeRef.current) {
      return
    }

    const mountedCellEstimate = estimatedTotalRowCount * totalColumns
    if (mountedCellEstimate <= 20000) {
      return
    }

    hasWarnedAboutFullModeRef.current = true
    console.warn(
      `[Datatable] virtualization.mode="full" is mounting approximately ${mountedCellEstimate} cells. Use only for bounded datasets or debugging.`,
    )
  }, [estimatedTotalRowCount, renderMode, totalColumns])

  const renderCell = useCallback(
    ({
      columnIndex,
      rowIndex,
      x,
      y,
      width: cellWidth,
      height: cellHeight,
    }: {
      columnIndex: number
      rowIndex: number
      x: number
      y: number
      width: number
      height: number
    }) => {
      // Spacer column (virtual column at the end) — absorbs horizontal slack; not a real gridcell.
      if (columnIndex === renderedPreviewVisibleColumnSlots.length) {
        const isHeaderSpacer = showColumnHeaders && rowIndex === 0
        const spacerHorizontalBottom = isHeaderSpacer
          ? showHorizontalLines && !showColumnHeaders
          : showHorizontalLines

        if (isHeaderSpacer) {
          return (
            <div
              key={`spacer-${rowIndex}`}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: cellWidth,
                height: cellHeight,
                pointerEvents: "none",
                boxSizing: "border-box",
                backgroundColor: "var(--background)",
                borderBottom: spacerHorizontalBottom
                  ? "1px solid var(--border)"
                  : "1px solid transparent",
              }}
              aria-hidden="true"
            />
          )
        }

        const spacerRow = displayRowModel.getRenderableRowAt(rowIndex)
        if (!spacerRow || spacerRow.type === "group-header" || spacerRow.type === "loading") {
          return (
            <div
              key={`spacer-${rowIndex}`}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: cellWidth,
                height: cellHeight,
                pointerEvents: "none",
                boxSizing: "border-box",
                backgroundColor: "var(--background)",
                borderBottom: spacerHorizontalBottom
                  ? "1px solid var(--border)"
                  : "1px solid transparent",
              }}
              aria-hidden="true"
            />
          )
        }

        const trailingPresentationColumnId =
          renderedPreviewVisibleColumnSlots[renderedPreviewVisibleColumnSlots.length - 1] ??
          "__trailing__"
        const isSpacerSelected = selectedRowIds.has(spacerRow.rowId)
        const isSpacerActive = activeRowId === spacerRow.rowId
        const isSpacerPreviewOpen = previewRowId === spacerRow.rowId
        const spacerPresentation = resolveRowPresentation({
          rowPresentation,
          row: spacerRow.data,
          rowId: spacerRow.rowId,
          columnId: trailingPresentationColumnId,
          isSelected: isSpacerSelected,
          isActive: isSpacerActive,
          isPreviewOpen: isSpacerPreviewOpen,
        })

        return (
          <div
            key={`spacer-${rowIndex}-${spacerRow.rowId}`}
            aria-hidden="true"
            className={cn(
              "bg-transparent text-sm leading-5 md:text-xs md:leading-4",
              spacerPresentation.className,
            )}
            data-row-id={spacerRow.rowId}
            data-selected={isSpacerSelected || undefined}
            data-active={isSpacerActive || undefined}
            data-preview-open={isSpacerPreviewOpen || undefined}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: cellWidth,
              height: cellHeight,
              pointerEvents: "none",
              boxSizing: "border-box",
              borderBottom: spacerHorizontalBottom
                ? "1px solid var(--border)"
                : "1px solid transparent",
            }}
            {...spacerPresentation.attributes}
          />
        )
      }

      // Map columnIndex to actual column ID using visible column order (respects columnVisibility)
      const slotColumnId =
        showColumnHeaders && rowIndex === 0
          ? renderedHeaderVisibleColumnSlots[columnIndex]
          : renderedPreviewVisibleColumnSlots[columnIndex]

      if (!slotColumnId) {
        return (
          <div
            key={`column-gap-${rowIndex}-${columnIndex}`}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: cellWidth,
              height: cellHeight,
              boxSizing: "border-box",
              backgroundColor: "var(--background)",
              borderRight:
                showVerticalLines && columnIndex !== effectiveStickyColumnsCount - 1
                  ? "1px dashed var(--border)"
                  : undefined,
              borderBottom: showHorizontalLines
                ? "1px solid var(--border)"
                : "1px solid transparent",
              opacity: 0.65,
            }}
            aria-hidden="true"
          />
        )
      }

      // Header row (rowIndex 0) - only render if headers are shown
      if (showColumnHeaders && rowIndex === 0) {
        if (isSelectionColumnId(slotColumnId)) {
          return (
            <SelectionGridHeaderCell
              key="header-selection"
              x={x}
              y={y}
              width={cellWidth}
              height={headerHeight}
              checked={areAllLoadedSelectableRowsSelected}
              indeterminate={
                !areAllLoadedSelectableRowsSelected && areSomeLoadedSelectableRowsSelected
              }
              disabled={orderedSelectableRowIds.length === 0}
              renderCheckbox={selectionCheckboxesVisible}
              showVerticalLine={
                showVerticalLines && columnIndex !== effectiveStickyColumnsCount - 1
              }
              showHorizontalLine={showHorizontalLines && !showColumnHeaders}
              onToggle={handleHeaderSelectionToggle}
            />
          )
        }

        // Find header by column ID (not by index, since getFlatHeaders uses definition order)
        const header = table.getFlatHeaders().find((h) => h.column.id === slotColumnId)
        if (!header) {
          return null
        }

        return columnReorderingEnabled ? (
          <SortableGridHeaderCell
            key={`header-${slotColumnId}`}
            header={header}
            x={x}
            y={y}
            width={cellWidth}
            height={headerHeight}
            isFrozen={columnIndex < effectiveStickyColumnsCount}
            columnIndex={columnIndex}
            suppressSortableTransform={!!activeId}
            showVerticalLine={showVerticalLines && columnIndex !== effectiveStickyColumnsCount - 1}
            showHorizontalLine={showHorizontalLines && !showColumnHeaders}
          />
        ) : (
          <GridHeaderCell
            key={`header-${slotColumnId}`}
            header={header}
            x={x}
            y={y}
            width={cellWidth}
            height={headerHeight}
            isFrozen={columnIndex < effectiveStickyColumnsCount}
            columnIndex={columnIndex}
            showVerticalLine={showVerticalLines && columnIndex !== effectiveStickyColumnsCount - 1}
            showHorizontalLine={showHorizontalLines && !showColumnHeaders}
          />
        )
      }

      const item = displayRowModel.getRenderableRowAt(rowIndex)

      if (!item) {
        return (
          <LoadingGridCell
            key={`loading-missing-${rowIndex}-${slotColumnId}`}
            x={x}
            y={y}
            width={cellWidth}
            height={cellHeight}
            zIndex={1}
            showVerticalLine={showVerticalLines && columnIndex !== effectiveStickyColumnsCount - 1}
            showHorizontalLine={showHorizontalLines}
          />
        )
      }

      if (item.type === "loading") {
        return (
          <LoadingGridCell
            key={`loading-${rowIndex}-${slotColumnId}`}
            x={x}
            y={y}
            width={cellWidth}
            height={cellHeight}
            zIndex={1}
            showVerticalLine={showVerticalLines && columnIndex !== effectiveStickyColumnsCount - 1}
            showHorizontalLine={showHorizontalLines}
          />
        )
      }

      // Full-width rows are rendered by the dedicated row renderer.
      if (item.type === "group-header") {
        return null
      }

      const isSelected = selectedRowIds.has(item.rowId)
      const isActive = activeRowId === item.rowId
      const isPreviewOpen = previewRowId === item.rowId
      const presentation = resolveRowPresentation({
        rowPresentation,
        row: item.data,
        rowId: item.rowId,
        columnId: slotColumnId,
        isSelected,
        isActive,
        isPreviewOpen,
      })

      if (isSelectionColumnId(slotColumnId)) {
        const canSelect = selection?.getRowCanSelect ? selection.getRowCanSelect(item.data) : true
        const showCheckbox = shouldShowSelectionCheckbox({
          canSelect,
          isHovered: false,
          isSelected,
          showCheckboxOnHover: selection?.showCheckboxOnHover ?? true,
        })

        return (
          <SelectionGridCell
            key={`selection-${item.rowId}`}
            x={x}
            y={y}
            width={cellWidth}
            height={cellHeight}
            checked={isSelected}
            className={presentation.className}
            rowId={item.rowId}
            isActive={isActive}
            disabled={!canSelect}
            renderCheckbox={selectionCheckboxesVisible}
            showVerticalLine={showVerticalLines && columnIndex !== effectiveStickyColumnsCount - 1}
            showHorizontalLine={showHorizontalLines}
            showCheckbox={showCheckbox}
            interactionAttributes={presentation.attributes}
            onActivate={() => {
              ownsDocumentNavigationRef.current = true
              applyActiveRow(item.rowId)
            }}
            onToggle={({ shiftKey }) => {
              if (!canSelect) {
                return
              }
              handleSelectionToggle({
                rowId: item.rowId,
                shiftKey,
              })
            }}
          />
        )
      }

      return dataCellRenderer.renderDataCell({
        row: item,
        columnId: slotColumnId,
        columnIndex,
        rowIndex,
        x,
        y,
        width: cellWidth,
        height: cellHeight,
        zIndex: 1,
        className: presentation.className,
        showVerticalLine: showVerticalLines && columnIndex !== effectiveStickyColumnsCount - 1,
        showHorizontalLine: showHorizontalLines,
        isSelected,
        isActive,
        isPreviewOpen,
        interactionAttributes: presentation.attributes,
        onClick: (event) => {
          ownsDocumentNavigationRef.current = true
          if (canRenderPreview && previewOpenOnClick) {
            activatePreviewRow(item.rowId, "mouse", { x: event.clientX, y: event.clientY })
            return
          }

          if (rowActions?.onOpenRow) {
            void rowActions.onOpenRow({
              row: item.data,
              rowId: item.rowId,
              trigger: "mouse",
            })
            return
          }

          applyActiveRow(item.rowId)
        },
      })
    },
    [
      activeId,
      activeRowId,
      activatePreviewRow,
      areAllLoadedSelectableRowsSelected,
      areSomeLoadedSelectableRowsSelected,
      columnReorderingEnabled,
      dataCellRenderer,
      effectiveStickyColumnsCount,
      handleHeaderSelectionToggle,
      handleSelectionToggle,
      canRenderPreview,
      previewOpenOnClick,
      orderedSelectableRowIds.length,
      displayRowModel,
      previewRowId,
      renderedHeaderVisibleColumnSlots,
      renderedPreviewVisibleColumnSlots,
      rowPresentation,
      applyActiveRow,
      rowActions,
      selectedRowIds,
      selection,
      selectionCheckboxesVisible,
      table,
      headerHeight,
      showColumnHeaders,
      showHorizontalLines,
      showVerticalLines,
    ],
  )

  const isFullWidthRow = useCallback((row: RenderableRow<TData>) => row.type === "group-header", [])

  const renderDataRowBackground = useCallback(
    ({
      row,
      rowIndex,
      y,
      width: rowWidth,
      height: rowHeightForRow,
      pane,
    }: {
      row: RenderableRow<TData>
      rowIndex: number
      y: number
      width: number
      height: number
      pane: "single" | "frozen" | "scrollable"
    }) => {
      if (row.type !== "data") {
        return null
      }

      const isSelected = selectedRowIds.has(row.rowId)
      const isActive = activeRowId === row.rowId
      const isPreviewOpen = previewRowId === row.rowId

      return (
        <div
          key={`row-background-${pane}-${row.rowId}-${rowIndex}`}
          aria-hidden="true"
          data-row-id={row.rowId}
          data-selected={isSelected || undefined}
          data-active={isActive || undefined}
          data-preview-open={isPreviewOpen || undefined}
          className={cn(
            "pointer-events-none bg-transparent data-[active=true]:bg-muted/40 data-[hovered=true]:bg-muted data-[selected=true]:bg-accent data-[active=true]:data-[hovered=true]:bg-muted",
            pane === "single" && "rounded-sm",
            pane === "frozen" && "rounded-l-sm",
            pane === "scrollable" && "rounded-r-sm",
            !isSelected && isActive && "bg-muted/40",
            isSelected && "bg-accent",
          )}
          style={{
            position: "absolute",
            left: 0,
            top: y,
            width: rowWidth,
            height: rowHeightForRow,
            zIndex: 0,
            boxSizing: "border-box",
          }}
        />
      )
    },
    [activeRowId, previewRowId, selectedRowIds],
  )

  const renderFullWidthRow = useCallback(
    ({
      row,
      rowIndex,
      y,
      width: rowWidth,
      height: rowHeightForRow,
      pane,
      contentWidth,
      contentOffsetX,
    }: {
      row: RenderableRow<TData>
      rowIndex: number
      y: number
      width: number
      height: number
      pane: "single" | "frozen" | "scrollable"
      contentWidth: number
      contentOffsetX: number
    }) => {
      if (row.type !== "group-header") {
        return null
      }

      return (
        <GridGroupHeader
          key={`group-header-${row.groupId}-${rowIndex}`}
          header={row}
          table={table}
          y={y}
          width={rowWidth}
          height={rowHeightForRow}
          pane={pane}
          contentWidth={contentWidth}
          contentOffsetX={contentOffsetX}
          isExpandable={true}
          isActive={activeRowId === row.groupId}
          onActivate={() => {
            ownsDocumentNavigationRef.current = true
            applyActiveRow(row.groupId)
          }}
          rowPresentation={rowPresentation}
        />
      )
    },
    [activeRowId, applyActiveRow, rowPresentation, table],
  )

  const activeHeader = useMemo(
    () =>
      activeId
        ? (table.getFlatHeaders().find((header) => header.column.id === activeId) ?? null)
        : null,
    [activeId, table],
  )

  const dragOverlayHeight = useMemo(() => {
    const renderedRange = viewportLayout.rows.rendered
    if (!renderedRange) {
      return headerHeight
    }

    const endOffset =
      rowCache.getOffset(renderedRange.endIndex) + rowCache.getSizeAt(renderedRange.endIndex)
    const startOffset = scrollState.scrollTop
    return Math.max(endOffset - startOffset, headerHeight)
  }, [headerHeight, rowCache, scrollState.scrollTop, viewportLayout.rows.rendered])

  return (
    <div ref={gridContainerRef} className="relative h-full w-full">
      <DndContext
        sensors={dndSensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={visibleColumnOrder} strategy={horizontalListSortingStrategy}>
          <EngineGridRenderer
            viewportLayout={viewportLayout}
            width={width}
            height={height}
            rowCache={rowCache}
            columnCache={columnCache}
            renderCell={renderCell}
            totalColumns={totalColumns}
            totalRows={totalRows}
            frozenColumnsCount={effectiveStickyColumnsCount}
            frozenRowsCount={showColumnHeaders ? 1 : 0}
            renderMode={renderMode}
            fullRenderRowCount={fullRenderRowCount}
            fullRenderColumnCount={fullRenderColumnCount}
            rowOverscanCount={rowOverscanCount}
            columnOverscanCount={columnOverscanCount}
            renderableRows={renderableRows}
            getRenderableRowAt={displayRowModel.getRenderableRowAt}
            gridRootRef={gridKeyboardRootRef}
            isFullWidthRow={isFullWidthRow}
            renderFullWidthRow={renderFullWidthRow}
            renderDataRowBackground={renderDataRowBackground}
            scrollContainerRef={bottomRightGridRef}
            initialScrollState={initialScrollState}
            scrollRestorationKey={scrollRestorationKey}
            onScrollStateChange={setScrollState}
            onScrollPositionChange={onScrollPositionChange}
            onScrollbarWidthChange={onScrollbarWidthChange}
            onScrollbarHeightChange={onScrollbarHeightChange}
            onVisibleRowRangeChange={onRenderedRowRangeChange}
            debug={debug}
            tabIndex={0}
            onKeyDown={handleGridKeyDown}
          />
        </SortableContext>

        <DragOverlay modifiers={columnDragOverlayModifiers} dropAnimation={null}>
          {activeId && activeHeader ? (
            <DraggedColumnOverlay
              activeColumnId={activeId}
              header={activeHeader}
              width={overlayWidth}
              height={dragOverlayHeight}
              headerHeight={headerHeight}
              stickyColumnsCount={effectiveStickyColumnsCount}
              showColumnHeaders={showColumnHeaders}
              showHorizontalLines={showHorizontalLines}
              showVerticalLines={showVerticalLines}
              renderedRowRange={viewportLayout.rows.rendered}
              getRenderableRowAt={displayRowModel.getRenderableRowAt}
              rowCache={rowCache}
              scrollTop={scrollState.scrollTop}
              dataCellRenderer={dataCellRenderer}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Empty state overlay - positioned below headers */}
      {shouldShowEmptyState && (
        <div
          className="bg-background absolute right-0 left-0 z-10 flex items-center justify-center"
          style={{
            top: showColumnHeaders ? headerHeight : 0,
            bottom: 0,
          }}
        >
          <EmptyState
            title="No results found"
            message="Try adjusting your filters or search query"
            onReset={onEmptyStateReset}
          />
        </div>
      )}

      {/* Infinite scroll loading indicator - shows at bottom when fetching more pages */}
      {onlineState?.isFetchingNextPage && (
        <div className="bg-background absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border px-4 py-2 shadow-lg">
          <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
          <span className="text-sm">Loading more...</span>
        </div>
      )}

      {/* Loading overlay - positioned below headers during refetch */}
      {shouldShowRefetchOverlay && (
        <div
          className="bg-background/50 pointer-events-none absolute right-0 left-0 transition-opacity duration-200"
          style={{
            top: showColumnHeaders ? headerHeight : 0,
            bottom: 0,
            zIndex: 10,
          }}
        />
      )}
    </div>
  )
}
