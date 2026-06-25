import type { ReactNode } from "react"

/**
 * Filter Type System
 *
 * Defines all filter types, payloads, and options for the datatable filtering system.
 */

// ============================================
// Filter Types
// ============================================

export type FilterType = "text" | "number" | "date" | "boolean" | "text-list" | "id-list" | "custom"

export type FilterOptionValue = string | boolean
export type OptionListFilterMode = "include" | "exclude"

export interface FilterOption<T extends FilterOptionValue = string> {
  value: T
  label: string
}

export interface OptionListFilterOptions<T extends FilterOptionValue = string> {
  renderOption?: (option: FilterOption<T>) => ReactNode
}

// ============================================
// Filter Payloads
// ============================================

/**
 * Text filter modes
 * Available text matching modes for text filters
 */
export const TEXT_FILTER_MODES = [
  "contains",
  "equals",
  "startsWith",
  "endsWith",
  "notContains",
] as const
export type TextFilterMode = (typeof TEXT_FILTER_MODES)[number]

/**
 * Text filter payload
 * For filtering string columns with various text matching modes
 *
 * Supports multiple conditions with AND/OR operators:
 * - Single condition: { conditions: [{ mode: "contains", value: "test" }] }
 * - Multiple conditions: { conditions: [...], operator: "OR" }
 */
export interface TextFilterPayload {
  conditions: Array<{
    mode: TextFilterMode
    value: string
  }>
  operator?: "AND" | "OR" // Default: "OR" - how to combine multiple conditions
}

/**
 * Number filter modes
 * Available comparison operators for number filters
 */
export const NUMBER_FILTER_MODES = ["equals", "gt", "gte", "lt", "lte", "between"] as const
export type NumberFilterMode = (typeof NUMBER_FILTER_MODES)[number]

/**
 * Number filter payload
 * For filtering numeric columns with comparison operators
 *
 * Supports multiple conditions with AND/OR operators:
 * - Single condition: { conditions: [{ mode: "gt", value: 10 }] }
 * - Multiple conditions: { conditions: [...], operator: "OR" }
 */
export interface NumberFilterPayload {
  conditions: Array<{
    mode: NumberFilterMode
    value: number
    value2?: number // Required for 'between' mode
  }>
  operator?: "AND" | "OR" // Default: "OR" - how to combine multiple conditions
}

/**
 * Date filter payload
 * For filtering date columns with presets or custom date ranges
 */
export interface DateFilterPayload {
  mode: "preset" | "custom" | "range" | "before" | "after"
  preset?: string // e.g., '1d', '3d', '1w', '1m', '3m', '6m', '1y' (for mode: 'preset')
  value?: string // ISO date string (for custom/range/before/after modes)
  value2?: string // ISO date string (required for 'range' mode)
}

/**
 * Boolean filter payload
 * For filtering boolean columns
 */
export interface BooleanFilterPayload {
  value: boolean | null // null = any/unset
}

export interface BooleanFilterOptions extends OptionListFilterOptions<boolean> {
  options?: [FilterOption<boolean>, FilterOption<boolean>]
}

/**
 * Text list filter payload
 * For filtering columns with a fixed set of string options (e.g., status, tags)
 */
export interface TextListFilterPayload {
  values: string[] // Selected values
  mode: OptionListFilterMode
}

/**
 * ID list filter payload
 * For filtering columns by related entity IDs (e.g., assignee IDs, project IDs)
 */
export interface IdListFilterPayload {
  ids: string[] // Selected entity IDs
  mode: "include" | "exclude"
}

/**
 * Custom filter payload
 * For custom filter implementations with flexible structure
 */
export interface CustomFilterPayload {
  [key: string]: unknown
}

/**
 * Union of all filter payload types
 */
export type FilterPayload =
  | TextFilterPayload
  | NumberFilterPayload
  | DateFilterPayload
  | BooleanFilterPayload
  | TextListFilterPayload
  | IdListFilterPayload
  | CustomFilterPayload

/**
 * Type-safe mapping from FilterType to its corresponding payload type
 * Used for type inference in setColumnFilter
 */
export interface FilterPayloadMap {
  text: TextFilterPayload
  number: NumberFilterPayload
  date: DateFilterPayload
  boolean: BooleanFilterPayload
  "text-list": TextListFilterPayload
  "id-list": IdListFilterPayload
  custom: CustomFilterPayload
}

// ============================================
// Column Filter State
// ============================================

/**
 * Column filter state entry
 * This replaces TanStack Table's ColumnFiltersState
 */
export interface ColumnFilter {
  id: string // Column ID
  type: FilterType
  payload: FilterPayload
}

// ============================================
// Filter Options (Column Configuration)
// ============================================

/**
 * Options for text-list filters
 * Defines the available options for checkbox/select filtering
 */
export interface TextListFilterOptions extends OptionListFilterOptions<string> {
  options: string[] | FilterOption<string>[]
}

/**
 * Options for id-list filters
 * Can provide static options or async function to fetch them
 */
export interface IdListFilterOptions extends OptionListFilterOptions<string> {
  options: FilterOption<string>[]
  isLoading?: boolean
  emptyText?: string
  searchPlaceholder?: string
}

/**
 * Options for date filters
 * Provides preset quick-select options
 */
export interface DateFilterOptions {
  presets?: ("today" | "yesterday" | "last7days" | "last30days" | "thisMonth" | "lastMonth")[]
}

/**
 * Union of all filter options types
 */
export type FilterOptions =
  | TextListFilterOptions
  | IdListFilterOptions
  | BooleanFilterOptions
  | DateFilterOptions
  | Record<string, never>
