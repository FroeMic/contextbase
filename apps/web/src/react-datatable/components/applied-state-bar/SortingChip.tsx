import { memo, useCallback, useState } from "react"
import { useIsMobile } from "@/shared/hooks/use-mobile"
import { useDatatableColumns } from "../../core/DatatableProvider"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import { DatatableMobileDrawerNavigator } from "../mobile/DatatableMobileDrawerNavigator"
import { CaretDownIcon, XIcon } from "../ui/icons"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import { SearchableDropdown } from "../ui/searchable-dropdown"
import {
  SORTING_DRAWER_INITIAL_PAGE,
  SORTING_DRAWER_INITIAL_PARAMS,
  type SortingDrawerPageId,
  type SortingDrawerPageParams,
  useMobileSortingDrawerPages,
} from "./MobileSortingDrawerContent"
import { SortingPopover } from "./SortingPopover"

/**
 * Sorting chip component
 *
 * Shows active column sorting as a chip in the applied filters bar.
 * Always appears first, before filter chips.
 *
 * Two variants:
 * - Single sort: [Ordered by] | [Column Name] | [Asc/Desc ▼] | [X]
 * - Multi sort: [Ordered by] | [Multiple columns] | [X]
 *
 * Features:
 * - Click column name or "Multiple columns" to open popover with sort list
 * - Click direction dropdown to switch between Ascending/Descending (single sort only)
 * - Click X to clear all sorting
 */
export const SortingChip = memo(() => {
  const columns = useDatatableColumns()
  const sorting = useDatatableStore((s) => s.sorting)
  const setSorting = useDatatableStore((s) => s.setSorting)
  const toggleSortDirection = useDatatableStore((s) => s.toggleSortDirection)

  const [popoverOpen, setPopoverOpen] = useState(false)
  const [directionDropdownOpen, setDirectionDropdownOpen] = useState(false)
  const isMobile = useIsMobile()
  const mobilePages = useMobileSortingDrawerPages()

  // Get primary sort (first in array)
  const primarySort = sorting[0]
  const isMultiSort = sorting.length > 1

  // Handle clear all sorting
  const handleClear = useCallback(() => {
    setSorting([])
  }, [setSorting])

  // Don't render if no sorting
  if (!primarySort) {
    return null
  }

  const renderMobileDrawer = (label: string) => (
    <>
      <div className="bg-background inline-flex h-7 items-center divide-x overflow-hidden rounded-full border text-sm">
        <span className="text-muted-foreground px-2">Ordered by</span>
        <button
          className="hover:bg-accent h-full px-2 font-medium transition-colors"
          aria-label="Manage column sorting"
          onClick={() => setPopoverOpen(true)}
          type="button"
        >
          {label}
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="hover:bg-accent text-muted-foreground hover:text-foreground h-full px-2 transition-colors"
          aria-label="Clear sorting"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
      <DatatableMobileDrawerNavigator<SortingDrawerPageId, SortingDrawerPageParams>
        initialPage={SORTING_DRAWER_INITIAL_PAGE}
        initialParams={SORTING_DRAWER_INITIAL_PARAMS}
        onOpenChange={setPopoverOpen}
        open={popoverOpen}
        pages={mobilePages}
      />
    </>
  )

  // Multi-sort chip: [Ordered by] | [Multiple columns] | [X]
  if (isMultiSort) {
    if (isMobile) {
      return renderMobileDrawer("Multiple columns")
    }

    return (
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <div className="bg-background inline-flex h-6 items-center divide-x overflow-hidden rounded-full border text-xs">
          {/* Label segment */}
          <span className="text-muted-foreground px-2">Ordered by</span>

          {/* Multiple columns segment - clickable */}
          <PopoverTrigger asChild>
            <button
              className="hover:bg-accent h-full px-2 font-medium transition-colors"
              aria-label="Manage column sorting"
            >
              Multiple columns
            </button>
          </PopoverTrigger>

          {/* Remove button segment */}
          <button
            type="button"
            onClick={handleClear}
            className="hover:bg-accent text-muted-foreground hover:text-foreground h-full px-2 transition-colors"
            aria-label="Clear all sorting"
          >
            <XIcon className="h-3 w-3" />
          </button>
        </div>

        <PopoverContent className="p-0" align="start">
          <SortingPopover />
        </PopoverContent>
      </Popover>
    )
  }

  // Single-sort chip: [Ordered by] | [Column Name] | [Asc/Desc ▼] | [X]
  const column = columns.find((c) => c.id === primarySort.id)
  const columnName = column?.meta?.displayName ?? column?.header ?? "Unknown"

  if (isMobile) {
    return renderMobileDrawer(columnName)
  }

  return (
    <>
      {/* Column name popover */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <div className="bg-background inline-flex h-6 items-center divide-x overflow-hidden rounded-full border text-xs">
          {/* Label segment */}
          <span className="text-muted-foreground px-2">Ordered by</span>

          {/* Column name segment - clickable */}
          <PopoverTrigger asChild>
            <button
              className="hover:bg-accent h-full px-2 font-medium transition-colors"
              aria-label="Manage column sorting"
            >
              {columnName}
            </button>
          </PopoverTrigger>

          {/* Direction dropdown segment */}
          <DirectionDropdown
            isDesc={primarySort.desc}
            onToggle={() => toggleSortDirection(primarySort.id)}
            open={directionDropdownOpen}
            onOpenChange={setDirectionDropdownOpen}
          />

          {/* Remove button segment */}
          <button
            type="button"
            onClick={handleClear}
            className="hover:bg-accent text-muted-foreground hover:text-foreground h-full px-2 transition-colors"
            aria-label="Clear sorting"
          >
            <XIcon className="h-3 w-3" />
          </button>
        </div>

        <PopoverContent className="p-0" align="start">
          <SortingPopover />
        </PopoverContent>
      </Popover>
    </>
  )
})

SortingChip.displayName = "SortingChip"

/**
 * Direction dropdown component
 * Shows "Ascending" or "Descending" with searchable dropdown
 */
interface DirectionDropdownProps {
  isDesc: boolean
  onToggle: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DirectionDropdown = memo(
  ({ isDesc, onToggle, open, onOpenChange }: DirectionDropdownProps) => {
    const directionOptions = [
      { value: "asc" as const, label: "Ascending" },
      { value: "desc" as const, label: "Descending" },
    ]

    const currentOption = directionOptions.find((opt) => (opt.value === "desc") === isDesc)

    const handleSelect = useCallback(
      (option: (typeof directionOptions)[number]) => {
        // Only toggle if different from current
        if ((option.value === "desc") !== isDesc) {
          onToggle()
        }
      },
      [isDesc, onToggle],
    )

    return (
      <SearchableDropdown
        open={open}
        onOpenChange={onOpenChange}
        items={directionOptions}
        getItemKey={(option) => option.value}
        renderItem={(option) => option.label}
        onSelect={handleSelect}
        filterFn={(opt, search) => opt.label.toLowerCase().includes(search.toLowerCase())}
        searchPlaceholder="Search"
        emptyText="No options found"
        align="start"
        width="w-48"
      >
        <button
          type="button"
          className="hover:bg-accent text-muted-foreground flex h-full items-center gap-1 px-2 transition-colors"
        >
          <span>{currentOption?.label}</span>
          <CaretDownIcon className="h-3 w-3" />
        </button>
      </SearchableDropdown>
    )
  },
)

DirectionDropdown.displayName = "DirectionDropdown"
