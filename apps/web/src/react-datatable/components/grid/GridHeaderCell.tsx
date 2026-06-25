import { flexRender, type Header } from "@tanstack/react-table"
import { memo, useCallback, useState } from "react"
import { useDatatableResizeSession } from "../../core/ColumnResizeSessionContext"
import { useDatatableColumns } from "../../core/DatatableProvider"
import { Z_INDEX } from "../../core/layout/constants"
import { DateFilterEditor } from "../../features/filters/editors/DateFilterEditor"
import { TextListFilterEditor } from "../../features/filters/editors/TextListFilterEditor"
import { FilterEditorModal } from "../../features/filters/FilterEditorModal"
import { cn } from "../../shared/utils/cn"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import type { ColumnMetadata } from "../../types/column.types"
import type { DateFilterPayload, TextListFilterPayload } from "../../types/filter.types"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../ui/dropdown-menu"
import { ArrowDownIcon, ArrowUpIcon, FunnelIcon } from "../ui/icons"
import { HeaderActionMenu } from "./HeaderActionMenu"
import { ResizeHandle } from "./ResizeHandle"

export interface GridHeaderCellProps<TData> {
  header: Header<TData, unknown>
  x: number
  y: number
  width: number
  height: number
  isFrozen: boolean
  style?: React.CSSProperties
  columnIndex: number
  showVerticalLine?: boolean
  showHorizontalLine?: boolean
  dragHandleListeners?: Record<string, unknown>
  rootRef?: (node: HTMLDivElement | null) => void
  rootAttributes?: Record<string, unknown>
  isDragging?: boolean
  transform?: string
  transition?: string
  showResizeHandle?: boolean
}

interface GridHeaderCellContentProps<TData> {
  header: Header<TData, unknown>
  dragHandleListeners?: Record<string, unknown>
}

const GridHeaderCellContent = memo(function GridHeaderCellContent<TData>({
  header,
  dragHandleListeners,
}: GridHeaderCellContentProps<TData>) {
  const colId = header.column.id
  const column = header.column
  const columnDef = column.columnDef

  const sorting = useDatatableStore((s) => s.sorting)
  const columnFilters = useDatatableStore((s) => s.columnFilters)
  const setSorting = useDatatableStore((s) => s.setSorting)
  const setColumnFilter = useDatatableStore((s) => s.setColumnFilter)
  const columns = useDatatableColumns()

  const [isHeaderHovered, setIsHeaderHovered] = useState(false)
  const [isActionButtonHovered, setIsActionButtonHovered] = useState(false)

  const columnMeta = columnDef.meta as ColumnMetadata | undefined

  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)

  const handleTextListChange = useCallback(
    (payload: TextListFilterPayload | null) => {
      setColumnFilter(colId, "text-list", payload)
    },
    [colId, setColumnFilter],
  )

  const handleDateChange = useCallback(
    (payload: DateFilterPayload | null) => {
      setColumnFilter(colId, "date", payload)
    },
    [colId, setColumnFilter],
  )

  if (columnMeta?.isSpacer) {
    return null
  }

  const currentSort = sorting.find((s) => s.id === colId)
  const sortIndex = sorting.findIndex((s) => s.id === colId)
  const isSorted = !!currentSort
  const hasActiveFilter = columnFilters.some((f) => f.id === colId)
  const filterType = columnMeta?.filterType

  const handleSortToggle = (e: React.MouseEvent) => {
    e.stopPropagation()

    if (!currentSort) {
      setSorting([...sorting, { id: colId, desc: false }])
    } else if (!currentSort.desc) {
      const newSorting = sorting.map((s) => (s.id === colId ? { ...s, desc: true } : s))
      setSorting(newSorting)
    } else {
      const newSorting = sorting.map((s) => (s.id === colId ? { ...s, desc: false } : s))
      setSorting(newSorting)
    }
  }

  const handleFilterClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setFilterDropdownOpen(true)
  }

  const columnMetadata = columns.find((col) => col.id === colId)

  return (
    <div
      className="group relative h-full w-full"
      onMouseEnter={() => setIsHeaderHovered(true)}
      onMouseLeave={() => setIsHeaderHovered(false)}
    >
      <div
        className="absolute inset-0 flex items-center select-none text-sm md:text-xs text-muted-foreground"
        style={{ zIndex: 0, pointerEvents: "auto" }}
        {...dragHandleListeners}
      >
        <span
          className={cn(
            "block truncate text-left font-medium transition-opacity duration-150 px-2",
          )}
          style={{ pointerEvents: "auto" }}
        >
          {header.isPlaceholder
            ? null
            : flexRender(header.column.columnDef.header, header.getContext())}
        </span>
      </div>

      <div
        className={cn(
          "absolute right-1 top-1/2 -translate-y-1/2 z-20 flex items-center gap-0.5 transition-opacity duration-150 text-xs text-muted-foreground",
        )}
      >
        {isSorted && columnDef.enableSorting !== false && (
          <button
            type="button"
            onClick={handleSortToggle}
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded p-0.5 hover:bg-accent opacity-100"
            aria-label={`Sort ${columnDef.header}`}
          >
            <div className="flex items-center gap-0.5">
              {currentSort?.desc ? (
                <ArrowDownIcon className="h-3 w-3" />
              ) : (
                <ArrowUpIcon className="h-3 w-3" />
              )}
              {sorting.length > 1 && (
                <span className="text-muted-foreground text-xs">{sortIndex + 1}</span>
              )}
            </div>
          </button>
        )}

        {hasActiveFilter && filterType === "text-list" && columnMetadata ? (
          <DropdownMenu open={filterDropdownOpen} onOpenChange={setFilterDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={handleFilterClick}
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded p-0.5 hover:bg-accent opacity-100"
                aria-label={`Filter ${columnDef.header}`}
              >
                <FunnelIcon className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-[300px] w-64 overflow-y-auto" align="start">
              <TextListFilterEditor
                column={columnMetadata}
                value={
                  (columnFilters.find((f) => f.id === colId)?.payload as TextListFilterPayload) ??
                  null
                }
                onChange={handleTextListChange}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        ) : hasActiveFilter && filterType === "date" && columnMetadata ? (
          <DropdownMenu open={filterDropdownOpen} onOpenChange={setFilterDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={handleFilterClick}
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded p-0.5 hover:bg-accent opacity-100"
                aria-label={`Filter ${columnDef.header}`}
              >
                <FunnelIcon className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-[400px] w-64 overflow-y-auto" align="start">
              <DateFilterEditor
                column={columnMetadata}
                value={
                  (columnFilters.find((f) => f.id === colId)?.payload as DateFilterPayload) ?? null
                }
                onChange={handleDateChange}
                onClose={() => setFilterDropdownOpen(false)}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        ) : hasActiveFilter ? (
          <>
            <button
              type="button"
              onClick={handleFilterClick}
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded p-0.5 hover:bg-accent opacity-100"
              aria-label={`Filter ${columnDef.header}`}
            >
              <FunnelIcon className="h-3 w-3" />
            </button>
            <FilterEditorModal
              columnId={colId}
              open={filterDropdownOpen}
              onClose={() => setFilterDropdownOpen(false)}
            />
          </>
        ) : null}

        <HeaderActionMenu
          column={column}
          show={isHeaderHovered}
          isHovered={isActionButtonHovered}
          onHoverChange={setIsActionButtonHovered}
          currentSort={currentSort}
          hasActiveFilter={hasActiveFilter}
        />
      </div>
    </div>
  )
}) as <TData>(props: GridHeaderCellContentProps<TData>) => React.JSX.Element

