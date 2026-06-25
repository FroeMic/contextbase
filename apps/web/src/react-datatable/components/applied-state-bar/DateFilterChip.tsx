import { memo, useCallback, useState } from "react"
import { DATE_FILTER_MODE_OPTIONS, getDateFilterModeLabel } from "../../features/filters/constants"
import { formatDateFilterValue } from "../../features/filters/date-filter-utils"
import { DateFilterEditor } from "../../features/filters/editors/DateFilterEditor"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import type { DatatableColumn } from "../../types/column.types"
import type { ColumnFilter, DateFilterPayload } from "../../types/filter.types"
import { CaretDownIcon, XIcon } from "../ui/icons"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import { SearchableDropdown } from "../ui/searchable-dropdown"

export interface DateFilterChipProps<TData> {
  column: DatatableColumn<TData>
  filter: ColumnFilter
  onRemove: () => void
}

/**
 * DateFilterChip Component
 *
 * Displays an active date filter as a 4-segment chip:
 * [Column] | [Mode ▼] | [Value(s)] | [×]
 *
 * - Segment 1: Column name (not hoverable)
 * - Segment 2: Mode dropdown (is before, is after, is between, is on)
 * - Segment 3: Date value(s) (clickable - opens editor)
 * - Segment 4: Remove button
 *
 * Uses divide-x for segment separators.
 */
function DateFilterChipInner<TData>({ column, filter, onRemove }: DateFilterChipProps<TData>) {
  const setColumnFilter = useDatatableStore((s) => s.setColumnFilter)
  const [editorOpen, setEditorOpen] = useState(false)
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false)
  const payload = filter.payload as DateFilterPayload

  // Format date value(s) for display (without mode prefix)
  const dateValue = formatDateFilterValue(payload)

  const handleModeSelect = useCallback(
    (option: (typeof DATE_FILTER_MODE_OPTIONS)[number]) => {
      // When changing mode, we need to handle the payload appropriately
      const newMode = option.value

      // Preserve existing dates if compatible with new mode
      if (newMode === "range") {
        // If we have two dates, use them; otherwise use first date for both
        const date1 = payload.value ?? new Date().toISOString()
        const date2 = payload.value2 ?? payload.value ?? new Date().toISOString()
        setColumnFilter(filter.id, "date", { mode: "range", value: date1, value2: date2 })
      } else {
        // For "custom", "before", "after" - use existing first date if available
        const date = payload.value ?? new Date().toISOString()
        setColumnFilter(filter.id, "date", { mode: newMode, value: date })
      }
    },
    [filter.id, payload, setColumnFilter],
  )

  return (
    <div className="bg-background inline-flex h-6 items-center divide-x overflow-hidden rounded-full border text-xs">
      {/* Segment 1: Column name */}
      <span className="px-2 font-medium">{column.header}</span>

      {/* Segment 2: Mode dropdown */}
      <SearchableDropdown
        open={modeDropdownOpen}
        onOpenChange={setModeDropdownOpen}
        items={DATE_FILTER_MODE_OPTIONS}
        getItemKey={(option) => option.value}
        renderItem={(option) => option.label}
        onSelect={handleModeSelect}
        filterFn={(opt, search) => opt.label.toLowerCase().includes(search.toLowerCase())}
        searchPlaceholder="Search"
        emptyText="No modes found"
        align="start"
        width="w-48"
      >
        <button
          type="button"
          className="hover:bg-accent text-muted-foreground flex h-full items-center gap-1 px-2 transition-colors"
          title=""
        >
          <span>{getDateFilterModeLabel(payload.mode)}</span>
          <CaretDownIcon className="h-3 w-3" />
        </button>
      </SearchableDropdown>

      {/* Segment 3: Date value(s) (opens editor) */}
      <Popover open={editorOpen} onOpenChange={setEditorOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="hover:bg-accent h-full max-w-[200px] truncate px-2 transition-colors"
            title={dateValue}
          >
            {dateValue}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-60 overflow-hidden p-0" align="start">
          <DateFilterEditor
            column={column}
            value={payload}
            onChange={(newPayload) => {
              if (newPayload === null) {
                // Remove filter if cleared
                onRemove()
              } else {
                // Update filter with new payload
                setColumnFilter(filter.id, "date", newPayload)
              }
              setEditorOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>

      {/* Segment 4: Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className="hover:bg-accent text-muted-foreground hover:text-foreground h-full px-2 transition-colors"
        aria-label={`Remove ${column.header} filter`}
      >
        <XIcon className="h-3 w-3" />
      </button>
    </div>
  )
}

export const DateFilterChip = memo(DateFilterChipInner) as typeof DateFilterChipInner
