import type { Table } from "@tanstack/react-table"
import { useMemo } from "react"
import { expandedStateToSet } from "../../features/grouping/group-expansion"
import { resolveGroupingValues } from "../../features/grouping/grouping-model"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import type { OnlineGroupingSummary } from "../../types/props.types"
import type { GroupingConfig, RenderableRow } from "../../types/renderable-row.types"
import { buildRenderableRows } from "./build-renderable-rows"
import { createOnlineGroupingSummaryCountGetter } from "./grouping-summary-counts"

function getColumnGroupDomain<TData>(table: Table<TData>, columnId: string) {
  const filterOptions = table.getColumn(columnId)?.columnDef.meta?.filterOptions
  const options = filterOptions && "options" in filterOptions ? filterOptions.options : undefined
  if (!options) {
    return undefined
  }

  return options.map((option) => {
    if (typeof option === "string") {
      return { key: option, label: option }
    }

    return { key: String(option.value), label: option.label }
  })
}

/**
 * Hook to convert TanStack Table into renderable row items
 *
 * This is the bridge between TanStack's data layer and our view layer.
 * Returns a flat array of items (group headers + data rows) ready to render.
 *
 * Benefits over previous approach:
 * - Clear memoization dependencies (no manual tracking needed)
 * - Proper type safety (no Row type pollution)
 * - Works seamlessly with virtualization
 * - Maintains full access to TanStack Row API via table.getRow(rowId)
 *
 * @param table - TanStack Table instance
 * @returns Flat array of renderable items
 */
export function useRenderableRows<TData>(
  table: Table<TData>,
  groupingSummary?: OnlineGroupingSummary,
): RenderableRow<TData>[] {
  // Subscribe to grouping state
  const grouping = useDatatableStore((s) => s.grouping)
  const groupingOrder = useDatatableStore((s) => s.groupingOrder)
  const groupExpanded = useDatatableStore((s) => s.groupExpanded)
  const showEmptyGroups = useDatatableStore((s) => s.showEmptyGroups)

  // Get sorted rows from TanStack (which includes filtering)
  // TanStack's row model pipeline: Core → Filtered → Sorted
  // By using getSortedRowModel(), we get both filtering AND sorting
  const sortedRows = table.getSortedRowModel().rows

  // Build renderable rows with proper memoization
  // Dependencies are explicit and tracked by React
  return useMemo(() => {
    // No grouping: return simple data rows
    if (grouping.length === 0) {
      return sortedRows.map((row) => ({
        type: "data" as const,
        rowId: row.id,
        data: row.original,
        groupPath: [],
      }))
    }

    // Convert TanStack rows to simple data objects for pure function
    const dataRows = sortedRows.map((row) => ({
      rowId: row.id,
      data: row.original,
    }))

    // Convert groupExpanded state to Set for O(1) lookup
    const expandedGroups = expandedStateToSet(groupExpanded)

    // Create Map for O(1) row lookup (avoids O(n²) from .find() in loops)
    const rowMap = new Map(sortedRows.map((row) => [row.original, row]))

    const getGroupCount = createOnlineGroupingSummaryCountGetter(groupingSummary)

    // Build grouping configuration
    const config: GroupingConfig<TData> = {
      groupByColumns: grouping,
      getGroupCount,
      getGroupValue: (columnId: string, data: TData) => {
        const column = table.getColumn(columnId)
        if (!column) {
          return null
        }

        const groupingSpec = column.columnDef.meta?.groupingSpec

        // Use custom getRowGroupingValue if provided
        const customGetter = column.columnDef.meta?.getRowGroupingValue
        if (customGetter) {
          return resolveGroupingValues(customGetter(data), groupingSpec)
        }

        // Fallback: use accessor to get value from TanStack Row
        // O(1) lookup instead of O(n) .find()
        const row = rowMap.get(data)
        if (!row) {
          return null
        }

        return resolveGroupingValues(row.getValue(columnId), groupingSpec)
      },
      getGroupDomain: (columnId: string) => getColumnGroupDomain(table, columnId),
      showEmptyGroups,
      expandedGroups,
      sortGroupValues: (columnId: string, a: string, b: string) => {
        const column = table.getColumn(columnId)
        const customSort = column?.columnDef?.meta?.sortRowGroupingValues
        return customSort ? customSort(a, b) : a.localeCompare(b)
      },
      manualOrder: groupingOrder,
      getRowId: (data: TData, index: number) => {
        // Use table's getRowId if available, otherwise use index
        const rowIdFn = table.options.getRowId
        return rowIdFn ? rowIdFn(data, index, undefined) : String(index)
      },
    }

    // Build and return renderable rows
    return buildRenderableRows(dataRows, config)
  }, [sortedRows, grouping, groupingOrder, groupExpanded, showEmptyGroups, table, groupingSummary])
}
