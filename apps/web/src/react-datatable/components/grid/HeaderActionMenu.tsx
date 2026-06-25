import type { Column } from "@tanstack/react-table"
import { useCallback, useMemo, useState } from "react"
import { useIsMobile } from "@/shared/hooks/use-mobile"
import { COLUMN_WIDTH_DEFAULTS, resolveColumnWidth } from "../../core/column-sizing/column-width"
import { useDatatableColumnSizing } from "../../core/DatatableBody"
import { useDatatableColumns } from "../../core/DatatableProvider"
import { DateFilterEditor } from "../../features/filters/editors/DateFilterEditor"
import { TextListFilterEditor } from "../../features/filters/editors/TextListFilterEditor"
import { FilterEditorModal } from "../../features/filters/FilterEditorModal"
import { cn } from "../../shared/utils/cn"
import { useDatatableStore, useDatatableStoreApi } from "../../state/store/use-datatable-store"
import type { ColumnMetadata } from "../../types/column.types"
import type { DateFilterPayload, TextListFilterPayload } from "../../types/filter.types"
import { DatatableMobileDrawerNavigator } from "../mobile/DatatableMobileDrawerNavigator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import {
  CheckIcon,
  DotsThreeIcon,
  EyeSlashIcon,
  FunnelIcon,
  RulerIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  XIcon,
} from "../ui/icons"
import { ResizeColumnDialog } from "./ResizeColumnDialog"
import {
  HEADER_ACTION_DRAWER_INITIAL_PAGE,
  HEADER_ACTION_DRAWER_INITIAL_PARAMS,
  type HeaderActionDrawerPageId,
  type HeaderActionDrawerPageParams,
  useMobileHeaderActionDrawerPages,
} from "./MobileHeaderActionDrawerContent"

interface HeaderActionMenuProps<TData> {
  column: Column<TData, unknown>
  /** Whether to show the menu button */
  show: boolean
  /** Whether this is being hovered */
  isHovered?: boolean
  /** Handler when hover state changes */
  onHoverChange?: (isHovered: boolean) => void
  /** Current sort state for this column */
  currentSort?: { id: string; desc: boolean }
  /** Whether this column has an active filter */
  hasActiveFilter?: boolean
}

/**
 * Header action menu component
 *
 * Three-dot dropdown menu for column actions:
 * - Hide column
 * - Filter (opens appropriate filter UI)
 * - Sort Ascending/Descending (labels vary by column type)
 *
 * Only shows options that are enabled in column config.
 */
