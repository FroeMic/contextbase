import { memo, type ReactNode } from "react"
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

interface GridValueCellProps {
  value: ReactNode
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  style?: React.CSSProperties
  className?: string
  columnIndex?: number
  rowIndex?: number
  showVerticalLine?: boolean
  showHorizontalLine?: boolean
  isSelected?: boolean
  isActive?: boolean
  isPreviewOpen?: boolean
  interactionAttributes?: Record<string, unknown>
  onClick?: React.MouseEventHandler<HTMLDivElement>
  rowId?: string
}

export const GridValueCell = memo(function GridValueCell({
  value,
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
  rowId,
}: GridValueCellProps) {
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
      {...interactionAttributes}
    >
      <div className="flex h-full min-h-0 w-full items-center overflow-hidden text-ellipsis whitespace-nowrap px-2 py-0 text-sm leading-5 md:text-xs md:leading-4 [&_*]:!text-sm md:[&_*]:!text-xs">
        {value}
      </div>
    </div>
  )
})
