/**
 * Shared filter constants
 *
 * Centralized constants used across filter components to avoid duplication
 * and ensure consistency.
 */

import { TEXT_FILTER_MODES, type TextFilterMode } from "../../types/filter.types"

/**
 * Implemented filter types
 *
 * Only these filter types are currently implemented and available in the UI.
 * Used by FilterDropdown to determine which columns to show.
 *
 * Custom filters remain extension points.
 */
export const IMPLEMENTED_FILTER_TYPES = [
  "text",
  "text-list",
  "date",
  "number",
  "boolean",
  "id-list",
] as const
export type ImplementedFilterType = (typeof IMPLEMENTED_FILTER_TYPES)[number]

/**
 * Check if a filter type is implemented
 */
export function isFilterTypeImplemented(filterType: string | undefined): boolean {
  if (!filterType) {
    return false
  }
  return IMPLEMENTED_FILTER_TYPES.includes(filterType as ImplementedFilterType)
}

/**
 * Re-export TextFilterMode from types for convenience
 */
export type { TextFilterMode }

/**
 * Text filter mode label mapping
 * Maps mode values to human-readable labels
 */
const TEXT_FILTER_MODE_LABELS: Record<TextFilterMode, string> = {
  contains: "contains",
  equals: "equals",
  startsWith: "starts with",
  endsWith: "ends with",
  notContains: "excludes",
}

/**
 * Text filter mode options
 *
 * Derived from TEXT_FILTER_MODES to ensure consistency with types.
 * Used in TextFilterEditor and FilterChip for mode selection dropdowns.
 */
export const TEXT_FILTER_MODE_OPTIONS = TEXT_FILTER_MODES.map((mode) => ({
  value: mode,
  label: TEXT_FILTER_MODE_LABELS[mode],
})) as ReadonlyArray<{ value: TextFilterMode; label: string }>

/**
 * Get label for a text filter mode
 */
export function getTextFilterModeLabel(mode: string): string {
  return TEXT_FILTER_MODE_LABELS[mode as TextFilterMode] ?? mode
}

/**
 * Text-list filter mode options
 *
 * Used in TextListFilterChip for mode selection dropdown.
 * Matches the TextListFilterPayload mode type.
 */
export const OPTION_LIST_FILTER_MODE_OPTIONS = [
  { value: "include" as const, label: "is any of" },
  { value: "exclude" as const, label: "is none of" },
] as const

export const TEXT_LIST_FILTER_MODE_OPTIONS = OPTION_LIST_FILTER_MODE_OPTIONS

/**
 * Get label for a text-list filter mode
 */
export function getOptionListFilterModeLabel(mode: "include" | "exclude"): string {
  return mode === "include" ? "is any of" : "is none of"
}

export const getTextListFilterModeLabel = getOptionListFilterModeLabel

/**
 * Date filter preset options
 *
 * Used in DateFilterEditor for quick date range selection.
 * Presets are calculated relative to current time when filter is applied.
 */
export const DATE_FILTER_PRESET_OPTIONS = [
  { value: "1d", label: "1 day ago" },
  { value: "3d", label: "3 days ago" },
  { value: "1w", label: "1 week ago" },
  { value: "1m", label: "1 month ago" },
  { value: "3m", label: "3 months ago" },
  { value: "6m", label: "6 months ago" },
  { value: "1y", label: "1 year ago" },
  { value: "custom", label: "Custom date or timeframe..." },
] as const

/**
 * Get label for a date filter preset
 */
export function getDateFilterPresetLabel(preset: string): string {
  const option = DATE_FILTER_PRESET_OPTIONS.find((opt) => opt.value === preset)
  return option?.label ?? preset
}

/**
 * Date filter mode options
 *
 * Used in DateFilterChip for mode selection dropdown.
 * Matches the DateFilterPayload mode type.
 * Note: "preset" is not included as it's converted to "after" with a calculated date.
 */
export const DATE_FILTER_MODE_OPTIONS = [
  { value: "before" as const, label: "is before" },
  { value: "after" as const, label: "is after" },
  { value: "range" as const, label: "is between" },
  { value: "custom" as const, label: "is on" },
] as const

/**
 * Get label for a date filter mode
 * Note: "preset" mode is displayed as "is after" since presets are relative date ranges
 */
export function getDateFilterModeLabel(
  mode: "preset" | "custom" | "range" | "before" | "after",
): string {
  // Preset mode is displayed as "after"
  if (mode === "preset") {
    return "is after"
  }
  const option = DATE_FILTER_MODE_OPTIONS.find((opt) => opt.value === mode)
  return option?.label ?? mode
}

/**
 * Number filter mode options
 *
 * Used in NumberFilterEditor for mode selection.
 * Matches the NumberFilterPayload mode type.
 */
export const NUMBER_FILTER_MODE_OPTIONS = [
  { value: "equals" as const, label: "=" },
  { value: "gt" as const, label: ">" },
  { value: "gte" as const, label: "≥" },
  { value: "lt" as const, label: "<" },
  { value: "lte" as const, label: "≤" },
] as const

/**
 * Get label for a number filter mode
 */
export function getNumberFilterModeLabel(mode: string): string {
  const option = NUMBER_FILTER_MODE_OPTIONS.find((opt) => opt.value === mode)
  return option?.label ?? mode
}
