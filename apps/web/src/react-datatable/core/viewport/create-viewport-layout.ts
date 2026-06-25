import { calculateColumnRanges } from "./calculate-column-ranges"
import { calculateRowRanges } from "./calculate-row-ranges"
import { partitionPanes } from "./partition-panes"
import type { PositionCache } from "./position-cache"
import type {
  AxisRange,
  ViewportLayoutResult,
  ViewportRenderMode,
  ViewportSnapshot,
} from "./viewport.types"

interface CreateViewportLayoutOptions {
  rowCache: PositionCache
  columnCache: PositionCache
  viewport: ViewportSnapshot
  frozenRowsCount: number
  frozenColumnsCount: number
  renderMode?: ViewportRenderMode
  fullRenderRowCount?: number
  fullRenderColumnCount?: number
  rowOverscanCount?: number
  columnOverscanCount?: number
}

function createFullRange(startIndex: number, endIndex: number): AxisRange | null {
  if (endIndex < startIndex) {
    return null
  }

  return { startIndex, endIndex }
}

export function createViewportLayout({
  rowCache,
  columnCache,
  viewport,
  frozenRowsCount,
  frozenColumnsCount,
  renderMode = "viewport",
  fullRenderRowCount,
  fullRenderColumnCount,
  rowOverscanCount = 3,
  columnOverscanCount = 1,
}: CreateViewportLayoutOptions): ViewportLayoutResult {
  const totalWidth = columnCache.getTotalSize()
  const totalHeight = rowCache.getTotalSize()
  const frozenWidth = columnCache.getOffset(frozenColumnsCount)
  const frozenHeight = rowCache.getOffset(frozenRowsCount)

  const scrollableViewportWidth = Math.max(viewport.width - frozenWidth, 0)
  const scrollableViewportHeight = Math.max(viewport.height - frozenHeight, 0)

  const rowRanges = calculateRowRanges({
    positionCache: rowCache,
    viewportOffset: viewport.scrollTop + frozenHeight,
    viewportSize: scrollableViewportHeight,
    overscanCount: rowOverscanCount,
    minIndex: frozenRowsCount,
  })

  const columnRanges = calculateColumnRanges({
    positionCache: columnCache,
    viewportOffset: viewport.scrollLeft + frozenWidth,
    viewportSize: scrollableViewportWidth,
    overscanCount: columnOverscanCount,
    minIndex: frozenColumnsCount,
  })

  const renderedRowRange =
    renderMode === "full"
      ? createFullRange(
          frozenRowsCount,
          Math.max(
            Math.min(
              fullRenderRowCount !== undefined
                ? frozenRowsCount + fullRenderRowCount - 1
                : rowCache.getCount() - 1,
              rowCache.getCount() - 1,
            ),
            frozenRowsCount - 1,
          ),
        )
      : rowRanges.rendered

  const renderedColumnRange =
    renderMode === "full"
      ? createFullRange(
          frozenColumnsCount,
          Math.max(
            Math.min(
              fullRenderColumnCount !== undefined
                ? frozenColumnsCount + fullRenderColumnCount - 1
                : columnCache.getCount() - 1,
              columnCache.getCount() - 1,
            ),
            frozenColumnsCount - 1,
          ),
        )
      : columnRanges.rendered

  return {
    rows: {
      ...rowRanges,
      rendered: renderedRowRange,
    },
    columns: {
      ...columnRanges,
      rendered: renderedColumnRange,
    },
    panes: partitionPanes({
      rowRanges: {
        ...rowRanges,
        rendered: renderedRowRange,
      },
      columnRanges: {
        ...columnRanges,
        rendered: renderedColumnRange,
      },
      frozenRowsCount,
      frozenColumnsCount,
    }),
    totalWidth,
    totalHeight,
    frozenWidth,
    frozenHeight,
  }
}
