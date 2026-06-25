import type { FilterFn } from "@tanstack/react-table"
import type {
  BooleanFilterPayload,
  DateFilterPayload,
  IdListFilterPayload,
  NumberFilterPayload,
  TextFilterPayload,
  TextListFilterPayload,
} from "../../types/filter.types"
import { matchesDateFilter } from "./date-filter-utils"

const shouldLogFilterErrors = import.meta.env?.MODE !== "production"

function normalizeListValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry))
  }

  if (value == null) {
    return []
  }

  return [String(value)]
}

/**
 * Text filter function for TanStack Table
 *
 * Supports multi-condition filtering with AND/OR operators:
 * - Single condition: Standard text matching
 * - Multiple conditions with OR: Row passes if ANY condition matches
 * - Multiple conditions with AND: Row passes if ALL conditions match
 *
 * Modes:
 * - contains: Substring match
 * - equals: Exact match
 * - startsWith: Prefix match
 * - endsWith: Suffix match
 * - notContains: Inverse substring match
 *
 * Note: Uses `unknown` for TData since filter functions are registered globally
 * and must work with any table data type. The function only accesses cell values
 * via row.getValue(), which is type-safe.
 */
export const textFilterFn: FilterFn<unknown> = (row, columnId, filterValue: TextFilterPayload) => {
  try {
    const payload = filterValue

    // Guard: If payload is null/undefined or malformed, pass the row
    if (!payload || !payload.conditions || !Array.isArray(payload.conditions)) {
      return true
    }

    const cellValue = row.getValue(columnId)

    // Handle null/undefined cell values
    if (cellValue == null) {
      return false
    }

    // No conditions = filter passes (shouldn't happen, but defensive)
    if (payload.conditions.length === 0) {
      return true
    }

    const cellStr = String(cellValue).toLowerCase()
    const operator = payload.operator ?? "OR"

    // Evaluate each condition
    const conditionResults = payload.conditions.map((condition) => {
      const searchStr = condition.value.toLowerCase()

      switch (condition.mode) {
        case "contains":
          return cellStr.includes(searchStr)
        case "equals":
          return cellStr === searchStr
        case "startsWith":
          return cellStr.startsWith(searchStr)
        case "endsWith":
          return cellStr.endsWith(searchStr)
        case "notContains":
          return !cellStr.includes(searchStr)
        default:
          return true
      }
    })

    // Combine results based on operator
    return operator === "OR"
      ? conditionResults.some((result) => result) // ANY condition passes
      : conditionResults.every((result) => result) // ALL conditions pass
  } catch (error) {
    // Fail open: if filter throws, show the row (better UX than breaking the table)
    if (shouldLogFilterErrors) {
      console.error(`Text filter error for column ${columnId}:`, error)
    }
    return true
  }
}

/**
 * Text list filter function for TanStack Table
 *
 * Filters rows based on whether the cell value is included or excluded
 * from a list of selected values.
 *
 * Modes:
 * - include: Row passes if cell value is in the selected values
 * - exclude: Row passes if cell value is NOT in the selected values
 *
 * Note: Uses `unknown` for TData since filter functions are registered globally
 * and must work with any table data type.
 */
export const textListFilterFn: FilterFn<unknown> = (
  row,
  columnId,
  filterValue: TextListFilterPayload,
) => {
  try {
    const payload = filterValue

    // Guard: If payload is null/undefined or malformed, pass the row
    if (!payload || !payload.values || !Array.isArray(payload.values)) {
      return true
    }

    // No values selected = no filter active
    if (payload.values.length === 0) {
      return true
    }

    const cellValue = row.getValue(columnId)

    // Handle null/undefined cell values
    if (cellValue == null) {
      return false
    }

    const selectedValues = new Set(payload.values.map((entry) => entry.toLowerCase()))
    const rowValues = normalizeListValues(cellValue).map((entry) => entry.toLowerCase())
    const isIncluded = rowValues.some((entry) => selectedValues.has(entry))

    // Include mode: show if value is in list
    // Exclude mode: show if value is NOT in list
    return payload.mode === "include" ? isIncluded : !isIncluded
  } catch (error) {
    // Fail open: if filter throws, show the row (better UX than breaking the table)
    if (shouldLogFilterErrors) {
      console.error(`Text list filter error for column ${columnId}:`, error)
    }
    return true
  }
}

/**
 * Date filter function for TanStack Table
 *
 * Filters rows based on date criteria using presets or custom date ranges.
 *
 * Modes:
 * - preset: Relative date ranges (1d, 3d, 1w, 1m, 3m, 6m, 1y)
 * - custom: Specific date match
 * - range: Date range (from date1 to date2)
 * - before: Before a specific date
 * - after: After a specific date
 *
 * Note: Uses `unknown` for TData since filter functions are registered globally
 * and must work with any table data type.
 */
