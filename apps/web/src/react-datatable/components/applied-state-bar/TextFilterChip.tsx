import { memo, useCallback, useState } from "react"
import type { useDatatableColumns } from "../../core/DatatableProvider"
import { getTextFilterModeLabel, TEXT_FILTER_MODE_OPTIONS } from "../../features/filters/constants"
import { FilterEditorModal } from "../../features/filters/FilterEditorModal"
import { formatTruncate } from "../../shared/utils/format-utils"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import type { ColumnFilter, TextFilterPayload } from "../../types/filter.types"
import { CaretDownIcon, XIcon } from "../ui/icons"
import { SearchableDropdown } from "../ui/searchable-dropdown"

interface TextFilterChipProps {
  column: ReturnType<typeof useDatatableColumns>[number]
  filter: ColumnFilter
  onRemove: () => void
}

/**
 * Specialized filter chip for text filters
 *
 * Handles both single-condition and multi-condition text filters.
 *
 * Single-condition layout:
 * [Column Name] | [Mode Dropdown ▼] | [Value Button] | [X]
 *
 * Multi-condition layout:
 * [Column Name] | [Operator Dropdown ▼] | [N conditions] | [X]
 *
 * Features:
 * - Click mode dropdown to switch filter mode (contains, equals, etc.)
 * - Click value/conditions to open full editor modal
 * - Click X to remove filter
 * - Keyboard navigation in mode dropdown
 */
export const TextFilterChip = memo(({ column, filter, onRemove }: TextFilterChipProps) => {
  const textPayload = filter.payload as TextFilterPayload

  // Route to appropriate subcomponent based on condition count
  if (textPayload.conditions.length > 1) {
    return <MultiConditionTextFilterChip column={column} filter={filter} onRemove={onRemove} />
  }

  return <SingleConditionTextFilterChip column={column} filter={filter} onRemove={onRemove} />
})

TextFilterChip.displayName = "TextFilterChip"

/**
 * Multi-condition text filter chip
 * Shows: [Column] | [matches any/all of ▼] | [N conditions] | [X]
 */
const MultiConditionTextFilterChip = memo(({ column, filter, onRemove }: TextFilterChipProps) => {
  const setColumnFilter = useDatatableStore((s) => s.setColumnFilter)
  const [editorOpen, setEditorOpen] = useState(false)
  const [operatorDropdownOpen, setOperatorDropdownOpen] = useState(false)

  const textPayload = filter.payload as TextFilterPayload

  const operatorOptions = [
    { value: "OR" as const, label: "matches any of" },
    { value: "AND" as const, label: "matches all of" },
  ]

  const handleOperatorSelect = useCallback(
    (option: (typeof operatorOptions)[number]) => {
      setColumnFilter(filter.id, "text", {
        conditions: textPayload.conditions,
        operator: option.value,
      })
    },
    [filter.id, textPayload.conditions, setColumnFilter],
  )

  const currentOperatorLabel = textPayload.operator === "AND" ? "matches all of" : "matches any of"

  return (
    <>
      <div className="bg-background inline-flex h-6 items-center divide-x overflow-hidden rounded-full border text-xs">
        {/* Column name segment */}
        <span className="px-2 font-medium">{column.header}</span>

        {/* Operator dropdown segment */}
        <SearchableDropdown
          open={operatorDropdownOpen}
          onOpenChange={setOperatorDropdownOpen}
          items={operatorOptions}
          getItemKey={(option) => option.value}
          renderItem={(option) => option.label}
          onSelect={handleOperatorSelect}
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
            <span>{currentOperatorLabel}</span>
            <CaretDownIcon className="h-3 w-3" />
          </button>
        </SearchableDropdown>

        {/* Condition count segment */}
        <button
          className="hover:bg-accent h-full px-2 transition-colors"
          onClick={() => setEditorOpen(true)}
          title={`${textPayload.conditions.length} conditions`}
        >
          {textPayload.conditions.length} conditions
        </button>

        {/* Remove button segment */}
        <button
          type="button"
          onClick={onRemove}
          className="hover:bg-accent text-muted-foreground hover:text-foreground h-full px-2 transition-colors"
          aria-label={`Remove ${column.header} filter`}
        >
          <XIcon className="h-3 w-3" />
        </button>
      </div>

      {/* Filter editor modal */}
      <FilterEditorModal
        columnId={filter.id}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
      />
    </>
  )
})

MultiConditionTextFilterChip.displayName = "MultiConditionTextFilterChip"

/**
 * Single-condition text filter chip
 * Shows: [Column] | [mode ▼] | [value] | [X]
 */
const SingleConditionTextFilterChip = memo(({ column, filter, onRemove }: TextFilterChipProps) => {
  const setColumnFilter = useDatatableStore((s) => s.setColumnFilter)
  const [editorOpen, setEditorOpen] = useState(false)
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false)

  const textPayload = filter.payload as TextFilterPayload
  const condition = textPayload.conditions[0]

  const handleModeSelect = useCallback(
    (option: (typeof TEXT_FILTER_MODE_OPTIONS)[number]) => {
      // Update the single condition's mode
      setColumnFilter(filter.id, "text", {
        conditions: [{ ...condition, mode: option.value }],
        operator: textPayload.operator,
      })
    },
    [filter.id, condition, textPayload.operator, setColumnFilter],
  )

  return (
    <>
      <div className="bg-background inline-flex h-6 items-center divide-x overflow-hidden rounded-full border text-xs">
        {/* Column name segment */}
        <span className="px-2 font-medium">{column.header}</span>

        {/* Mode dropdown segment */}
        <SearchableDropdown
          open={modeDropdownOpen}
          onOpenChange={setModeDropdownOpen}
          items={TEXT_FILTER_MODE_OPTIONS}
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
            <span>{getTextFilterModeLabel(condition.mode)}</span>
            <CaretDownIcon className="h-3 w-3" />
          </button>
        </SearchableDropdown>

        {/* Value button segment */}
        <button
          className="hover:bg-accent h-full px-2 transition-colors"
          onClick={() => setEditorOpen(true)}
        >
          {formatTruncate(condition.value)}
        </button>

        {/* Remove button segment */}
        <button
          type="button"
          onClick={onRemove}
          className="hover:bg-accent text-muted-foreground hover:text-foreground h-full px-2 transition-colors"
          aria-label={`Remove ${column.header} filter`}
        >
          <XIcon className="h-3 w-3" />
        </button>
      </div>

      {/* Filter editor modal */}
      <FilterEditorModal
        columnId={filter.id}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
      />
    </>
  )
})

SingleConditionTextFilterChip.displayName = "SingleConditionTextFilterChip"
