import { memo, useCallback, useState } from "react"
import type { useDatatableColumns } from "../../core/DatatableProvider"
import {
  getNumberFilterModeLabel,
  NUMBER_FILTER_MODE_OPTIONS,
} from "../../features/filters/constants"
import { FilterEditorModal } from "../../features/filters/FilterEditorModal"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import type { ColumnFilter, NumberFilterPayload } from "../../types/filter.types"
import { CaretDownIcon, XIcon } from "../ui/icons"
import { SearchableDropdown } from "../ui/searchable-dropdown"

interface NumberFilterChipProps {
  column: ReturnType<typeof useDatatableColumns>[number]
  filter: ColumnFilter
  onRemove: () => void
}

/**
 * Specialized filter chip for number filters
 *
 * Handles both single-condition and multi-condition number filters.
 *
 * Single-condition layout:
 * [Column Name] | [Mode Dropdown ▼] | [Value Button] | [X]
 *
 * Multi-condition layout:
 * [Column Name] | [Operator Dropdown ▼] | [N conditions] | [X]
 *
 * Features:
 * - Click mode dropdown to switch filter mode (=, >, ≥, <, ≤)
 * - Click value/conditions to open full editor modal
 * - Click X to remove filter
 * - Keyboard navigation in mode dropdown
 */
export const NumberFilterChip = memo(({ column, filter, onRemove }: NumberFilterChipProps) => {
  const numberPayload = filter.payload as NumberFilterPayload

  // Route to appropriate subcomponent based on condition count
  if (numberPayload.conditions.length > 1) {
    return <MultiConditionNumberFilterChip column={column} filter={filter} onRemove={onRemove} />
  }

  return <SingleConditionNumberFilterChip column={column} filter={filter} onRemove={onRemove} />
})

NumberFilterChip.displayName = "NumberFilterChip"

/**
 * Multi-condition number filter chip
 * Shows: [Column] | [matches any/all of ▼] | [N conditions] | [X]
 */
const MultiConditionNumberFilterChip = memo(
  ({ column, filter, onRemove }: NumberFilterChipProps) => {
    const setColumnFilter = useDatatableStore((s) => s.setColumnFilter)
    const [editorOpen, setEditorOpen] = useState(false)
    const [operatorDropdownOpen, setOperatorDropdownOpen] = useState(false)

    const numberPayload = filter.payload as NumberFilterPayload

    const operatorOptions = [
      { value: "OR" as const, label: "matches any of" },
      { value: "AND" as const, label: "matches all of" },
    ]

    const handleOperatorSelect = useCallback(
      (option: (typeof operatorOptions)[number]) => {
        setColumnFilter(filter.id, "number", {
          conditions: numberPayload.conditions,
          operator: option.value,
        })
      },
      [filter.id, numberPayload.conditions, setColumnFilter],
    )

    const currentOperatorLabel =
      numberPayload.operator === "AND" ? "matches all of" : "matches any of"

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
            title={`${numberPayload.conditions.length} conditions`}
          >
            {numberPayload.conditions.length} conditions
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
  },
)

MultiConditionNumberFilterChip.displayName = "MultiConditionNumberFilterChip"

/**
 * Single-condition number filter chip
 * Shows: [Column] | [mode ▼] | [value] | [X]
 */
const SingleConditionNumberFilterChip = memo(
  ({ column, filter, onRemove }: NumberFilterChipProps) => {
    const setColumnFilter = useDatatableStore((s) => s.setColumnFilter)
    const [editorOpen, setEditorOpen] = useState(false)
    const [modeDropdownOpen, setModeDropdownOpen] = useState(false)

    const numberPayload = filter.payload as NumberFilterPayload
    const condition = numberPayload.conditions[0]

    const handleModeSelect = useCallback(
      (option: (typeof NUMBER_FILTER_MODE_OPTIONS)[number]) => {
        // Update the single condition's mode
        setColumnFilter(filter.id, "number", {
          conditions: [{ ...condition, mode: option.value }],
          operator: numberPayload.operator,
        })
      },
      [filter.id, condition, numberPayload.operator, setColumnFilter],
    )

    // Format value display
    const valueDisplay = String(condition.value)

    return (
      <>
        <div className="bg-background inline-flex h-6 items-center divide-x overflow-hidden rounded-full border text-xs">
          {/* Column name segment */}
          <span className="px-2 font-medium">{column.header}</span>

          {/* Mode dropdown segment */}
          <SearchableDropdown
            open={modeDropdownOpen}
            onOpenChange={setModeDropdownOpen}
            items={NUMBER_FILTER_MODE_OPTIONS}
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
              <span>{getNumberFilterModeLabel(condition.mode)}</span>
              <CaretDownIcon className="h-3 w-3" />
            </button>
          </SearchableDropdown>

          {/* Value button segment */}
          <button
            className="hover:bg-accent h-full px-2 transition-colors"
            onClick={() => setEditorOpen(true)}
          >
            {valueDisplay}
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
  },
)

SingleConditionNumberFilterChip.displayName = "SingleConditionNumberFilterChip"
