import { memo } from "react"
import type { useDatatableColumns } from "../../core/DatatableProvider"
import { cn } from "../../shared/utils/cn"
import type { ColumnFilter } from "../../types/filter.types"
import { XIcon } from "../ui/icons"

interface GenericFilterChipProps {
  column: ReturnType<typeof useDatatableColumns>[number]
  filter: ColumnFilter
  onRemove: () => void
}

/**
 * Generic filter chip for unimplemented filter types
 *
 * Displays a simple chip showing:
 * - Column name
 * - Raw payload (JSON stringified)
 * - Remove button
 *
 * Used as fallback for filter types that don't have specialized chips yet:
 * - number
 * - date
 * - boolean
 * - text-list
 * - id-list
 * - custom
 */
export const GenericFilterChip = memo(({ column, filter, onRemove }: GenericFilterChipProps) => {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5",
        "bg-background h-8 rounded-full border px-2",
        "text-foreground text-sm",
      )}
    >
      <span className="font-medium whitespace-nowrap">{column.header}</span>
      <span className="text-muted-foreground whitespace-nowrap">is</span>
      <span className="max-w-[200px] truncate">{JSON.stringify(filter.payload)}</span>
      <button
        type="button"
        onClick={onRemove}
        className={cn(
          "ml-1 shrink-0",
          "text-muted-foreground hover:text-foreground",
          "transition-colors",
        )}
        aria-label={`Remove ${column.header} filter`}
      >
        <XIcon className="h-3 w-3" />
      </button>
    </div>
  )
})

GenericFilterChip.displayName = "GenericFilterChip"
