import { memo } from "react"
import { CheckIcon } from "../../components/ui/icons"
import type { useDatatableColumns } from "../../core/DatatableProvider"
import { cn } from "../../shared/utils/cn"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import { FilterTypeIcon } from "./FilterTypeIcon"

interface FilterItemProps {
  column: ReturnType<typeof useDatatableColumns>[number]
  onSelect: () => void
  isSelected?: boolean
  disabled?: boolean
  asChild?: boolean
  variant?: "default" | "mobile"
}

/**
 * Individual filter option item in the filter dropdown
 *
 * Optimized with:
 * - React.memo to prevent re-renders when props don't change
 * - Selective subscription - only re-renders when this specific column's filter status changes
 *
 * Shows:
 * - Filter type icon
 * - Column display name (from meta.filterName or header)
 * - Check mark when filter is active
 *
 * When asChild=true, renders content without button wrapper (for use in DropdownMenuSubTrigger)
 */
export const FilterItem = memo(
  ({
    column,
    onSelect,
    isSelected = false,
    disabled = false,
    asChild = false,
    variant = "default",
  }: FilterItemProps) => {
    // Only subscribe to whether THIS specific filter is active
    // This prevents re-renders when other filters change
    const isActive = useDatatableStore((s) => s.columnFilters.some((f) => f.id === column.id))

    const displayName = column.meta?.filterName ?? column.header

    const content = (
      <div className="flex items-center gap-2">
        {column.meta?.filterIcon ? (
          <column.meta.filterIcon
            className={cn(
              "text-muted-foreground",
              variant === "mobile" ? "h-4 w-4" : "h-3.5 w-3.5",
            )}
          />
        ) : (
          <FilterTypeIcon
            type={column.filterType!}
            className={cn(
              "text-muted-foreground",
              variant === "mobile" ? "h-4 w-4" : "h-3.5 w-3.5",
            )}
          />
        )}
        <span className="flex-1">{displayName}</span>
        {disabled && <span className="text-muted-foreground text-[10px]">(soon)</span>}
        {!disabled && isActive && (
          <CheckIcon
            className={cn("text-primary", variant === "mobile" ? "h-4 w-4" : "h-3.5 w-3.5")}
          />
        )}
      </div>
    )

    if (asChild) {
      return content
    }

    return (
      <button
        className={cn(
          "inline-button mx-0 w-full rounded px-2 py-1.5 text-left text-xs transition-colors",
          variant === "mobile" && "h-11 rounded-md px-3 py-2 text-sm",
          disabled
            ? "cursor-not-allowed opacity-50"
            : "hover:bg-accent hover:text-accent-foreground",
          !disabled && isSelected && "bg-accent/50 text-accent-foreground",
          !disabled && isActive && !isSelected && "bg-accent/30",
        )}
        onClick={disabled ? undefined : onSelect}
        disabled={disabled}
        title={
          disabled
            ? `${column.filterType} filter is not available in the built-in picker`
            : undefined
        }
      >
        {content}
      </button>
    )
  },
)

FilterItem.displayName = "FilterItem"
