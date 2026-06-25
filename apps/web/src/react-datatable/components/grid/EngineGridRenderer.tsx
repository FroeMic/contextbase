import type { RowData } from "@tanstack/react-table"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Z_INDEX } from "../../core/layout/constants"
import { buildVisibleFullWidthRows } from "../../core/row-model/build-visible-full-width-rows"
import { createViewportLayout } from "../../core/viewport/create-viewport-layout"
import type { PositionCache } from "../../core/viewport/position-cache"
import { mergeAxisRangesWithinLimit } from "../../core/viewport/retained-range"
import type {
  AxisRange,
  ViewportLayoutResult,
  ViewportRenderMode,
} from "../../core/viewport/viewport.types"
import { debug as debugLog } from "../../shared/utils/debug"
import type { RenderableRow } from "../../types/renderable-row.types"
import { resolveScrollableGridGeometry } from "./scrollable-grid-geometry"
import { resolveForwardedWheelScroll } from "./wheel-scroll"

interface RenderCellArgs {
  rowIndex: number
  columnIndex: number
  x: number
  y: number
  width: number
  height: number
}

type FullWidthRowPane = "single" | "frozen" | "scrollable"

interface RenderFullWidthRowArgs<TData> {
  rowIndex: number
  y: number
  width: number
  height: number
  row: RenderableRow<TData>
  pane: FullWidthRowPane
  contentWidth: number
  contentOffsetX: number
}

interface RenderDataRowBackgroundArgs<TData> {
  rowIndex: number
  y: number
  width: number
  height: number
  row: RenderableRow<TData>
  pane: FullWidthRowPane
}

interface EngineGridRendererProps<TData extends RowData = RowData> {
  viewportLayout: ViewportLayoutResult
  width: number
  height: number
  rowCache: PositionCache
  columnCache: PositionCache
  renderCell: (args: RenderCellArgs) => React.ReactElement | null
  totalColumns: number
  totalRows: number
  frozenColumnsCount: number
  frozenRowsCount: number
  renderMode?: ViewportRenderMode
  fullRenderRowCount?: number
  fullRenderColumnCount?: number
  rowOverscanCount?: number
  columnOverscanCount?: number
  renderableRows: RenderableRow<TData>[]
  getRenderableRowAt?: (rowIndex: number) => RenderableRow<TData> | null
  gridRootRef?: React.RefObject<HTMLDivElement | null>
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
  initialScrollState?: { scrollLeft: number; scrollTop: number }
  scrollRestorationKey?: string
  onScrollStateChange?: (state: { scrollLeft: number; scrollTop: number }) => void
  onScrollPositionChange?: (state: { scrollLeft: number; scrollTop: number }) => void
  onScrollbarWidthChange?: (width: number) => void
  onScrollbarHeightChange?: (height: number) => void
  onVisibleRowRangeChange?: (range: { rowStartIndex: number; rowStopIndex: number }) => void
  isFullWidthRow?: (row: RenderableRow<TData>) => boolean
  renderFullWidthRow?: (args: RenderFullWidthRowArgs<TData>) => React.ReactElement | null
  renderDataRowBackground?: (args: RenderDataRowBackgroundArgs<TData>) => React.ReactElement | null
  tabIndex?: number
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>
  debug?: boolean
}

