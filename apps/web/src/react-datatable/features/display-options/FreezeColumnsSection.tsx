"use client"

import type { Table } from "@tanstack/react-table"
import { useCallback, useMemo, useState } from "react"
import { Button } from "../../components/ui/button"
import { CaretDown, Snowflake } from "../../components/ui/icons"
import { SearchableDropdown } from "../../components/ui/searchable-dropdown"
import { MAX_STICKY_COLUMNS, NO_FROZEN_COLUMN_LABEL } from "../../core/layout/constants"
import { cn } from "../../shared/utils/cn"
import { useDatatableStore } from "../../state/store/use-datatable-store"

/**
 * Freeze Columns Section
 * Controls how many columns from the left are frozen (sticky) on horizontal scroll
 */

interface FreezeColumnsSectionProps<TData> {
  table: Table<TData>
  variant?: "default" | "mobile"
}

interface FreezeOption {
  value: number
  label: string
}

export function FreezeColumnsSection<TData>({
  table,
  variant = "default",
}: FreezeColumnsSectionProps<TData>) {
  const stickyColumnsCount = useDatatableStore((s) => s.stickyColumnsCount)
  const setStickyColumnsCount = useDatatableStore((s) => s.setStickyColumnsCount)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const totalColumns = table.getAllColumns().filter((col) => col.getCanHide()).length

  // Create freeze options: 0 to min(MAX_STICKY_COLUMNS, totalColumns)
  const freezeOptions = useMemo((): FreezeOption[] => {
    const maxOptions = Math.min(MAX_STICKY_COLUMNS, totalColumns)
    const options: FreezeOption[] = [{ value: 0, label: NO_FROZEN_COLUMN_LABEL }]

    for (let i = 1; i <= maxOptions; i++) {
      options.push({
        value: i,
        label: i === 1 ? "1 Column" : `${i} Columns`,
      })
    }

    return options
  }, [totalColumns])

  const handleSelect = useCallback(
    (option: FreezeOption) => {
      setStickyColumnsCount(option.value)
      setDropdownOpen(false)
    },
    [setStickyColumnsCount],
  )

  const selectedOption = freezeOptions.find((opt) => opt.value === stickyColumnsCount)
  const buttonLabel = selectedOption?.label ?? NO_FROZEN_COLUMN_LABEL

  return (
    <div className="flex items-center justify-between gap-2">
      {/* Label with icon */}
      <div
        className={cn(
          "text-muted-foreground flex items-center gap-1.5 text-xs",
          variant === "mobile" && "text-sm",
        )}
      >
        <Snowflake className={cn("h-3.5 w-3.5 opacity-60", variant === "mobile" && "h-4 w-4")} />
        <span>Freeze Columns</span>
      </div>

      {/* Dropdown */}
      <SearchableDropdown
        open={dropdownOpen}
        onOpenChange={setDropdownOpen}
        items={freezeOptions}
        getItemKey={(item) => String(item.value)}
        renderItem={(item) => item.label}
        onSelect={handleSelect}
        filterFn={(item, search) => item.label.toLowerCase().includes(search.toLowerCase())}
        searchPlaceholder="Search..."
        emptyText="No options found"
        align="end"
        width="w-56"
      >
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-6 min-w-[130px] justify-between px-2 !text-xs font-normal",
            variant === "mobile" && "h-9 min-w-40 rounded-full !text-sm font-normal",
          )}
          aria-label="Configure number of frozen columns"
          aria-expanded={dropdownOpen}
          aria-haspopup="listbox"
        >
          {buttonLabel}
          <CaretDown
            className={cn("ml-1.5 h-3 w-3 opacity-50", variant === "mobile" && "h-4 w-4")}
          />
        </Button>
      </SearchableDropdown>
    </div>
  )
}
