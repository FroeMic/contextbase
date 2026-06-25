import type { Header } from "@tanstack/react-table"
import type { DataCellRenderer } from "../../core/cell-rendering/data-cell-renderer"
import type { PositionCache } from "../../core/viewport/position-cache"
import type { RenderableRow } from "../../types/renderable-row.types"
import { GridHeaderCell } from "./GridHeaderCell"
import { LoadingGridCell } from "./LoadingGridCell"

interface DraggedColumnOverlayProps<TData> {
  activeColumnId: string
  header: Header<TData, unknown>
  width: number
  height: number
  headerHeight: number
  stickyColumnsCount: number
  showColumnHeaders: boolean
  showHorizontalLines: boolean
  showVerticalLines: boolean
  renderedRowRange: { startIndex: number; endIndex: number } | null
  getRenderableRowAt: (rowIndex: number) => RenderableRow<TData> | null
  rowCache: PositionCache
  scrollTop: number
  dataCellRenderer: DataCellRenderer<TData>
}

export function DraggedColumnOverlay<TData>({
  activeColumnId,
  header,
  width,
  height,
  headerHeight,
  stickyColumnsCount,
  showColumnHeaders,
  showHorizontalLines,
  showVerticalLines,
  renderedRowRange,
  getRenderableRowAt,
  rowCache,
  scrollTop,
  dataCellRenderer,
}: DraggedColumnOverlayProps<TData>) {
  const rows = renderedRowRange
    ? Array.from(
        { length: renderedRowRange.endIndex - renderedRowRange.startIndex + 1 },
        (_, offset) => renderedRowRange.startIndex + offset,
      )
    : []

  return (
    <div
      className="bg-background/95 pointer-events-none relative overflow-hidden rounded-md ring-1 ring-border shadow-xl shadow-black/15 backdrop-blur-[2px] dark:ring-foreground/30 dark:shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
      style={{
        width,
        height,
      }}
    >
      {showColumnHeaders && (
        <GridHeaderCell
          header={header}
          x={0}
          y={0}
          width={width}
          height={headerHeight}
          isFrozen={stickyColumnsCount > 0}
          columnIndex={0}
          showVerticalLine={showVerticalLines}
          showHorizontalLine={showHorizontalLines}
          showResizeHandle={false}
          style={{
            pointerEvents: "none",
          }}
        />
      )}

      {rows.map((rowIndex) => {
        if (showColumnHeaders && rowIndex === 0) {
          return null
        }

        const item = getRenderableRowAt(rowIndex)
        const top = rowCache.getOffset(rowIndex) - scrollTop
        const rowHeight = rowCache.getSizeAt(rowIndex)

        if (!item || item.type === "group-header") {
          return (
            <div
              key={`drag-gap-${rowIndex}`}
              style={{
                position: "absolute",
                top,
                left: 0,
                width,
                height: rowHeight,
                boxSizing: "border-box",
                borderRight: showVerticalLines ? "1px solid var(--border)" : undefined,
                borderBottom: showHorizontalLines
                  ? "1px solid var(--border)"
                  : "1px solid transparent",
                backgroundColor: "var(--background)",
                opacity: 0.9,
              }}
            />
          )
        }

        if (item.type === "loading") {
          return (
            <LoadingGridCell
              key={`drag-loading-${rowIndex}`}
              x={0}
              y={top}
              width={width}
              height={rowHeight}
              zIndex={1}
              showVerticalLine={showVerticalLines}
              showHorizontalLine={showHorizontalLines}
            />
          )
        }

        return dataCellRenderer.renderDataCell({
          row: item,
          columnId: activeColumnId,
          columnIndex: 0,
          rowIndex,
          x: 0,
          y: top,
          width,
          height: rowHeight,
          zIndex: 1,
          isSelected: false,
          isActive: false,
          isPreviewOpen: false,
          showVerticalLine: showVerticalLines,
          showHorizontalLine: showHorizontalLines,
          onClick: () => undefined,
        })
      })}
    </div>
  )
}