export const dateFilterFn: FilterFn<unknown> = (row, columnId, filterValue: DateFilterPayload) => {
  try {
    const payload = filterValue

    // Guard: If payload is null/undefined or malformed, pass the row
    if (!payload || !payload.mode) {
      return true
    }

    const cellValue = row.getValue(columnId)

    // Handle null/undefined cell values
    if (cellValue == null) {
      return false
    }

    // Parse cell value as Date
    let cellDate: Date
    try {
      if (cellValue instanceof Date) {
        cellDate = cellValue
      } else if (typeof cellValue === "string") {
        cellDate = new Date(cellValue)
      } else if (typeof cellValue === "number") {
        cellDate = new Date(cellValue)
      } else {
        // Unsupported cell value type
        return false
      }

      // Check if date is valid
      if (isNaN(cellDate.getTime())) {
        return false
      }
    } catch {
      // Failed to parse date
      return false
    }

    // Use utility function to match against filter criteria
    return matchesDateFilter(cellDate, payload)
  } catch (error) {
    // Fail open: if filter throws, show the row (better UX than breaking the table)
    if (shouldLogFilterErrors) {
      console.error(`Date filter error for column ${columnId}:`, error)
    }
    return true
  }
}

/**
 * Number filter function for TanStack Table
 *
 * Supports multi-condition filtering with AND/OR operators:
 * - Single condition: Standard numeric comparison
 * - Multiple conditions with OR: Row passes if ANY condition matches
 * - Multiple conditions with AND: Row passes if ALL conditions match
 *
 * Modes:
 * - equals: Exact match (=)
 * - gt: Greater than (>)
 * - gte: Greater than or equal (≥)
 * - lt: Less than (<)
 * - lte: Less than or equal (≤)
 * - between: Value range (between X and Y)
 *
 * Note: Uses `unknown` for TData since filter functions are registered globally
 * and must work with any table data type. The function only accesses cell values
 * via row.getValue(), which is type-safe.
 */
export const numberFilterFn: FilterFn<unknown> = (
  row,
  columnId,
  filterValue: NumberFilterPayload,
) => {
  try {
    const payload = filterValue

    // Guard: If payload is null/undefined or malformed, pass the row
    if (!payload || !payload.conditions || !Array.isArray(payload.conditions)) {
      return true
    }

    const cellValue = row.getValue(columnId)

    // Handle null/undefined cell values
    if (cellValue == null) {
      return false
    }

    // Parse cell value as number
    let cellNum: number
    if (typeof cellValue === "number") {
      cellNum = cellValue
    } else if (typeof cellValue === "string") {
      cellNum = parseFloat(cellValue)
    } else {
      // Unsupported cell value type
      return false
    }

    // Check if parsed value is valid
    if (isNaN(cellNum)) {
      return false
    }

    // No conditions = filter passes (shouldn't happen, but defensive)
    if (payload.conditions.length === 0) {
      return true
    }

    const operator = payload.operator ?? "OR"

    // Evaluate each condition
    const conditionResults = payload.conditions.map((condition) => {
      const value = condition.value

      // Skip invalid conditions
      if (isNaN(value)) {
        return false
      }

      switch (condition.mode) {
        case "equals":
          return cellNum === value
        case "gt":
          return cellNum > value
        case "gte":
          return cellNum >= value
        case "lt":
          return cellNum < value
        case "lte":
          return cellNum <= value
        case "between": {
          const value2 = condition.value2
          // Validate second value for between mode
          if (value2 === undefined || isNaN(value2)) {
            return false
          }
          // Between is inclusive on both ends
          return cellNum >= value && cellNum <= value2
        }
        default:
          return true
      }
    })

    // Combine results based on operator
    return operator === "OR"
      ? conditionResults.some((result) => result) // ANY condition passes
      : conditionResults.every((result) => result) // ALL conditions pass
  } catch (error) {
    // Fail open: if filter throws, show the row (better UX than breaking the table)
    if (shouldLogFilterErrors) {
      console.error(`Number filter error for column ${columnId}:`, error)
    }
    return true
  }
}

export const booleanFilterFn: FilterFn<unknown> = (
  row,
  columnId,
  filterValue: BooleanFilterPayload,
) => {
  try {
    const payload = filterValue

    if (!payload || payload.value === null || payload.value === undefined) {
      return true
    }

    const cellValue = row.getValue(columnId)
    if (cellValue == null) {
      return false
    }

    return Boolean(cellValue) === payload.value
  } catch (error) {
    if (shouldLogFilterErrors) {
      console.error(`Boolean filter error for column ${columnId}:`, error)
    }
    return true
  }
}

export const idListFilterFn: FilterFn<unknown> = (
  row,
  columnId,
  filterValue: IdListFilterPayload,
) => {
  try {
    const payload = filterValue

    if (!payload || !payload.ids || !Array.isArray(payload.ids) || payload.ids.length === 0) {
      return true
    }

    const cellValue = row.getValue(columnId)
    if (cellValue == null) {
      return false
    }

    const selectedIds = new Set(payload.ids)
    const rowValues = normalizeListValues(cellValue)
    const hasMatch = rowValues.some((entry) => selectedIds.has(entry))

    return payload.mode === "include" ? hasMatch : !hasMatch
  } catch (error) {
    if (shouldLogFilterErrors) {
      console.error(`ID list filter error for column ${columnId}:`, error)
    }
    return true
  }
}

// Export filter functions registry for use-datatable-table
export const filterFunctions = {
  text: textFilterFn,
  "text-list": textListFilterFn,
  date: dateFilterFn,
  number: numberFilterFn,
  boolean: booleanFilterFn,
  "id-list": idListFilterFn,
}
