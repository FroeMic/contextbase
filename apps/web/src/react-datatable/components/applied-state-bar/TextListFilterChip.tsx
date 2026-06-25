import { memo, useCallback } from "react"
import {
  getTextListFilterModeLabel,
  TEXT_LIST_FILTER_MODE_OPTIONS,
} from "../../features/filters/constants"
import { TextListFilterEditor } from "../../features/filters/editors/TextListFilterEditor"
import {
  normalizeTextListFilterOptions,
  summarizeOptionFilterValues,
} from "../../features/filters/option-list-filter"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import type { DatatableColumn } from "../../types/column.types"
import type { ColumnFilter, TextListFilterPayload } from "../../types/filter.types"
import { OptionListFilterChip } from "./OptionListFilterChip"

export interface TextListFilterChipProps<TData> {
  column: DatatableColumn<TData>
  filter: ColumnFilter
  onRemove: () => void
}

/**
 * TextListFilterChip Component
 *
 * Displays an active text-list filter as a 4-segment chip matching TextFilterChip design:
 * [Column] | [Mode ▼] | [Values ▼] | [×]
 *
 * - Segment 1: Column name (not hoverable)
 * - Segment 2: Mode dropdown with search ("is any of" / "is none of")
 * - Segment 3: Values dropdown (opens full editor)
 * - Segment 4: Remove button
 *
 * Each segment is independently hoverable.
 * Uses divide-x for segment separators.
 */
function TextListFilterChipInner<TData>({
  column,
  filter,
  onRemove,
}: TextListFilterChipProps<TData>) {
  const payload = filter.payload as TextListFilterPayload

  const setColumnFilter = useDatatableStore((s) => s.setColumnFilter)

  // Handle mode selection
  const handleModeSelect = useCallback(
    (mode: TextListFilterPayload["mode"]) => {
      setColumnFilter(filter.id, "text-list", { ...payload, mode })
    },
    [filter.id, payload, setColumnFilter],
  )

  // Handle values editor changes
  const handleValuesChange = useCallback(
    (newPayload: TextListFilterPayload | null) => {
      if (newPayload === null) {
        setColumnFilter(filter.id, "text-list", null)
      } else {
        setColumnFilter(filter.id, "text-list", newPayload)
      }
    },
    [filter.id, setColumnFilter],
  )

  const getValueSummary = () => {
    const options = normalizeTextListFilterOptions(column.id, column.filterOptions)
    return summarizeOptionFilterValues(options, payload.values)
  }

  return (
    <OptionListFilterChip
      columnLabel={column.header}
      mode={payload.mode}
      modeOptions={TEXT_LIST_FILTER_MODE_OPTIONS}
      getModeLabel={getTextListFilterModeLabel}
      onModeChange={handleModeSelect}
      valueSummary={getValueSummary()}
      editor={
        <TextListFilterEditor column={column} value={payload} onChange={handleValuesChange} />
      }
      onRemove={onRemove}
    />
  )
}

export const TextListFilterChip = memo(TextListFilterChipInner) as typeof TextListFilterChipInner
