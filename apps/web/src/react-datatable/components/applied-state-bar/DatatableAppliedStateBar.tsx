import { memo, useCallback } from "react"
import { cn } from "../../shared/utils/cn"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import { FilterChip } from "./FilterChip"
import { SortingChip } from "./SortingChip"

interface DatatableAppliedStateBarProps {
  className?: string
  showSorting?: boolean
  showFilters?: boolean
}

/**
 * Applied state bar component
 *
 * Shows active sorting and column filters as chips with natural wrapping.
 * Sorting chip always appears first if active.
 * Uses full width for chips only - action buttons moved to toolbar.
 *
 * Performance:
 * - React.memo prevents re-renders when unrelated state changes
 * - useCallback for stable onRemove handlers
 *
 * Exported component - uses Datatable prefix
 */
export const DatatableAppliedStateBar = memo(
  ({ className, showSorting = true, showFilters = true }: DatatableAppliedStateBarProps) => {
    const columnFilters = useDatatableStore((s) => s.columnFilters)
    const sorting = useDatatableStore((s) => s.sorting)
    const setColumnFilters = useDatatableStore((s) => s.setColumnFilters)

    // Memoize filter removal handler for stable references
    const handleRemoveFilter = useCallback(
      (filterId: string) => {
        setColumnFilters(columnFilters.filter((f) => f.id !== filterId))
      },
      [columnFilters, setColumnFilters],
    )

    // Hide if no filters or sorting active
    const visibleColumnFilters = showFilters ? columnFilters : []
    const shouldShowSorting = showSorting && sorting.length > 0

    if (visibleColumnFilters.length === 0 && !shouldShowSorting) {
      return null
    }

    return (
      <div
        className={cn(
          "bg-background flex flex-wrap items-center border-b",
          "gap-2 px-4 py-1.5", // Full width for chips
          className,
        )}
      >
        {/* Sorting chip - always first if active */}
        {shouldShowSorting && <SortingChip />}

        {/* Filter chips */}
        {visibleColumnFilters.map((filter) => (
          <FilterChip
            key={filter.id}
            filter={filter}
            onRemove={() => handleRemoveFilter(filter.id)}
          />
        ))}
      </div>
    )
  },
)

DatatableAppliedStateBar.displayName = "DatatableAppliedStateBar"