export function HeaderActionMenu<TData>({
  column,
  show,
  onHoverChange,
  currentSort,
  hasActiveFilter = false,
}: HeaderActionMenuProps<TData>) {
  const [open, setOpen] = useState(false)
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [resizeDialogOpen, setResizeDialogOpen] = useState(false)
  const isMobile = useIsMobile()
  const store = useDatatableStoreApi()
  const columns = useDatatableColumns()
  const columnFilters = useDatatableStore((s) => s.columnFilters)
  const setColumnFilter = useDatatableStore((s) => s.setColumnFilter)
  const removeColumnFilter = useDatatableStore((s) => s.removeColumnFilter)
  const columnWidths = useDatatableStore((s) => s.columnWidths)
  const setLocalColumnSizing = useDatatableColumnSizing()

  const columnDef = column.columnDef
  const columnId = column.id
  const columnMeta = columnDef.meta as ColumnMetadata | undefined

  // Check what features are enabled (use TanStack's properties)
  const canHide = columnDef.enableHiding !== false
  const canFilter = columnDef.enableColumnFilter !== false
  const canSort = columnDef.enableSorting !== false

  // Get filter type for determining sort labels
  const filterType = columnMeta?.filterType

  // Get column metadata for text-list filter
  const columnMetadata = columns.find((col) => col.id === columnId)
  const currentFilter = columnFilters.find((filter) => filter.id === columnId)

  // Determine sort labels based on column type
  const getSortLabels = (): { asc: string; desc: string } => {
    // Check if this is a text column
    if (filterType === "text" || filterType === "text-list") {
      return { asc: "Sort A-Z", desc: "Sort Z-A" }
    }
    // Default for numbers, dates, and others
    return { asc: "Sort Ascending", desc: "Sort Descending" }
  }

  const sortLabels = getSortLabels()

  // Handle hide action
  const handleHide = () => {
    store.getState().toggleColumnVisibility(columnId)
    setOpen(false)
  }

  // Handle remove filter action
  const handleRemoveFilter = () => {
    removeColumnFilter(columnId)
    setOpen(false)
  }

  // Handle filter action (for non-text-list filters)
  const handleFilter = () => {
    setOpen(false)
    setFilterModalOpen(true)
  }

  // Handle resize action
  const handleResize = () => {
    setOpen(false)
    setResizeDialogOpen(true)
  }

  // Handle text-list filter changes
  const handleTextListChange = useCallback(
    (payload: TextListFilterPayload | null) => {
      setColumnFilter(columnId, "text-list", payload)
      // Don't close - allow multi-selection
    },
    [columnId, setColumnFilter],
  )

  // Handle date filter changes
  const handleDateChange = useCallback(
    (payload: DateFilterPayload | null) => {
      setColumnFilter(columnId, "date", payload)
      // Don't close - allow selecting different presets
    },
    [columnId, setColumnFilter],
  )

  // Handle sort actions
  const handleSort = (desc: boolean) => {
    const sorting = store.getState().sorting
    const existingSort = sorting.find((s) => s.id === columnId)

    if (existingSort) {
      // Update existing sort direction
      const newSorting = sorting.map((s) => (s.id === columnId ? { ...s, desc } : s))
      store.getState().setSorting(newSorting)
    } else {
      // Add new sort
      store.getState().setSorting([...sorting, { id: columnId, desc }])
    }

    setOpen(false)
  }

  // Handle resize actions
  const applyColumnWidth = useCallback(
    (width: number) => {
      // Update Zustand first, then React (sequential, not nested)
      // Both updates happen in same tick - atomic from user's perspective
      // Avoids React warning about updating component during render
      store.getState().setColumnWidth(columnId, width)
      setLocalColumnSizing((prev) => ({ ...prev, [columnId]: width }))
    },
    [columnId, store, setLocalColumnSizing],
  )

  const resetColumnWidth = useCallback(() => {
    // Remove custom width by omitting it from columnWidths
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [columnId]: _, ...rest } = store.getState().columnWidths
    store.getState().setColumnWidths(rest)

    // Reset to default width in local column sizing
    const defaultWidth = columnMetadata?.width ?? COLUMN_WIDTH_DEFAULTS.DEFAULT
    setLocalColumnSizing((prev) => ({ ...prev, [columnId]: defaultWidth }))
  }, [columnId, store, setLocalColumnSizing, columnMetadata])

  // All columns can be resized (width adjustment is a general feature)
  const canResize = columnMetadata !== undefined

  // Compute current width (memoized to avoid recreation on every render)
  const currentWidth = useMemo(
    () =>
      columnMetadata
        ? resolveColumnWidth(columnMetadata, columnWidths[columnId])
        : COLUMN_WIDTH_DEFAULTS.DEFAULT,
    [columnMetadata, columnWidths, columnId],
  )

  const mobilePages = useMobileHeaderActionDrawerPages({
    canFilter,
    canHide,
    canResize,
    canSort,
    column: columnMetadata,
    currentFilter,
    currentSort,
    currentWidth,
    hasActiveFilter,
    onApplyWidth: applyColumnWidth,
    onHide: handleHide,
    onRemoveFilter: handleRemoveFilter,
    onResetWidth: resetColumnWidth,
    onSort: handleSort,
    sortLabels,
  })

  // Don't render if no actions available
  if (!canHide && !canFilter && !canSort && !canResize) {
    return null
  }

  return (
    <>
      {isMobile ? (
        <>
          <button
            type="button"
            onMouseEnter={() => onHoverChange?.(true)}
            onMouseLeave={() => onHoverChange?.(false)}
            className={cn(
              "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded p-0.5 transition-opacity hover:bg-accent",
              show || isMobile ? "opacity-100" : "opacity-0",
            )}
            aria-label={`Column actions for ${columnDef.header}`}
            onClick={() => setOpen(true)}
          >
            <DotsThreeIcon className="h-5 w-5" weight="bold" />
          </button>
          <DatatableMobileDrawerNavigator<HeaderActionDrawerPageId, HeaderActionDrawerPageParams>
            initialPage={HEADER_ACTION_DRAWER_INITIAL_PAGE}
            initialParams={HEADER_ACTION_DRAWER_INITIAL_PARAMS}
            onOpenChange={setOpen}
            open={open}
            pages={mobilePages}
          />
        </>
      ) : (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onMouseEnter={() => onHoverChange?.(true)}
              onMouseLeave={() => onHoverChange?.(false)}
              className={cn(
                "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded p-0.5 transition-opacity hover:bg-accent",
                show ? "opacity-100" : "opacity-0",
              )}
              aria-label={`Column actions for ${columnDef.header}`}
            >
              <DotsThreeIcon className="h-4 w-4" weight="bold" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-48">
            {canHide && (
              <DropdownMenuItem onClick={handleHide} className="text-xs">
                <EyeSlashIcon className="mr-2 h-4 w-4" />
                Hide
              </DropdownMenuItem>
            )}

            {canResize && (
              <DropdownMenuItem onClick={handleResize} className="text-xs">
                <RulerIcon className="mr-2 h-4 w-4" />
                Resize...
              </DropdownMenuItem>
            )}

            {canFilter && filterType === "text-list" && columnMetadata ? (
              // Text-list filter: Use submenu with checkboxes
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-xs">
                  <FunnelIcon className="mr-2 h-4 w-4" />
                  Filter...
                  {hasActiveFilter && <CheckIcon className="ml-auto size-3" />}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="max-h-[300px] w-64 overflow-y-auto">
                    <TextListFilterEditor
                      column={columnMetadata}
                      value={
                        (columnFilters.find((f) => f.id === columnId)
                          ?.payload as TextListFilterPayload) ?? null
                      }
                      onChange={handleTextListChange}
                    />
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            ) : canFilter && filterType === "date" && columnMetadata ? (
              // Date filter: Use submenu with preset list
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-xs">
                  <FunnelIcon className="mr-2 h-4 w-4" />
                  Filter...
                  {hasActiveFilter && <CheckIcon className="ml-auto size-3" />}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="max-h-[400px] w-64 overflow-y-auto">
                    <DateFilterEditor
                      column={columnMetadata}
                      value={
                        (columnFilters.find((f) => f.id === columnId)
                          ?.payload as DateFilterPayload) ?? null
                      }
                      onChange={handleDateChange}
                      onClose={() => setOpen(false)}
                    />
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            ) : canFilter ? (
              // Other filter types: Open modal
              <DropdownMenuItem onClick={handleFilter} className="text-xs">
                <FunnelIcon className="mr-2 h-4 w-4" />
                Filter...
                {hasActiveFilter && <CheckIcon className="ml-auto size-3" />}
              </DropdownMenuItem>
            ) : null}

            {/* Remove Filter option - only shown when filter is active */}
            {hasActiveFilter && (
              <DropdownMenuItem onClick={handleRemoveFilter} className="text-xs">
                <XIcon className="mr-2 h-4 w-4" />
                Remove Filter
              </DropdownMenuItem>
            )}

            {canSort && (
              <>
                <DropdownMenuItem onClick={() => handleSort(false)} className="text-xs">
                  <SortAscendingIcon className="mr-2 h-4 w-4" />
                  {sortLabels.asc}
                  {currentSort && !currentSort.desc && <CheckIcon className="ml-auto size-3" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSort(true)} className="text-xs">
                  <SortDescendingIcon className="mr-2 h-4 w-4" />
                  {sortLabels.desc}
                  {currentSort && currentSort.desc && <CheckIcon className="ml-auto size-3" />}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Filter editor modal */}
      <FilterEditorModal
        columnId={columnId}
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
      />

      {/* Resize column dialog */}
      <ResizeColumnDialog
        column={columnMetadata ?? null}
        open={resizeDialogOpen}
        onClose={() => setResizeDialogOpen(false)}
        currentWidth={currentWidth}
        onApply={applyColumnWidth}
        onReset={resetColumnWidth}
      />
    </>
  )
}
