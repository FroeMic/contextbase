import { memo, useCallback } from "react"
import { BooleanFilterEditor } from "../../features/filters/editors/BooleanFilterEditor"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import type { DatatableColumn } from "../../types/column.types"
import type { BooleanFilterPayload, ColumnFilter } from "../../types/filter.types"
import { OptionListFilterChip } from "./OptionListFilterChip"

export interface BooleanFilterChipProps<TData> {
  column: DatatableColumn<TData>
  filter: ColumnFilter
  onRemove: () => void
}

function BooleanFilterChipInner<TData>({
  column,
  filter,
  onRemove,
}: BooleanFilterChipProps<TData>) {
  const payload = filter.payload as BooleanFilterPayload
  const setColumnFilter = useDatatableStore((s) => s.setColumnFilter)

  const handleValueChange = useCallback(
    (newPayload: BooleanFilterPayload | null) => {
      setColumnFilter(filter.id, "boolean", newPayload)
    },
    [filter.id, setColumnFilter],
  )

  const valueSummary = payload.value === true ? "true" : payload.value === false ? "false" : "any"

  return (
    <OptionListFilterChip
      columnLabel={column.header}
      valueSummary={valueSummary}
      editor={<BooleanFilterEditor column={column} value={payload} onChange={handleValueChange} />}
      onRemove={onRemove}
    />
  )
}

export const BooleanFilterChip = memo(BooleanFilterChipInner) as typeof BooleanFilterChipInner
