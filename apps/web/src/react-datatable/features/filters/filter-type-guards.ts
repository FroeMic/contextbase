/**
 * Filter Type Guards
 *
 * Type guard functions to safely narrow FilterPayload union types.
 * Used throughout the filtering system to determine payload types at runtime.
 */

import type {
  BooleanFilterPayload,
  ColumnFilter,
  CustomFilterPayload,
  DateFilterPayload,
  FilterPayload,
  IdListFilterPayload,
  NumberFilterPayload,
  TextFilterPayload,
  TextListFilterPayload,
} from "../../types/filter.types"

// ============================================
// Payload Type Guards
// ============================================

export function isTextFilterPayload(payload: FilterPayload): payload is TextFilterPayload {
  return (
    "conditions" in payload &&
    Array.isArray(payload.conditions) &&
    payload.conditions.every(
      (cond: unknown) =>
        cond &&
        typeof cond === "object" &&
        "mode" in cond &&
        "value" in cond &&
        typeof cond.value === "string" &&
        ["contains", "equals", "startsWith", "endsWith", "notContains"].includes(
          cond.mode as string,
        ),
    )
  )
}

export function isNumberFilterPayload(payload: FilterPayload): payload is NumberFilterPayload {
  return (
    "conditions" in payload &&
    Array.isArray(payload.conditions) &&
    payload.conditions.every(
      (cond: unknown) =>
        cond &&
        typeof cond === "object" &&
        "mode" in cond &&
        "value" in cond &&
        typeof cond.value === "number" &&
        ["equals", "gt", "gte", "lt", "lte", "between"].includes(cond.mode as string),
    )
  )
}

export function isDateFilterPayload(payload: FilterPayload): payload is DateFilterPayload {
  return (
    "mode" in payload &&
    ["preset", "custom", "range", "before", "after"].includes(payload.mode as string) &&
    (("preset" in payload && typeof payload.preset === "string") ||
      ("value" in payload && typeof payload.value === "string"))
  )
}

export function isBooleanFilterPayload(payload: FilterPayload): payload is BooleanFilterPayload {
  return (
    "value" in payload &&
    (typeof payload.value === "boolean" || payload.value === null) &&
    !("mode" in payload)
  )
}

export function isTextListFilterPayload(payload: FilterPayload): payload is TextListFilterPayload {
  return (
    "values" in payload &&
    "mode" in payload &&
    Array.isArray(payload.values) &&
    payload.values.every((v) => typeof v === "string") &&
    ["include", "exclude"].includes(payload.mode as string)
  )
}

export function isIdListFilterPayload(payload: FilterPayload): payload is IdListFilterPayload {
  return (
    "ids" in payload &&
    "mode" in payload &&
    Array.isArray(payload.ids) &&
    payload.ids.every((id) => typeof id === "string") &&
    ["include", "exclude"].includes(payload.mode as string)
  )
}

export function isCustomFilterPayload(payload: FilterPayload): payload is CustomFilterPayload {
  // Custom payload is anything that doesn't match other types
  return (
    !isTextFilterPayload(payload) &&
    !isNumberFilterPayload(payload) &&
    !isDateFilterPayload(payload) &&
    !isBooleanFilterPayload(payload) &&
    !isTextListFilterPayload(payload) &&
    !isIdListFilterPayload(payload)
  )
}

// ============================================
// Column Filter Type Guards
// ============================================

export function isTextFilter(
  filter: ColumnFilter,
): filter is ColumnFilter & { payload: TextFilterPayload } {
  return filter.type === "text" && isTextFilterPayload(filter.payload)
}

export function isNumberFilter(
  filter: ColumnFilter,
): filter is ColumnFilter & { payload: NumberFilterPayload } {
  return filter.type === "number" && isNumberFilterPayload(filter.payload)
}

export function isDateFilter(
  filter: ColumnFilter,
): filter is ColumnFilter & { payload: DateFilterPayload } {
  return filter.type === "date" && isDateFilterPayload(filter.payload)
}

export function isBooleanFilter(
  filter: ColumnFilter,
): filter is ColumnFilter & { payload: BooleanFilterPayload } {
  return filter.type === "boolean" && isBooleanFilterPayload(filter.payload)
}

export function isTextListFilter(
  filter: ColumnFilter,
): filter is ColumnFilter & { payload: TextListFilterPayload } {
  return filter.type === "text-list" && isTextListFilterPayload(filter.payload)
}

export function isIdListFilter(
  filter: ColumnFilter,
): filter is ColumnFilter & { payload: IdListFilterPayload } {
  return filter.type === "id-list" && isIdListFilterPayload(filter.payload)
}

export function isCustomFilter(
  filter: ColumnFilter,
): filter is ColumnFilter & { payload: CustomFilterPayload } {
  return filter.type === "custom" && isCustomFilterPayload(filter.payload)
}
