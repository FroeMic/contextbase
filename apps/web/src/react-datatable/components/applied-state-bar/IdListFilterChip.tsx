import { memo, useCallback } from "react"
import {
  getTextListFilterModeLabel,
  TEXT_LIST_FILTER_MODE_OPTIONS,
} from "../../features/filters/constants"
import { IdListFilterEditor } from "../../features/filters/editors/IdListFilterEditor"
import {
  normalizeIdListFilterOptions,
  summarizeOptionFilterValues,
} from "../../features/filters/option-list-filter"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import type { DatatableColumn } from "../../types/column.types"
import type { ColumnFilter, IdListFilterPayload } from "../../types/filter.types"
import { OptionListFilterChip } from "./OptionListFilterChip"

export interface IdListFilterChipProps<TData> {
  column: DatatableColumn<TData>
  filter: ColumnFilter
  onRemove: () => void
}

function IdListFilterChipInner<TData>({ column, filter, onRemove }: IdListFilterChipProps<TData>) {
  const payload = filter.payload as IdListFilterPayload
  const setColumnFilter = useDatatableStore((s) => s.setColumnFilter)

  const handleModeSelect = useCallback(
    (mode: IdListFilterPayload["mode"]) => {
      setColumnFilter(filter.id, "id-list", { ...payload, mode })
    },
    [filter.id, payload, setColumnFilter],
  )

  const handleValuesChange = useCallback(
    (newPayload: IdListFilterPayload | null) => {
      setColumnFilter(filter.id, "id-list", newPayload)
    },
    [filter.id, setColumnFilter],
  )

  const valueSummary = summarizeOptionFilterValues(
    normalizeIdListFilterOptions(column.id, column.filterOptions).options,
    payload.ids,
  )

  return (
    <OptionListFilterChip
      columnLabel={column.header}
      mode={payload.mode}
      modeOptions={TEXT_LIST_FILTER_MODE_OPTIONS}
      getModeLabel={getTextListFilterModeLabel}
      onModeChange={handleModeSelect}
      valueSummary={valueSummary}
      editor={<IdListFilterEditor column={column} value={payload} onChange={handleValuesChange} />}
      onRemove={onRemove}
    />
  )
}

export const IdListFilterChip = memo(IdListFilterChipInner) as typeof IdListFilterChipInner
