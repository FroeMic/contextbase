import { useMemo } from "react"
import type { DatatableColumn } from "../../../types/column.types"
import type { BooleanFilterOptions, BooleanFilterPayload } from "../../../types/filter.types"
import { normalizeBooleanFilterOptions } from "../option-list-filter"
import { OptionListFilterEditor } from "./OptionListFilterEditor"

export interface BooleanFilterEditorProps<TData> {
  column: DatatableColumn<TData>
  value: BooleanFilterPayload | null
  onChange: (payload: BooleanFilterPayload | null) => void
  variant?: "default" | "mobile"
}

export function BooleanFilterEditor<TData>({
  column,
  value,
  onChange,
  variant = "default",
}: BooleanFilterEditorProps<TData>) {
  const options = useMemo(
    () => normalizeBooleanFilterOptions(column.filterOptions),
    [column.filterOptions],
  )
  const booleanFilterOptions =
    column.filterOptions && typeof column.filterOptions === "object"
      ? (column.filterOptions as BooleanFilterOptions)
      : null

  return (
    <OptionListFilterEditor
      columnLabel={column.header}
      options={options}
      selectedValues={value?.value == null ? [] : [value.value]}
      selectionMode="single"
      onSelectedValuesChange={(selectedValues) => {
        onChange(selectedValues.length === 0 ? null : { value: selectedValues[0] })
      }}
      searchPlaceholder="Search values..."
      emptyText="No values available"
      renderOption={booleanFilterOptions?.renderOption}
      variant={variant}
    />
  )
}
