import { memo, useCallback, useRef, useState } from "react"
import { Input } from "../../components/ui/input"
import {
  SearchableDropdownMenuPortal,
  SearchableDropdownMenuSub,
  SearchableDropdownMenuSubContent,
  SearchableDropdownMenuSubTrigger,
} from "../../components/ui/searchable-dropdown-menu"
import { useOverlaySearchInput } from "../../shared/hooks/use-overlay-search-input"
import { cn } from "../../shared/utils/cn"
import type { DateFilterPayload, TextListFilterPayload } from "../../types/filter.types"
import { DateFilterEditor } from "./editors/DateFilterEditor"
import { TextListFilterEditor } from "./editors/TextListFilterEditor"
import { FilterEditorModal } from "./FilterEditorModal"
import { FilterItem } from "./FilterItem"
import { useFilterPickerState } from "./use-filter-picker-state"

interface FilterDropdownProps {
  onClose: () => void
}

/**
 * Dropdown content for filter selection
 *
 * Shows searchable list of all filterable columns.
 * Users can search by column name and select which column to filter.
 *
 * Features:
 * - Auto-focused search input
 * - Filters by meta.filterName or header (case-insensitive)
 * - Shows only columns where enableFiltering !== false and filterType exists
 * - Empty state when no filters match search
 * - Keyboard navigation with arrow keys and Tab/Shift+Tab
 * - Disables unimplemented filter types (uses constants.ts)
 *
 * Performance:
 * - React.memo prevents re-renders when parent re-renders
 * - Only re-renders when onClose changes
 */

