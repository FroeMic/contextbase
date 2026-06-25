import type { ColumnFilter, FilterType } from "../react-datatable/types/filter.types.ts"

export type ServerExpression =
  | {
      kind: "column"
      columnId: string
    }
  | {
      kind: "derived"
      key: string
    }

export interface ServerFilterDefinition {
  type: FilterType
  expression: ServerExpression
  resolveValue?: (value: unknown) => unknown
  resolveFilter?: (filter: ColumnFilter) => ColumnFilter
}

export interface ServerSearchDefinition {
  expression: ServerExpression
}

export interface ServerSortDefinition {
  expression: ServerExpression
}

export interface ServerGroupDefinition {
  keyExpression: ServerExpression
  orderExpressions?: ServerExpression[]
}

export interface ServerColumnDefinition {
  id: string
  filter?: ServerFilterDefinition
  search?: ServerSearchDefinition
  sort?: ServerSortDefinition
  group?: ServerGroupDefinition
}

export type ServerColumnDefinitionMap = Record<string, ServerColumnDefinition>

export function defineServerColumns<TColumns extends ServerColumnDefinitionMap>(
  columns: TColumns,
): TColumns {
  return columns
}

export function getSearchableColumnIds(columns: ServerColumnDefinitionMap): string[] {
  return Object.values(columns)
    .filter((column) => Boolean(column.search))
    .map((column) => column.id)
}

export function getGroupableColumnIds(columns: ServerColumnDefinitionMap): string[] {
  return Object.values(columns)
    .filter((column) => Boolean(column.group))
    .map((column) => column.id)
}

export function getSortableColumnIds(columns: ServerColumnDefinitionMap): string[] {
  return Object.values(columns)
    .filter((column) => Boolean(column.sort))
    .map((column) => column.id)
}
