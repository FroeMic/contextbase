import { useMemo } from "react"
import type { DatatableColumn } from "../../../types/column.types"
import type { IdListFilterPayload } from "../../../types/filter.types"
import { normalizeIdListFilterOptions } from "../option-list-filter"
import { OptionListFilterEditor } from "./OptionListFilterEditor"

export interface IdListFilterEditorProps<TData> {
  column: DatatableColumn<TData>
  value: IdListFilterPayload | null
  onChange: (payload: IdListFilterPayload | null) => void
  variant?: "default" | "mobile"
}

export function IdListFilterEditor<TData>({
  column,
  value,
  onChange,
  variant = "default",
}: IdListFilterEditorProps<TData>) {
  const config = useMemo(
    () => normalizeIdListFilterOptions(column.id, column.filterOptions),
    [column.filterOptions, column.id],
  )

  return (
    <OptionListFilterEditor
      columnLabel={column.header}
      options={config.options}
      selectedValues={value?.ids ?? []}
      onSelectedValuesChange={(selectedValues) => {
        if (selectedValues.length === 0) {
          onChange(null)
          return
        }

        onChange({
          ids: selectedValues,
          mode: value?.mode ?? "include",
        })
      }}
      searchPlaceholder={config.searchPlaceholder}
      emptyText={config.emptyText}
      loading={config.isLoading}
      renderOption={config.renderOption}
      variant={variant}
    />
  )
}
