import { useMemo } from "react"
import { useDatatableStore } from "../../../state/store/use-datatable-store"
import type { DatatableColumn } from "../../../types/column.types"
import type { TextListFilterOptions, TextListFilterPayload } from "../../../types/filter.types"
import { normalizeTextListFilterOptions } from "../option-list-filter"
import { OptionListFilterEditor } from "./OptionListFilterEditor"

export interface TextListFilterEditorProps<TData> {
  column: DatatableColumn<TData>
  value: TextListFilterPayload | null
  onChange: (payload: TextListFilterPayload | null) => void
  variant?: "default" | "mobile"
}

export function TextListFilterEditor<TData>({
  column,
  value,
  onChange,
  variant = "default",
}: TextListFilterEditorProps<TData>) {
  const removeColumnFilter = useDatatableStore((s) => s.removeColumnFilter)

  const normalizedOptions = useMemo(
    () => normalizeTextListFilterOptions(column.id, column.filterOptions),
    [column.filterOptions, column.id],
  )
  const textListFilterOptions =
    column.filterOptions && "options" in column.filterOptions
      ? (column.filterOptions as TextListFilterOptions)
      : null

  return (
    <OptionListFilterEditor
      columnLabel={column.header}
      options={normalizedOptions}
      selectedValues={value?.values ?? []}
      onSelectedValuesChange={(selectedValues) => {
        if (selectedValues.length === 0) {
          onChange(null)
          return
        }

        onChange({
          values: selectedValues,
          mode: value?.mode ?? "include",
        })
      }}
      onClear={() => removeColumnFilter(column.id)}
      renderOption={textListFilterOptions?.renderOption}
      variant={variant}
    />
  )
}