function rangeToIndices(range: { startIndex: number; endIndex: number } | null) {
  if (!range) {
    return []
  }

  return Array.from(
    { length: range.endIndex - range.startIndex + 1 },
    (_, offset) => range.startIndex + offset,
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function clampRangeToRowCount(range: AxisRange | null, rowCount: number): AxisRange | null {
  if (!range || rowCount <= 0) {
    return null
  }

  const maxIndex = rowCount - 1
  const startIndex = clamp(range.startIndex, 0, maxIndex)
  const endIndex = clamp(range.endIndex, startIndex, maxIndex)

  return { startIndex, endIndex }
}

function areRangesEqual(left: AxisRange | null, right: AxisRange | null) {
  if (left === right) {
    return true
  }

  if (!left || !right) {
    return false
  }

  return left.startIndex === right.startIndex && left.endIndex === right.endIndex
}

export function EngineGridRenderer<TData extends RowData = RowData>({
  viewportLayout,
  width,
  height,
  rowCache,
  columnCache,
  renderCell,
  totalColumns,
  totalRows,
  frozenColumnsCount,
  frozenRowsCount,
  renderMode = "viewport",
  fullRenderRowCount,
  fullRenderColumnCount,
  rowOverscanCount = 3,
  columnOverscanCount = 1,
  renderableRows,
  getRenderableRowAt,
  gridRootRef,
  scrollContainerRef,
  initialScrollState,
  scrollRestorationKey,
  onScrollStateChange,
  onScrollPositionChange,
  onScrollbarWidthChange,
  onScrollbarHeightChange,
  onVisibleRowRangeChange,
  isFullWidthRow,
  renderFullWidthRow,
  renderDataRowBackground,
  tabIndex,
  onKeyDown,
  debug,
}: EngineGridRendererProps<TData>) {
  const internalScrollContainerRef = useRef<HTMLDivElement>(null)
  const effectiveScrollContainerRef = scrollContainerRef ?? internalScrollContainerRef
  const frozenHeaderPaneRef = useRef<HTMLDivElement>(null)
  const frozenColumnsPaneRef = useRef<HTMLDivElement>(null)
  const frozenColumnsInnerRef = useRef<HTMLDivElement>(null)
  const liveScrollRef = useRef({ scrollLeft: 0, scrollTop: 0 })
  const reportedScrollRef = useRef<{ scrollLeft: number; scrollTop: number } | null>(null)
  const appliedScrollRestorationKeyRef = useRef<string | null>(null)
  const suppressScrollPositionChangeRef = useRef(false)
  const committedRangeSignatureRef = useRef("")
  const retainedRangeFrameRef = useRef<number | null>(null)
  const scrollUpdateFrameRef = useRef<number | null>(null)
  const scrollbarMeasureFrameRef = useRef<number | null>(null)
  const lastMeasuredScrollbarRef = useRef({ width: 0, height: 0 })
  const debugCommitCountRef = useRef(0)
  const debugLastCommitAtRef = useRef<number | null>(null)
  const debugLastScrollLogAtRef = useRef(0)

  const [scrollbarWidth, setScrollbarWidth] = useState(0)
  const [scrollbarHeight, setScrollbarHeight] = useState(0)
  const [retainedRenderedRowRange, setRetainedRenderedRowRange] = useState(
    viewportLayout.rows.rendered,
  )

  const {
    hasHorizontalOverflow,
    scrollableContentHeight,
    scrollableContentWidth,
    scrollableViewportHeight,
    scrollableViewportWidth,
    scrollContainerPaddingRight,
  } = resolveScrollableGridGeometry({
    frozenHeight: viewportLayout.frozenHeight,
    frozenWidth: viewportLayout.frozenWidth,
    height,
    measuredVerticalScrollbarWidth: scrollbarWidth,
    totalHeight: viewportLayout.totalHeight,
    totalWidth: viewportLayout.totalWidth,
    width,
  })
  const hasHorizontalScrollbar = scrollbarHeight > 0 && hasHorizontalOverflow
  const effectiveRenderedRowRange =
    renderMode === "full" ? viewportLayout.rows.rendered : retainedRenderedRowRange
  const visibleBottomRows = useMemo(
    () => rangeToIndices(effectiveRenderedRowRange),
    [effectiveRenderedRowRange],
  )
  const visibleScrollableColumns = useMemo(
    () => rangeToIndices(viewportLayout.columns.rendered),
    [viewportLayout.columns.rendered],
  )
  const renderedRowRangeStart = viewportLayout.rows.rendered?.startIndex ?? -1
  const renderedRowRangeEnd = viewportLayout.rows.rendered?.endIndex ?? -1
  const renderedRowRangeSize =
    renderedRowRangeStart === -1 || renderedRowRangeEnd === -1
      ? 0
      : renderedRowRangeEnd - renderedRowRangeStart + 1
  const maxRetainedRowRangeSpan = Math.max(200, renderedRowRangeSize * 4)
  const frozenRowIndices = useMemo(
    () => rangeToIndices(viewportLayout.panes.topLeft.rows),
    [viewportLayout.panes.topLeft.rows],
  )
  const frozenColumnIndices = useMemo(
    () => rangeToIndices(viewportLayout.panes.topLeft.columns),
    [viewportLayout.panes.topLeft.columns],
  )

  const getRangeSignature = (layout: ViewportLayoutResult) => {
    return [
      layout.rows.rendered?.startIndex ?? -1,
      layout.rows.rendered?.endIndex ?? -1,
      layout.columns.rendered?.startIndex ?? -1,
      layout.columns.rendered?.endIndex ?? -1,
    ].join(":")
  }

  const reportScrollState = (nextScrollState: { scrollLeft: number; scrollTop: number }) => {
    const lastReportedScroll = reportedScrollRef.current
    if (
      lastReportedScroll &&
      lastReportedScroll.scrollLeft === nextScrollState.scrollLeft &&
      lastReportedScroll.scrollTop === nextScrollState.scrollTop
    ) {
      return
    }

    reportedScrollRef.current = nextScrollState
    onScrollStateChange?.(nextScrollState)
  }

  useLayoutEffect(() => {
    if (retainedRangeFrameRef.current !== null) {
      window.cancelAnimationFrame(retainedRangeFrameRef.current)
      retainedRangeFrameRef.current = null
    }

    const nextRange =
      renderedRowRangeStart === -1 || renderedRowRangeEnd === -1
        ? null
        : { startIndex: renderedRowRangeStart, endIndex: renderedRowRangeEnd }
    setRetainedRenderedRowRange((currentRange) => {
      const mergedRange = clampRangeToRowCount(
        mergeAxisRangesWithinLimit(currentRange, nextRange, maxRetainedRowRangeSpan),
        totalRows,
      )
      return areRangesEqual(currentRange, mergedRange) ? currentRange : mergedRange
    })

    retainedRangeFrameRef.current = window.requestAnimationFrame(() => {
      setRetainedRenderedRowRange((currentRange) => {
        const clampedRange = clampRangeToRowCount(nextRange, totalRows)
        return areRangesEqual(currentRange, clampedRange) ? currentRange : clampedRange
      })
      retainedRangeFrameRef.current = null
    })

    return () => {
      if (retainedRangeFrameRef.current !== null) {
        window.cancelAnimationFrame(retainedRangeFrameRef.current)
        retainedRangeFrameRef.current = null
      }
    }
  }, [maxRetainedRowRangeSpan, renderedRowRangeEnd, renderedRowRangeStart, totalRows])

  const visibleFullWidthRows = useMemo(() => {
    return buildVisibleFullWidthRows({
      visibleRowIndices: visibleBottomRows,
      frozenRowsCount,
      frozenHeight: viewportLayout.frozenHeight,
      renderableRows,
      getRenderableRowAt,
      isFullWidthRow: (row) => isFullWidthRow?.(row) ?? false,
      getRowOffset: (rowIndex) => rowCache.getOffset(rowIndex),
    })
  }, [
    frozenRowsCount,
    getRenderableRowAt,
    isFullWidthRow,
    renderableRows,
    rowCache,
    viewportLayout.frozenHeight,
    visibleBottomRows,
  ])

  useEffect(() => {
    committedRangeSignatureRef.current = getRangeSignature(viewportLayout)
  }, [viewportLayout])

  useLayoutEffect(() => {
    const element = effectiveScrollContainerRef.current
    if (!element || !initialScrollState || !scrollRestorationKey) {
      return
    }

    if (appliedScrollRestorationKeyRef.current === scrollRestorationKey) {
      return
    }

    const maxScrollLeft = Math.max(element.scrollWidth - element.clientWidth, 0)
    const maxScrollTop = Math.max(element.scrollHeight - element.clientHeight, 0)
    const targetScrollLeft = clamp(initialScrollState.scrollLeft, 0, maxScrollLeft)
    const targetScrollTop = clamp(initialScrollState.scrollTop, 0, maxScrollTop)
    const canReachTarget =
      initialScrollState.scrollLeft <= maxScrollLeft && initialScrollState.scrollTop <= maxScrollTop

    suppressScrollPositionChangeRef.current = true
    const suppressFrame = window.requestAnimationFrame(() => {
      suppressScrollPositionChangeRef.current = false
    })

    element.scrollLeft = targetScrollLeft
    element.scrollTop = targetScrollTop

    const nextScrollState = {
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop,
    }
    liveScrollRef.current = nextScrollState
    reportScrollState(nextScrollState)

    if (
      canReachTarget &&
      nextScrollState.scrollLeft === targetScrollLeft &&
      nextScrollState.scrollTop === targetScrollTop
    ) {
      appliedScrollRestorationKeyRef.current = scrollRestorationKey
    }

    if (frozenColumnsInnerRef.current) {
      frozenColumnsInnerRef.current.style.transform = `translate3d(0, ${-element.scrollTop}px, 0)`
    }

    return () => {
      window.cancelAnimationFrame(suppressFrame)
      suppressScrollPositionChangeRef.current = false
    }
  }, [
    effectiveScrollContainerRef,
    initialScrollState,
    scrollableContentHeight,
    scrollableContentWidth,
    scrollableViewportHeight,
    scrollableViewportWidth,
    scrollRestorationKey,
  ])

  useEffect(() => {
    const element = effectiveScrollContainerRef.current
    if (!element) {
      return
    }

    liveScrollRef.current = {
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop,
    }
    reportScrollState({
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop,
    })
    if (frozenColumnsInnerRef.current) {
      frozenColumnsInnerRef.current.style.transform = `translate3d(0, ${-element.scrollTop}px, 0)`
    }

    const processScrollUpdate = () => {
      scrollUpdateFrameRef.current = null
      const { scrollLeft: nextScrollLeft, scrollTop: nextScrollTop } = liveScrollRef.current

      if (!suppressScrollPositionChangeRef.current) {
        onScrollPositionChange?.(liveScrollRef.current)
      }

      if (frozenColumnsInnerRef.current) {
        frozenColumnsInnerRef.current.style.transform = `translate3d(0, ${-nextScrollTop}px, 0)`
      }

      const nextLayout = createViewportLayout({
        rowCache,
        columnCache,
        viewport: {
          scrollLeft: nextScrollLeft,
          scrollTop: nextScrollTop,
          width,
          height,
        },
        frozenRowsCount,
        frozenColumnsCount,
        renderMode,
        fullRenderRowCount,
        fullRenderColumnCount,
        rowOverscanCount,
        columnOverscanCount,
      })
      const nextSignature = getRangeSignature(nextLayout)

      setRetainedRenderedRowRange((currentRange) => {
        const mergedRange = clampRangeToRowCount(
          mergeAxisRangesWithinLimit(
            currentRange,
            nextLayout.rows.rendered,
            maxRetainedRowRangeSpan,
          ),
          totalRows,
        )
        return areRangesEqual(currentRange, mergedRange) ? currentRange : mergedRange
      })

      if (debug) {
        const now = performance.now()
        if (now - debugLastScrollLogAtRef.current > 200) {
          debugLastScrollLogAtRef.current = now
          debugLog("engine scroll", {
            scrollLeft: nextScrollLeft,
            scrollTop: nextScrollTop,
            rows: nextLayout.rows.rendered,
            columns: nextLayout.columns.rendered,
            signatureChanged: nextSignature !== committedRangeSignatureRef.current,
          })
        }
      }

      if (nextSignature !== committedRangeSignatureRef.current) {
        committedRangeSignatureRef.current = nextSignature
        reportScrollState({
          scrollLeft: nextScrollLeft,
          scrollTop: nextScrollTop,
        })
      }
    }

    const handleScroll = () => {
      liveScrollRef.current = {
        scrollLeft: element.scrollLeft,
        scrollTop: element.scrollTop,
      }

      if (scrollUpdateFrameRef.current !== null) {
        return
      }

      scrollUpdateFrameRef.current = window.requestAnimationFrame(processScrollUpdate)
    }

    element.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      if (scrollUpdateFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollUpdateFrameRef.current)
        scrollUpdateFrameRef.current = null
      }
      element.removeEventListener("scroll", handleScroll)
    }
  }, [
    columnCache,
    columnOverscanCount,
    debug,
    effectiveScrollContainerRef,
    frozenColumnsCount,
    frozenRowsCount,
    height,
    fullRenderColumnCount,
    fullRenderRowCount,
    maxRetainedRowRangeSpan,
    onScrollStateChange,
    onScrollPositionChange,
    renderMode,
    rowCache,
    rowOverscanCount,
    totalRows,
    width,
  ])

  const forwardWheelToScrollContainer = useCallback(
    (event: WheelEvent) => {
      const element = effectiveScrollContainerRef.current
      if (!element) {
        return
      }

      const nextScroll = resolveForwardedWheelScroll({
        currentScrollLeft: element.scrollLeft,
        currentScrollTop: element.scrollTop,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        contentWidth: scrollableContentWidth,
        contentHeight: scrollableContentHeight,
        viewportWidth: scrollableViewportWidth,
        viewportHeight: scrollableViewportHeight,
      })

      const { didScroll, scrollLeft, scrollTop } = nextScroll
      if (!didScroll) {
        return
      }

      event.preventDefault()

      if (scrollLeft !== element.scrollLeft) {
        element.scrollLeft = scrollLeft
      }
      if (scrollTop !== element.scrollTop) {
        element.scrollTop = scrollTop
      }
    },
    [
      effectiveScrollContainerRef,
      scrollableContentHeight,
      scrollableContentWidth,
      scrollableViewportHeight,
      scrollableViewportWidth,
    ],
  )

  const addFrozenWheelForwardingListener = useCallback(
    (pane: HTMLDivElement | null) => {
      if (!pane) {
        return () => undefined
      }

      const handleWheel = (event: WheelEvent) => {
        forwardWheelToScrollContainer(event)
      }

      pane.addEventListener("wheel", handleWheel, { passive: false })
      return () => {
        pane.removeEventListener("wheel", handleWheel)
      }
    },
    [forwardWheelToScrollContainer],
  )

  useEffect(() => {
    const removeFrozenHeaderWheel = addFrozenWheelForwardingListener(frozenHeaderPaneRef.current)
    const removeFrozenColumnsWheel = addFrozenWheelForwardingListener(frozenColumnsPaneRef.current)

    return () => {
      removeFrozenHeaderWheel()
      removeFrozenColumnsWheel()
    }
  }, [
    addFrozenWheelForwardingListener,
    frozenColumnsCount,
    frozenRowsCount,
    visibleBottomRows.length,
  ])

  useEffect(() => {
    const loadingRange = viewportLayout.rows.visible ?? viewportLayout.rows.rendered
    if (!onVisibleRowRangeChange || !loadingRange) {
      return
    }

    onVisibleRowRangeChange({
      rowStartIndex: loadingRange.startIndex,
      rowStopIndex: loadingRange.endIndex,
    })
  }, [onVisibleRowRangeChange, viewportLayout.rows.rendered, viewportLayout.rows.visible])

  useEffect(() => {
    const element = effectiveScrollContainerRef.current
    if (!element) {
      return
    }

    const measureScrollbar = () => {
      scrollbarMeasureFrameRef.current = null
      const nextScrollbarWidth = element.offsetWidth - element.clientWidth
      const nextScrollbarHeight = element.offsetHeight - element.clientHeight

      if (
        lastMeasuredScrollbarRef.current.width === nextScrollbarWidth &&
        lastMeasuredScrollbarRef.current.height === nextScrollbarHeight
      ) {
        return
      }

      lastMeasuredScrollbarRef.current = {
        width: nextScrollbarWidth,
        height: nextScrollbarHeight,
      }
      setScrollbarWidth(nextScrollbarWidth)
      setScrollbarHeight(nextScrollbarHeight)
      onScrollbarWidthChange?.(nextScrollbarWidth)
      onScrollbarHeightChange?.(nextScrollbarHeight)
    }

    const scheduleScrollbarMeasure = () => {
      if (scrollbarMeasureFrameRef.current !== null) {
        return
      }

      scrollbarMeasureFrameRef.current = window.requestAnimationFrame(measureScrollbar)
    }

    scheduleScrollbarMeasure()

    const resizeObserver = new ResizeObserver(scheduleScrollbarMeasure)
    resizeObserver.observe(element)
    window.addEventListener("resize", scheduleScrollbarMeasure)

    return () => {
      if (scrollbarMeasureFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollbarMeasureFrameRef.current)
        scrollbarMeasureFrameRef.current = null
      }
      resizeObserver.disconnect()
      window.removeEventListener("resize", scheduleScrollbarMeasure)
    }
  }, [
    effectiveScrollContainerRef,
    onScrollbarHeightChange,
    onScrollbarWidthChange,
    scrollableContentHeight,
    scrollableContentWidth,
    scrollableViewportHeight,
    scrollableViewportWidth,
  ])

  useEffect(() => {
    if (!debug) {
      return
    }

    const now = performance.now()
    const lastCommitAt = debugLastCommitAtRef.current
    debugCommitCountRef.current += 1
    debugLastCommitAtRef.current = now

    debugLog("engine commit", {
      commit: debugCommitCountRef.current,
      msSinceLastCommit: lastCommitAt === null ? null : Math.round((now - lastCommitAt) * 10) / 10,
      scroll: liveScrollRef.current,
      layoutRows: viewportLayout.rows.rendered,
      retainedRows: retainedRenderedRowRange,
      visibleBottomRows: visibleBottomRows.length,
      visibleScrollableColumns: visibleScrollableColumns.length,
      frozenRows: frozenRowIndices.length,
      frozenColumns: frozenColumnIndices.length,
      estimatedMountedCells:
        visibleBottomRows.length * (visibleScrollableColumns.length + frozenColumnIndices.length) +
        frozenRowIndices.length * (visibleScrollableColumns.length + frozenColumnIndices.length),
      contentHeight: scrollableContentHeight,
      viewportHeight: height,
    })
  })

  return (
    <div
      ref={gridRootRef}
      role="grid"
      aria-rowcount={totalRows}
      aria-colcount={totalColumns}
      aria-label="Data table"
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
        overscrollBehavior: "none",
        outline: "none",
      }}
    >
      {frozenRowsCount > 0 && frozenColumnsCount > 0 && (
        <div
          ref={frozenHeaderPaneRef}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: viewportLayout.frozenWidth,
            height: viewportLayout.frozenHeight,
            overflow: "visible",
            zIndex: Z_INDEX.GRID.FROZEN_HEADER,
          }}
        >
          {frozenRowIndices.flatMap((rowIndex) =>
            frozenColumnIndices.map((columnIndex) =>
              renderCell({
                rowIndex,
                columnIndex,
                x: columnCache.getOffset(columnIndex),
                y: rowCache.getOffset(rowIndex),
                width: columnCache.getSizeAt(columnIndex),
                height: rowCache.getSizeAt(rowIndex),
              }),
            ),
          )}
        </div>
      )}

      {frozenColumnsCount > 0 && visibleBottomRows.length > 0 && (
        <div
          ref={frozenColumnsPaneRef}
          style={{
            position: "absolute",
            left: 0,
            top: viewportLayout.frozenHeight,
            width: viewportLayout.frozenWidth,
            height: scrollableViewportHeight,
            overflow: "hidden",
            backgroundColor: "var(--background)",
            zIndex: Z_INDEX.GRID.FROZEN_COLUMNS,
          }}
        >
          <div
            ref={frozenColumnsInnerRef}
            style={{
              position: "relative",
              width: viewportLayout.frozenWidth,
              height: scrollableContentHeight,
              willChange: "transform",
            }}
          >
            {renderDataRowBackground &&
              visibleBottomRows.map((rowIndex) => {
                const row = getRenderableRowAt?.(rowIndex)
                if (!row) {
                  return null
                }

                return renderDataRowBackground({
                  rowIndex,
                  y: rowCache.getOffset(rowIndex) - viewportLayout.frozenHeight,
                  width: viewportLayout.frozenWidth,
                  height: rowCache.getSizeAt(rowIndex),
                  row,
                  pane: "frozen",
                })
              })}

            {renderFullWidthRow &&
              visibleFullWidthRows.length > 0 &&
              visibleFullWidthRows.map((item) =>
                renderFullWidthRow({
                  rowIndex: item.rowIndex,
                  y: item.y,
                  width: viewportLayout.frozenWidth,
                  height: rowCache.getSizeAt(item.rowIndex),
                  row: item.row,
                  pane: "frozen",
                  contentWidth: viewportLayout.totalWidth,
                  contentOffsetX: 0,
                }),
              )}

            {visibleBottomRows.flatMap((rowIndex) =>
              frozenColumnIndices.map((columnIndex) =>
                renderCell({
                  rowIndex,
                  columnIndex,
                  x: columnCache.getOffset(columnIndex),
                  y: rowCache.getOffset(rowIndex) - viewportLayout.frozenHeight,
                  width: columnCache.getSizeAt(columnIndex),
                  height: rowCache.getSizeAt(rowIndex),
                }),
              ),
            )}
          </div>
        </div>
      )}

      <div
        ref={effectiveScrollContainerRef}
        data-rdt-scroll-container="true"
        style={{
          position: "absolute",
          left: viewportLayout.frozenWidth,
          top: 0,
          width: scrollableViewportWidth,
          height,
          overflow: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "gray transparent",
          boxSizing: "border-box",
          paddingRight: scrollContainerPaddingRight,
          backgroundColor: "var(--background)",
          overscrollBehaviorX: "none",
          overscrollBehaviorY: "none",
          overflowAnchor: "none",
          zIndex: Z_INDEX.GRID.SCROLLABLE_DATA,
        }}
      >
        {frozenRowsCount > 0 && visibleScrollableColumns.length > 0 && (
          <div
            style={{
              position: "sticky",
              top: 0,
              left: 0,
              width: scrollableContentWidth,
              height: viewportLayout.frozenHeight,
              zIndex: Z_INDEX.GRID.SCROLLABLE_HEADER,
              backgroundColor: "var(--background)",
            }}
          >
            {frozenRowIndices.flatMap((rowIndex) =>
              visibleScrollableColumns.map((columnIndex) =>
                renderCell({
                  rowIndex,
                  columnIndex,
                  x: columnCache.getOffset(columnIndex) - viewportLayout.frozenWidth,
                  y: rowCache.getOffset(rowIndex),
                  width: columnCache.getSizeAt(columnIndex),
                  height: rowCache.getSizeAt(rowIndex),
                }),
              ),
            )}
          </div>
        )}

        <div
          style={{
            position: "relative",
            width: scrollableContentWidth,
            height: scrollableContentHeight,
          }}
        >
          {renderDataRowBackground &&
            frozenColumnsCount === 0 &&
            visibleBottomRows.map((rowIndex) => {
              const row = getRenderableRowAt?.(rowIndex)
              if (!row) {
                return null
              }

              return renderDataRowBackground({
                rowIndex,
                y: rowCache.getOffset(rowIndex) - viewportLayout.frozenHeight,
                width: scrollableContentWidth,
                height: rowCache.getSizeAt(rowIndex),
                row,
                pane: "single",
              })
            })}

          {renderDataRowBackground &&
            frozenColumnsCount > 0 &&
            visibleBottomRows.map((rowIndex) => {
              const row = getRenderableRowAt?.(rowIndex)
              if (!row) {
                return null
              }

              return renderDataRowBackground({
                rowIndex,
                y: rowCache.getOffset(rowIndex) - viewportLayout.frozenHeight,
                width: scrollableContentWidth,
                height: rowCache.getSizeAt(rowIndex),
                row,
                pane: "scrollable",
              })
            })}

          {renderFullWidthRow &&
            frozenColumnsCount === 0 &&
            visibleFullWidthRows.map((item) =>
              renderFullWidthRow({
                rowIndex: item.rowIndex,
                y: item.y,
                width: scrollableContentWidth,
                height: rowCache.getSizeAt(item.rowIndex),
                row: item.row,
                pane: "single",
                contentWidth: scrollableContentWidth,
                contentOffsetX: 0,
              }),
            )}

          {renderFullWidthRow &&
            frozenColumnsCount > 0 &&
            visibleFullWidthRows.map((item) =>
              renderFullWidthRow({
                rowIndex: item.rowIndex,
                y: item.y,
                width: scrollableContentWidth,
                height: rowCache.getSizeAt(item.rowIndex),
                row: item.row,
                pane: "scrollable",
                contentWidth: viewportLayout.totalWidth,
                contentOffsetX: viewportLayout.frozenWidth,
              }),
            )}

          {visibleBottomRows.flatMap((rowIndex) =>
            visibleScrollableColumns.map((columnIndex) =>
              renderCell({
                rowIndex,
                columnIndex,
                x: columnCache.getOffset(columnIndex) - viewportLayout.frozenWidth,
                y: rowCache.getOffset(rowIndex) - viewportLayout.frozenHeight,
                width: columnCache.getSizeAt(columnIndex),
                height: rowCache.getSizeAt(rowIndex),
              }),
            ),
          )}
        </div>
      </div>

      {viewportLayout.frozenWidth > 0 && (
        <div
          style={{
            position: "absolute",
            left: viewportLayout.frozenWidth - 1,
            top: 0,
            width: 1,
            height: height - scrollbarHeight,
            backgroundColor: "var(--border)",
            pointerEvents: "none",
            zIndex: Z_INDEX.GRID.FROZEN_BOUNDARIES,
          }}
        />
      )}

      {viewportLayout.frozenWidth > 0 && hasHorizontalScrollbar && (
        <div
          data-rdt-frozen-scrollbar-spacer="true"
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: viewportLayout.frozenWidth,
            height: scrollbarHeight,
            backgroundColor: "var(--background)",
            pointerEvents: "none",
            zIndex: Z_INDEX.GRID.FROZEN_BOUNDARIES,
          }}
        />
      )}

      {viewportLayout.frozenHeight > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: viewportLayout.frozenHeight - 1,
            width: width - scrollbarWidth,
            height: 1,
            backgroundColor: "var(--border)",
            pointerEvents: "none",
            zIndex: Z_INDEX.GRID.FROZEN_BOUNDARIES,
          }}
        />
      )}
    </div>
  )
}
