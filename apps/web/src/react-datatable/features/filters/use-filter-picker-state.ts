import { useMemo, useState } from "react"

import { useDatatableColumns } from "../../core/DatatableProvider"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import { isFilterTypeImplemented } from "./constants"

export function useFilterPickerState() {
  const columns = useDatatableColumns()
  const [search, setSearch] = useState("")
  const columnFilters = useDatatableStore((s) => s.columnFilters)
  const setColumnFilter = useDatatableStore((s) => s.setColumnFilter)

  const filterableColumns = useMemo(
    () =>
      columns.filter((col) => {
        if (col.enableFiltering === false) return false
        return isFilterTypeImplemented(col.filterType)
      }),
    [columns],
  )

  const filteredColumns = useMemo(
    () =>
      filterableColumns.filter((col) => {
        const name = col.meta?.filterName ?? col.header
        return name.toLowerCase().includes(search.toLowerCase())
      }),
    [filterableColumns, search],
  )

  return {
    columnFilters,
    filterableColumns,
    filteredColumns,
    search,
    setColumnFilter,
    setSearch,
  }
}
