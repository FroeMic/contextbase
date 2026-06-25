"use client"

import { memo, useCallback, useMemo, useState } from "react"
import { Button } from "../../components/ui/button"
import { ArrowDownIcon, ArrowsLeftRight, ArrowUpIcon, CaretDown } from "../../components/ui/icons"
import { SearchableDropdown } from "../../components/ui/searchable-dropdown"
import { useDatatableColumns } from "../../core/DatatableProvider"
import { cn } from "../../shared/utils/cn"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import type { DatatableColumn } from "../../types/column.types"

/**
 * Ordering Section
 * Allows users to select a column to sort by and toggle direction
 *
 * Matches Linear's design: single line with icon, label, dropdown, and direction toggle
 */
// Define a union type for items: "no-sort" special value or actual columns
type OrderingItem<TData = unknown> =
  | { type: "no-sort" }
  | { type: "column"; column: DatatableColumn<TData> }

interface OrderingSectionProps {
  variant?: "default" | "mobile"
}

export const OrderingSection = memo(({ variant = "default" }: OrderingSectionProps) => {
  const columns = useDatatableColumns()
  const sorting = useDatatableStore((s) => s.sorting)
  const setSorting = useDatatableStore((s) => s.setSorting)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Filter to sortable columns only
  const sortableColumns = useMemo(() => columns.filter((c) => c.enableSorting !== false), [columns])

  // Get primary sort (first in array)
  const primarySort = sorting[0]
  // Build items list: "No sorting" + all sortable columns
  const items = useMemo((): OrderingItem[] => {
    return [
      { type: "no-sort" as const },
      ...sortableColumns.map((col) => ({ type: "column" as const, column: col })),
    ]
  }, [sortableColumns])

  const handleSelect = useCallback(
    (item: OrderingItem) => {
      if (item.type === "no-sort") {
        setSorting([])
      } else {
        setSorting([{ id: item.column.id, desc: primarySort?.desc ?? false }])
      }
    },
    [setSorting, primarySort?.desc],
  )

  const handleDirectionToggle = useCallback(() => {
    if (!primarySort) {
      return
    }
    setSorting([{ ...primarySort, desc: !primarySort.desc }])
  }, [primarySort, setSorting])

  const selectedColumn = primarySort ? sortableColumns.find((c) => c.id === primarySort.id) : null
  const selectedColumnLabel = selectedColumn
    ? (selectedColumn.meta?.displayName ?? selectedColumn.header)
    : primarySort
      ? "Select column"
      : "No sorting"

  // Determine label for the button
  const buttonLabel = sorting.length > 1 ? "Multiple columns" : selectedColumnLabel

  return (
    <div className="flex items-center justify-between gap-2">
      {/* Label with icon */}
      <div
        className={cn(
          "text-muted-foreground flex items-center gap-1.5 text-xs",
          variant === "mobile" && "text-sm",
        )}
      >
        <ArrowsLeftRight
          className={cn("h-3.5 w-3.5 rotate-90 opacity-60", variant === "mobile" && "h-4 w-4")}
        />
        <span>Ordering</span>
      </div>

      {/* Dropdown + Direction toggle */}
      <div className="flex items-center gap-1.5">
        <SearchableDropdown
          open={dropdownOpen}
          onOpenChange={setDropdownOpen}
          items={items}
          getItemKey={(item) => (item.type === "no-sort" ? "no-sort" : item.column.id)}
          renderItem={(item) => {
            if (item.type === "no-sort") {
              return "No sorting"
            }
            return item.column.meta?.displayName ?? item.column.header
          }}
          onSelect={handleSelect}
          filterFn={(item, search) => {
            if (item.type === "no-sort") {
              return "no sorting".includes(search.toLowerCase())
            }
            const name = item.column.meta?.displayName ?? item.column.header
            return name.toLowerCase().includes(search.toLowerCase())
          }}
          searchPlaceholder="Search columns..."
          emptyText="No columns found"
          align="end"
          width="w-56"
        >
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-6 min-w-[100px] justify-between px-2 !text-xs font-normal",
              variant === "mobile" && "h-9 min-w-40 rounded-full !text-sm font-normal",
            )}
          >
            {buttonLabel}
            <CaretDown
              className={cn("ml-1.5 h-3 w-3 opacity-50", variant === "mobile" && "h-4 w-4")}
            />
          </Button>
        </SearchableDropdown>

        {/* Direction toggle button - only shown for single sort */}
        {sorting.length === 1 && (
          <Button
            variant="outline"
            size="sm"
            className={cn("h-6 w-6 p-0", variant === "mobile" && "h-9 w-9 rounded-full")}
            onClick={handleDirectionToggle}
          >
            {primarySort.desc ? (
              <ArrowDownIcon className={cn("h-3 w-3", variant === "mobile" && "h-4 w-4")} />
            ) : (
              <ArrowUpIcon className={cn("h-3 w-3", variant === "mobile" && "h-4 w-4")} />
            )}
          </Button>
        )}
      </div>
    </div>
  )
})

OrderingSection.displayName = "OrderingSection"
