import type { FilterFn, Row, RowData, RowModel, Table } from "@tanstack/react-table"
import { memo } from "@tanstack/react-table"

const isDevelopment = import.meta.env?.MODE === "development"

/**
 * Resolved column filter with filter function
 */
interface ResolvedColumnFilter<TData extends RowData> {
  id: string
  filterFn: FilterFn<TData>
  resolvedValue: unknown
}

/**
 * Custom filtered row model that supports AND/OR filter modes
 *
 * This is a modified version of TanStack Table's `getFilteredRowModel` that respects
 * our custom `filterMode` state to support OR mode filtering.
 *
 * Key differences from TanStack's default:
 * 1. Accepts filterMode from table state
 * 2. In OR mode: row passes if it matches global filter OR any column filter
 * 3. In AND mode: row passes if it matches global filter AND all column filters (TanStack default)
 *
 *
 * @returns A row model factory function for use with useReactTable
 */
export function getFilteredRowModelWithMode<TData extends RowData>(): (
  table: Table<TData>,
) => () => RowModel<TData> {
  return (table: Table<TData>) =>
    memo(
      () => [
        table.getPreFilteredRowModel(),
        table.getState().columnFilters,
        table.getState().globalFilter,
        table.getState().filterMode, // ✅ Our custom state
      ],
      (rowModel, columnFilters, globalFilter, filterMode) => {
        // If no rows or no filters, return original row model
        if (!rowModel.rows.length || (!columnFilters?.length && !globalFilter)) {
          // Clear existing column filter metadata
          for (let i = 0; i < rowModel.flatRows.length; i++) {
            rowModel.flatRows[i]!.columnFilters = {}
            rowModel.flatRows[i]!.columnFiltersMeta = {}
          }
          return rowModel
        }

        // Resolve column filters (same as TanStack)
        const resolvedColumnFilters: ResolvedColumnFilter<TData>[] = []

        ;(columnFilters ?? []).forEach((d) => {
          const column = table.getColumn(d.id)
          if (!column) {
            return
          }

          const filterFn = column.getFilterFn()
          if (!filterFn) {
            if (isDevelopment) {
              console.warn(
                `Could not find a valid 'column.filterFn' for column with the ID: ${column.id}.`,
              )
            }
            return
          }

          // Skip if filter value is null/undefined
          if (d.value == null) {
            return
          }

          resolvedColumnFilters.push({
            id: d.id,
            filterFn,
            resolvedValue: filterFn.resolveFilterValue?.(d.value) ?? d.value,
          })
        })

        // Resolve global filter (same as TanStack)
        const resolvedGlobalFilters: ResolvedColumnFilter<TData>[] = []

        if (globalFilter != null) {
          // Get the global filter function from table options
          const globalFilterFnOption = table.options.globalFilterFn
          const globalFilterFn =
            typeof globalFilterFnOption === "function" ? globalFilterFnOption : undefined

          table.getAllLeafColumns().forEach((column) => {
            // Only include columns where enableGlobalFilter is not false
            if (!column.getCanGlobalFilter()) {
              return
            }

            // For global filtering, use the table's globalFilterFn, NOT the column's filterFn
            // Column filterFn is for column-specific filtering (e.g., textFilterFn expects TextFilterPayload)
            // Global filterFn expects a simple string search value
            const filterFn = globalFilterFn ?? column.getFilterFn()

            if (!filterFn) {
              if (isDevelopment) {
                console.warn(
                  `Could not find a valid 'column.filterFn' for column with the ID: ${column.id}.`,
                )
              }
              return
            }

            resolvedGlobalFilters.push({
              id: column.id,
              filterFn,
              resolvedValue: filterFn.resolveFilterValue?.(globalFilter) ?? globalFilter,
            })
          })
        }

        // KEY DIFFERENCE: Apply filters based on filterMode
        let filterRowFn: (row: Row<TData>) => boolean

        if (filterMode === "OR") {
          // OR MODE: Row passes if it matches global filter OR any column filter
          filterRowFn = (row: Row<TData>) => {
            // Check global filters (if row matches ANY global filter column)
            if (resolvedGlobalFilters.length > 0) {
              for (let i = 0; i < resolvedGlobalFilters.length; i++) {
                const filter = resolvedGlobalFilters[i]!

                if (filter.filterFn(row, filter.id, filter.resolvedValue, (val) => val)) {
                  return true // Matched global filter
                }
              }
            }

            // Check column filters (if row matches ANY column filter)
            if (resolvedColumnFilters.length > 0) {
              for (let i = 0; i < resolvedColumnFilters.length; i++) {
                const filter = resolvedColumnFilters[i]!

                // Store filter metadata (same as TanStack)
                const passesColumnFilter = filter.filterFn(
                  row,
                  filter.id,
                  filter.resolvedValue,
                  (val) => {
                    row.columnFiltersMeta[filter.id] = val
                    return val
                  },
                )

                row.columnFilters[filter.id] = passesColumnFilter

                if (passesColumnFilter) {
                  return true // Matched at least one column filter
                }
              }
            }

            return false // Didn't match any filters
          }
        } else {
          // AND MODE (default): Row passes if it matches ALL filters
          filterRowFn = (row: Row<TData>) => {
            // Check global filters (must match ANY global filter column - OR logic)
            if (resolvedGlobalFilters.length > 0) {
              let passesGlobalFilter = false
              for (let i = 0; i < resolvedGlobalFilters.length; i++) {
                const filter = resolvedGlobalFilters[i]!

                if (filter.filterFn(row, filter.id, filter.resolvedValue, (val) => val)) {
                  passesGlobalFilter = true
                  break // Found a match, no need to check other columns
                }
              }

              if (!passesGlobalFilter) {
                return false // Didn't match any searchable column
              }
            }

            // Check column filters (must pass ALL column filters)
            if (resolvedColumnFilters.length > 0) {
              for (let i = 0; i < resolvedColumnFilters.length; i++) {
                const filter = resolvedColumnFilters[i]!

                // Store filter metadata (same as TanStack)
                const passesColumnFilter = filter.filterFn(
                  row,
                  filter.id,
                  filter.resolvedValue,
                  (val) => {
                    row.columnFiltersMeta[filter.id] = val
                    return val
                  },
                )

                row.columnFilters[filter.id] = passesColumnFilter

                if (!passesColumnFilter) {
                  return false // Failed this column filter
                }
              }
            }

            return true // Passed all filters
          }
        }

        // Filter rows using our custom logic
        const filteredFlatRows: Row<TData>[] = []
        const filteredRowsById: Record<string, Row<TData>> = {}

        for (let i = 0; i < rowModel.flatRows.length; i++) {
          const row = rowModel.flatRows[i]!

          if (filterRowFn(row)) {
            filteredFlatRows.push(row)
            filteredRowsById[row.id] = row
          }
        }

        // Build filtered row model (same structure as TanStack)
        return {
          rows: filteredFlatRows.filter((row) => !row.parentId),
          flatRows: filteredFlatRows,
          rowsById: filteredRowsById,
        }
      },
      {
        key: isDevelopment && "getFilteredRowModel",
        debug: () => table.options.debugAll ?? table.options.debugTable,
      },
    )
}