/**
 * Grid-compatible header cell with full interactivity
 *
 * Features:
 * - Sorting (click to toggle, multi-sort support)
 * - Filtering (funnel icon with dropdown/modal)
 * - Column resizing (drag handle on right edge)
 * - Column reordering (drag & drop with @dnd-kit)
 * - Header action menu (three dots)
 *
 * Uses absolute positioning to work with grid virtualization.
 */
export const GridHeaderCell = memo(function GridHeaderCell<TData>({
  header,
  x,
  y,
  width,
  height,
  isFrozen,
  style,
  columnIndex,
  showVerticalLine = true,
  showHorizontalLine = true,
  dragHandleListeners,
  rootRef,
  rootAttributes,
  isDragging = false,
  transform,
  transition,
  showResizeHandle = true,
}: GridHeaderCellProps<TData>) {
  const colId = header.column.id
  const { activeResizeSession } = useDatatableResizeSession()
  const isResizing = activeResizeSession?.columnId === colId
  const [isResizeHovered, setIsResizeHovered] = useState(false)
  const ariaSortValue = header.column.getIsSorted()
    ? header.column.getIsSorted() === "desc"
      ? "descending"
      : "ascending"
    : undefined
  const combinedTransform =
    style?.transform && transform
      ? `${style.transform} ${transform}`.trim()
      : style?.transform || transform
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { transform: _ignoredTransform, ...styleWithoutTransform } = style || {}

  return (
    <div
      ref={rootRef}
      {...rootAttributes}
      role="columnheader"
      aria-colindex={columnIndex + 1}
      aria-rowindex={1}
      aria-sort={ariaSortValue}
      data-column-id={colId}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        zIndex: isDragging
          ? Z_INDEX.DRAGGING_COLUMN
          : isResizing || isResizeHovered
            ? Z_INDEX.RESIZING_COLUMN
            : isFrozen
              ? Z_INDEX.GRID.FROZEN_HEADER
              : Z_INDEX.GRID.SCROLLABLE_HEADER,
        boxSizing: "border-box",
        backgroundColor: "var(--background)",
        borderRight: showVerticalLine ? "1px solid var(--border)" : undefined,
        borderBottom: showHorizontalLine ? "1px solid var(--border)" : "1px solid transparent",
        transform: combinedTransform,
        transition,
        opacity: isDragging ? 0 : 1,
        overflow: "visible",
        pointerEvents: isDragging ? "none" : undefined,
        ...styleWithoutTransform,
      }}
    >
      <GridHeaderCellContent header={header} dragHandleListeners={dragHandleListeners} />

      {showResizeHandle && <ResizeHandle header={header} onHoverChange={setIsResizeHovered} />}
    </div>
  )
}) as <TData>(props: GridHeaderCellProps<TData>) => React.JSX.Element
