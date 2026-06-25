import type {
  ColumnFilter,
  IdListFilterPayload,
  TextListFilterPayload,
} from "../react-datatable/types/filter.types.ts"
import type { BackendGroupExpansionState, BackendQueryState } from "./backend-table-state.ts"
import type { OnlineNavigationMode } from "./online.types.ts"
import type { ServerColumnDefinitionMap, ServerExpression } from "./server-definitions.ts"

export class QueryPlannerValidationError extends Error {}

export interface QueryPlanSort {
  columnId: string
  expression: ServerExpression
  desc: boolean
  isTieBreaker?: boolean
}

export interface QueryPlanFilter {
  columnId: string
  filter: ColumnFilter
  expression: ServerExpression
}

export interface QueryPlanSearch {
  term: string
  columns: Array<{
    columnId: string
    expression: ServerExpression
  }>
}

export interface FlatWindowQueryPlan {
  kind: "flat_window"
  navigationMode: OnlineNavigationMode
  limit: number
  offset: number
  filters: QueryPlanFilter[]
  filterMode: "AND" | "OR"
  sorting: QueryPlanSort[]
  globalSearch: QueryPlanSearch | null
}

export interface GroupedQueryPlanGroup {
  columnId: string
  keyExpression: ServerExpression
  orderExpressions: ServerExpression[]
}

export interface GroupedWindowQueryPlan {
  kind: "grouped_window"
  navigationMode: OnlineNavigationMode
  limit: number
  offset: number
  filters: QueryPlanFilter[]
  filterMode: "AND" | "OR"
  sorting: QueryPlanSort[]
  globalSearch: QueryPlanSearch | null
  grouping: {
    columns: GroupedQueryPlanGroup[]
    showEmptyGroups: boolean
    expansion: BackendGroupExpansionState
  }
}

export type BackendQueryPlan = FlatWindowQueryPlan | GroupedWindowQueryPlan

export interface BuildBackendQueryPlanOptions {
  navigationMode: OnlineNavigationMode
  limit: number
  offset: number
  query: BackendQueryState
  columns: ServerColumnDefinitionMap
  tieBreakers?: Array<{
    columnId: string
    expression: ServerExpression
  }>
}

function expressionKey(expression: ServerExpression): string {
  return expression.kind === "column"
    ? `column:${expression.columnId}`
    : `derived:${expression.key}`
}

function assertValidWindow(limit: number, offset: number) {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new QueryPlannerValidationError("Query limit must be a positive integer.")
  }

  if (!Number.isInteger(offset) || offset < 0) {
    throw new QueryPlannerValidationError("Query offset must be a non-negative integer.")
  }
}

function compileFilters(
  filters: ColumnFilter[],
  columns: ServerColumnDefinitionMap,
): QueryPlanFilter[] {
  return filters.map((filter) => {
    const definition = columns[filter.id]
    if (!definition?.filter) {
      throw new QueryPlannerValidationError(`Filtering by "${filter.id}" is not supported.`)
    }

    if (definition.filter.type !== filter.type) {
      throw new QueryPlannerValidationError(
        `Filter type mismatch for "${filter.id}": expected ${definition.filter.type}, received ${filter.type}.`,
      )
    }

    return {
      columnId: filter.id,
      filter:
        definition.filter.resolveFilter?.(filter) ??
        resolveFilterValues(filter, definition.filter.resolveValue),
      expression: definition.filter.expression,
    }
  })
}

function resolveFilterValues(
  filter: ColumnFilter,
  resolveValue: ((value: unknown) => unknown) | undefined,
): ColumnFilter {
  if (!resolveValue) {
    return filter
  }

  if (filter.type === "text-list") {
    const payload = filter.payload as TextListFilterPayload
    return {
      ...filter,
      payload: {
        ...payload,
        values: payload.values.map((value) => String(resolveValue(value))),
      },
    }
  }

  if (filter.type === "id-list") {
    const payload = filter.payload as IdListFilterPayload
    return {
      ...filter,
      payload: {
        ...payload,
        ids: payload.ids.map((value) => String(resolveValue(value))),
      },
    }
  }

  return filter
}