export const FilterDropdown = memo(({ onClose }: FilterDropdownProps) => {
  const { columnFilters, filteredColumns, search, setColumnFilter, setSearch } =
    useFilterPickerState()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [editorColumnId, setEditorColumnId] = useState<string | null>(null)
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null)
  const submenuTriggersRef = useRef<Map<string, HTMLElement>>(new Map())
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { inputClassName } = useOverlaySearchInput(searchInputRef)

  const handleSelectColumn = useCallback((column: (typeof filteredColumns)[number]) => {
    // For text-list and date filters, handled by submenu (no action needed)
    // For other filters, open modal
    if (column.filterType !== "text-list" && column.filterType !== "date") {
      setEditorColumnId(column.id)
    }
  }, [])

  const handleTextListChange = useCallback(
    (columnId: string, payload: TextListFilterPayload | null) => {
      setColumnFilter(columnId, "text-list", payload)
      // Don't close - allow multi-selection
    },
    [setColumnFilter],
  )

  const handleDateChange = useCallback(
    (columnId: string, payload: DateFilterPayload | null) => {
      setColumnFilter(columnId, "date", payload)
      // Don't close - allow multi-selection
    },
    [setColumnFilter],
  )

  const handleEditorClose = useCallback(() => {
    setEditorColumnId(null)
    onClose()
  }, [onClose])

  // Handle keyboard navigation
  // Note: filteredColumns only contains enabled/implemented items, so no need to skip disabled
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (filteredColumns.length === 0) {
        return
      }

      // Tab/Shift+Tab navigation
      if (e.key === "Tab") {
        e.preventDefault()
        const direction = e.shiftKey ? -1 : 1
        setSelectedIndex((prev) => {
          const newIndex = prev + direction
          if (newIndex < 0) {
            return filteredColumns.length - 1
          }
          if (newIndex >= filteredColumns.length) {
            return 0
          }
          return newIndex
        })
        return
      }

      // Arrow key navigation
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setOpenSubmenuId(null) // Close any open submenu when navigating
        setSelectedIndex((prev) => (prev + 1) % filteredColumns.length)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setOpenSubmenuId(null) // Close any open submenu when navigating
        setSelectedIndex((prev) => (prev - 1 + filteredColumns.length) % filteredColumns.length)
      } else if (e.key === "Enter") {
        // Enter opens the selected filter (modal or submenu)
        e.preventDefault()
        const selectedColumn = filteredColumns[selectedIndex]
        if (selectedColumn) {
          if (selectedColumn.filterType === "text-list" || selectedColumn.filterType === "date") {
            setOpenSubmenuId(selectedColumn.id)
          } else {
            handleSelectColumn(selectedColumn)
          }
        }
      } else if (e.key === "ArrowRight") {
        // ArrowRight only opens submenus (text-list and date filters)
        e.preventDefault()
        const selectedColumn = filteredColumns[selectedIndex]
        if (selectedColumn?.filterType === "text-list" || selectedColumn?.filterType === "date") {
          setOpenSubmenuId(selectedColumn.id)
        }
      }
    },
    [filteredColumns, selectedIndex, handleSelectColumn],
  )

  return (
    <>
      <div className="flex flex-col" onKeyDown={handleKeyDown} role="menu">
        {/* Search input - sticky at top */}
        <div className="bg-popover sticky top-0 z-10 border-b p-0.5">
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Filter..."
            aria-label="Search filter columns"
            className={cn(
              "inline-input h-8 border-none bg-transparent px-2 py-1 focus-visible:ring-0 focus-visible:outline-none",
              inputClassName,
            )}
          />
        </div>

        {/* Filter list - scrollable */}
        <div className="scrollbar-hidden max-h-80 overflow-y-auto p-1">
          {filteredColumns.length === 0 ? (
            <div className="text-muted-foreground px-3 py-8 text-center text-sm">
              No filters found
            </div>
          ) : (
            filteredColumns.map((col, index) => {
              // For text-list filters, render with nested submenu
              if (col.filterType === "text-list") {
                const currentFilter = columnFilters.find((f) => f.id === col.id)
                const currentPayload = currentFilter?.payload as TextListFilterPayload | undefined
                const isSelected = index === selectedIndex

                const isOpen = openSubmenuId === col.id

                return (
                  <SearchableDropdownMenuSub
                    key={col.id}
                    open={isOpen}
                    onOpenChange={(open) => {
                      // Blur trigger and refocus search input when closing
                      if (!open) {
                        const trigger = submenuTriggersRef.current.get(col.id)
                        trigger?.blur()

                        // Return focus to search input so trigger doesn't stay focused
                        // Use setTimeout to let Radix finish its focus management first
                        // Note: No cleanup needed because:
                        // 1. This callback is synchronous with user interaction
                        // 2. Component won't unmount mid-close (Radix manages lifecycle)
                        // 3. If component unmounts, focusing a detached element is harmless
                        setTimeout(() => {
                          searchInputRef.current?.focus()
                        }, 0)
                      }
                      setOpenSubmenuId(open ? col.id : null)
                    }}
                  >
                    <SearchableDropdownMenuSubTrigger
                      ref={(el) => {
                        if (el) {
                          submenuTriggersRef.current.set(col.id, el)
                        } else {
                          submenuTriggersRef.current.delete(col.id)
                        }
                      }}
                      className={cn(
                        "inline-button mx-0 w-full !text-xs",
                        isSelected && !isOpen && "bg-accent/50 text-accent-foreground",
                      )}
                    >
                      <FilterItem column={col} onSelect={() => {}} isSelected={false} asChild />
                    </SearchableDropdownMenuSubTrigger>
                    <SearchableDropdownMenuPortal>
                      <SearchableDropdownMenuSubContent>
                        <TextListFilterEditor
                          column={col}
                          value={currentPayload ?? null}
                          onChange={(payload) => handleTextListChange(col.id, payload)}
                        />
                      </SearchableDropdownMenuSubContent>
                    </SearchableDropdownMenuPortal>
                  </SearchableDropdownMenuSub>
                )
              }

              // For date filters, render with nested submenu
              if (col.filterType === "date") {
                const currentFilter = columnFilters.find((f) => f.id === col.id)
                const currentPayload = currentFilter?.payload as DateFilterPayload | undefined
                const isSelected = index === selectedIndex

                const isOpen = openSubmenuId === col.id

                return (
                  <SearchableDropdownMenuSub
                    key={col.id}
                    open={isOpen}
                    onOpenChange={(open) => {
                      // Blur trigger and refocus search input when closing
                      if (!open) {
                        const trigger = submenuTriggersRef.current.get(col.id)
                        trigger?.blur()

                        setTimeout(() => {
                          searchInputRef.current?.focus()
                        }, 0)
                      }
                      setOpenSubmenuId(open ? col.id : null)
                    }}
                  >
                    <SearchableDropdownMenuSubTrigger
                      ref={(el) => {
                        if (el) {
                          submenuTriggersRef.current.set(col.id, el)
                        } else {
                          submenuTriggersRef.current.delete(col.id)
                        }
                      }}
                      className={cn(
                        "inline-button mx-0 w-full !text-xs",
                        isSelected && !isOpen && "bg-accent/50 text-accent-foreground",
                      )}
                    >
                      <FilterItem column={col} onSelect={() => {}} isSelected={false} asChild />
                    </SearchableDropdownMenuSubTrigger>
                    <SearchableDropdownMenuPortal>
                      <SearchableDropdownMenuSubContent>
                        <DateFilterEditor
                          column={col}
                          value={currentPayload ?? null}
                          onChange={(payload) => handleDateChange(col.id, payload)}
                          onClose={onClose}
                        />
                      </SearchableDropdownMenuSubContent>
                    </SearchableDropdownMenuPortal>
                  </SearchableDropdownMenuSub>
                )
              }

              // For other filters, render normally (opens modal)
              return (
                <FilterItem
                  key={col.id}
                  column={col}
                  onSelect={() => handleSelectColumn(col)}
                  isSelected={index === selectedIndex}
                />
              )
            })
          )}
        </div>
      </div>

      <FilterEditorModal
        columnId={editorColumnId}
        open={!!editorColumnId}
        onClose={handleEditorClose}
      />
    </>
  )
})

FilterDropdown.displayName = "FilterDropdown"
