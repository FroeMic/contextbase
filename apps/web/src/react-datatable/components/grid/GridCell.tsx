import { type Cell, flexRender } from "@tanstack/react-table"
import { memo } from "react"
import { isRowClickSuppressed } from "../../../shared/ui/row-click-suppression"
import { cn } from "../../shared/utils/cn"

const interactiveSelector = [
  "button",
  "a[href]",
  "input",
  "select",
  "textarea",
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[data-prevent-row-click="true"]',
].join(", ")

function shouldIgnoreRowClick(target: EventTarget | null, currentTarget: HTMLDivElement) {
  if (!(target instanceof Element)) {
    return false
  }

  const interactiveElement = target.closest(interactiveSelector)
  return interactiveElement !== null && currentTarget.contains(interactiveElement)
}

interface GridCellProps<TData> {
  /** TanStack Table cell instance containing data and column info */
  cell: Cell<TData, unknown> | null

  /** Absolute X position in pixels */
  x: number

  /** Absolute Y position in pixels */
  y: number

  /** Cell width in pixels */
  width: number

  /** Cell height in pixels */
  height: number

  /** Z-index for stacking order */
  zIndex: number

  /** Additional CSS styles */
  style?: React.CSSProperties
  className?: string

  /** Column index for ARIA grid semantics (1-based when rendered) */
  columnIndex?: number

  /** Row index for ARIA grid semantics (1-based when rendered) */
  rowIndex?: number

  /** Whether to render the right separator line */
  showVerticalLine?: boolean

  /** Whether to render the bottom separator line */
  showHorizontalLine?: boolean

  /** Row interaction flags */
  isSelected?: boolean
  isActive?: boolean
  isPreviewOpen?: boolean

  /** Additional DOM attributes derived from row/cell presentation hooks */
  interactionAttributes?: Record<string, unknown>

  /** Optional click handler for row-level interactions */
  onClick?: React.MouseEventHandler<HTMLDivElement>
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>
  rowId?: string
}

interface GridCellContentProps<TData> {
  cell: Cell<TData, unknown>
}

const GridCellContent = memo(function GridCellContent<TData>({
  cell,
}: GridCellContentProps<TData>) {
  return (
    <div className="flex h-full min-h-0 w-full items-center overflow-hidden text-ellipsis whitespace-nowrap px-2 py-0 text-sm leading-5 md:text-xs md:leading-4 [&_*]:!text-sm md:[&_*]:!text-xs">
      {cell.column.columnDef.cell
        ? flexRender(cell.column.columnDef.cell, cell.getContext())
        : (cell.getValue() as React.ReactNode)}
    </div>
  )
}) as <TData>(props: GridCellContentProps<TData>) => React.JSX.Element

/**
 * Base grid cell component with absolute positioning
 *
 * This is the fundamental building block for grid-based rendering.
 * Works for both virtualized and static modes.
 *
 * Key features:
 * - Absolute positioning at (x, y)
 * - Fixed width and height
 * - Z-index for layering (frozen > header > data)
 * - Shadow for frozen columns
 * - Memoized for performance
 */
export const GridCell = memo(function GridCell<TData>({
  cell,
  x,
  y,
  width,
  height,
  zIndex,
  style,
  className,
  columnIndex,
  rowIndex,
  showVerticalLine = true,
  showHorizontalLine = true,
  isSelected = false,
  isActive = false,
  isPreviewOpen = false,
  interactionAttributes,
  onClick,
  onMouseEnter,
  onMouseLeave,
  rowId,
}: GridCellProps<TData>) {
  if (!cell) {
    return null
  }

  return (
    <div
      role="gridcell"
      aria-colindex={columnIndex !== undefined ? columnIndex + 1 : undefined}
      aria-rowindex={rowIndex !== undefined ? rowIndex + 1 : undefined}
      data-row-id={rowId}
      data-selected={isSelected || undefined}
      data-active={isActive || undefined}
      data-preview-open={isPreviewOpen || undefined}
      className={cn("bg-transparent text-sm leading-5 md:text-xs md:leading-4", className)}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        zIndex,
        boxSizing: "border-box",
        borderRight: showVerticalLine ? "1px solid var(--border)" : undefined,
        borderBottom: showHorizontalLine ? "1px solid var(--border)" : "1px solid transparent",
        ...style,
      }}
      onClick={(event) => {
        if (shouldIgnoreRowClick(event.target, event.currentTarget) || isRowClickSuppressed()) {
          return
        }

        onClick?.(event)
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      {...interactionAttributes}
    >
      <GridCellContent cell={cell} />
    </div>
  )
}) as <TData>(props: GridCellProps<TData>) => React.JSX.Element