function compileGlobalSearch(
  term: string,
  columns: ServerColumnDefinitionMap,
): QueryPlanSearch | null {
  const normalized = term.trim()
  if (!normalized) {
    return null
  }

  const searchableColumns = Object.values(columns)
    .filter((column) => column.search)
    .map((column) => ({
      columnId: column.id,
      expression: column.search!.expression,
    }))

  if (searchableColumns.length === 0) {
    throw new QueryPlannerValidationError("Global search is not supported for this table.")
  }

  return {
    term: normalized,
    columns: searchableColumns,
  }
}

function compileSorting(
  sorting: BackendQueryState["sorting"],
  columns: ServerColumnDefinitionMap,
  tieBreakers: BuildBackendQueryPlanOptions["tieBreakers"],
): QueryPlanSort[] {
  const plannedSorting: QueryPlanSort[] = []
  const seenExpressions = new Set<string>()

  for (const sort of sorting) {
    const definition = columns[sort.id]
    if (!definition?.sort) {
      throw new QueryPlannerValidationError(`Sorting by "${sort.id}" is not supported.`)
    }

    plannedSorting.push({
      columnId: sort.id,
      expression: definition.sort.expression,
      desc: sort.desc,
    })
    seenExpressions.add(expressionKey(definition.sort.expression))
  }

  for (const tieBreaker of tieBreakers ?? []) {
    const key = expressionKey(tieBreaker.expression)
    if (seenExpressions.has(key)) {
      continue
    }

    plannedSorting.push({
      columnId: tieBreaker.columnId,
      expression: tieBreaker.expression,
      desc: false,
      isTieBreaker: true,
    })
    seenExpressions.add(key)
  }

  return plannedSorting
}

function compileGrouping(
  grouping: NonNullable<BackendQueryState["grouping"]>,
  columns: ServerColumnDefinitionMap,
): GroupedWindowQueryPlan["grouping"] {
  const seen = new Set<string>()
  const groupedColumns = grouping.columns.map((columnId) => {
    if (seen.has(columnId)) {
      throw new QueryPlannerValidationError(
        `Grouping column "${columnId}" was provided more than once.`,
      )
    }
    seen.add(columnId)

    const definition = columns[columnId]
    if (!definition?.group) {
      throw new QueryPlannerValidationError(`Grouping by "${columnId}" is not supported.`)
    }

    return {
      columnId,
      keyExpression: definition.group.keyExpression,
      orderExpressions: definition.group.orderExpressions ?? [definition.group.keyExpression],
    }
  })

  return {
    columns: groupedColumns,
    showEmptyGroups: grouping.showEmptyGroups,
    expansion: grouping.expansion,
  }
}

export function buildBackendQueryPlan(options: BuildBackendQueryPlanOptions): BackendQueryPlan {
  assertValidWindow(options.limit, options.offset)

  const filters = compileFilters(options.query.filters, options.columns)
  const globalSearch = compileGlobalSearch(options.query.globalFilter, options.columns)
  const sorting = compileSorting(options.query.sorting, options.columns, options.tieBreakers)

  if (options.query.grouping) {
    return {
      kind: "grouped_window",
      navigationMode: options.navigationMode,
      limit: options.limit,
      offset: options.offset,
      filters,
      filterMode: options.query.filterMode,
      sorting,
      globalSearch,
      grouping: compileGrouping(options.query.grouping, options.columns),
    }
  }

  return {
    kind: "flat_window",
    navigationMode: options.navigationMode,
    limit: options.limit,
    offset: options.offset,
    filters,
    filterMode: options.query.filterMode,
    sorting,
    globalSearch,
  }
}
