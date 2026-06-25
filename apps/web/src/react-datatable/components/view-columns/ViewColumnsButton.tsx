import { useMemo, useState } from "react"
import { useDatatableColumns } from "../../core/DatatableProvider"
import { VIEW_COLUMNS_BUTTON_WIDTH, Z_INDEX } from "../../core/layout/constants"
import { ColumnVisibilityDropdownContent } from "../../features/column-visibility/ColumnVisibilityDropdownContent"
import { buildColumnVisibilityPresentationModel } from "../../features/column-visibility/column-visibility-presentation"
import { cn } from "../../shared/utils/cn"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import { PlusIcon } from "../ui/icons"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"

interface ViewColumnsButtonProps {
  /**
   * Height of table header in pixels
   */
  headerHeight: number

  /**
   * Height of each row in pixels
   */
  rowHeight: number

  /**
   * Number of visible rows in the table
   */
  visibleRowCount: number

  /**
   * Width of the button in pixels
   * @default 24
   */
  width?: number

  /**
   * Pre-measured scrollbar width (grid mode only - passed from MultiGridWrapper)
   */
  verticalScrollbarWidth?: number
  /**
   * Pre-measured scrollbar height (grid mode only - passed from MultiGridWrapper)
   */
  horizontalScrollbarWidth?: number
}

/**
 * ViewColumnsButton - Right-edge button for quick column visibility management
 *
 * Features:
 * - Absolutely positioned on right edge of table
 * - Height matches header + visible rows (capped at 100%)
 * - Dropdown with two sections: visible (ordered) and hidden (alphabetical)
 * - Toggle visibility without closing dropdown
 * - Search functionality for finding columns
 *
 * Design:
 * - Linear-style minimalist button
 * - Vertical orientation with icon
 * - Overlays table content (table has padding-left to compensate)
 */
export function ViewColumnsButton({
  headerHeight,
  rowHeight,
  visibleRowCount,
  width = VIEW_COLUMNS_BUTTON_WIDTH,
  verticalScrollbarWidth,
  horizontalScrollbarWidth,
}: ViewColumnsButtonProps) {
  const [open, setOpen] = useState(false)

  const columns = useDatatableColumns()
  const columnVisibility = useDatatableStore((s) => s.columnVisibility)
  const columnOrder = useDatatableStore((s) => s.columnOrder)
  const setColumnOrder = useDatatableStore((s) => s.setColumnOrder)
  const setColumnVisibility = useDatatableStore((s) => s.setColumnVisibility)
  const toggleColumnVisibility = useDatatableStore((s) => s.toggleColumnVisibility)

  // Calculate button height (header + all rendered rows including group headers, max 100%)
  const buttonHeight = useMemo(() => {
    const calculatedHeight = headerHeight + rowHeight * visibleRowCount

    return `min(${calculatedHeight}px, calc(100% - ${horizontalScrollbarWidth}px))`
  }, [headerHeight, rowHeight, visibleRowCount, horizontalScrollbarWidth])

  const model = useMemo(
    () =>
      buildColumnVisibilityPresentationModel({
        columns,
        columnOrder,
        columnVisibility,
      }),
    [columnOrder, columnVisibility, columns],
  )

  // Use passed scrollbarWidth for grid mode, or measured width for table mode
  const effectiveScrollbarWidth = verticalScrollbarWidth ?? 0

  return (
    <div
      className={cn([
        "border-border bg-background before:bg-border absolute top-0 flex items-center justify-center border-r before:absolute before:top-0 before:-left-px before:h-full before:w-px",
        !horizontalScrollbarWidth ? "" : "border-b",
      ])}
      style={{
        width: `${width}px`,
        height: buttonHeight,
        right: effectiveScrollbarWidth > 0 ? `${effectiveScrollbarWidth}px` : 0,
        zIndex: Z_INDEX.GRID.FROZEN_BOUNDARIES + 5, // Above grid elements
      }}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-full w-full items-center justify-center transition-colors",
              "hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
              "text-muted-foreground hover:text-foreground",
            )}
            aria-label={`View columns (${model.visibleItems.length} visible, ${model.hiddenItems.length} hidden)`}
          >
            <PlusIcon className="size-3" weight="regular" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="left" align="start" className="w-72 p-0">
          <ColumnVisibilityDropdownContent
            columns={columns}
            columnOrder={columnOrder}
            columnVisibility={columnVisibility}
            onToggleColumn={toggleColumnVisibility}
            onColumnOrderChange={setColumnOrder}
            onColumnVisibilityChange={setColumnVisibility}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
