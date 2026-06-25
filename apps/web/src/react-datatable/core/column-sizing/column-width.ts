import type { DatatableColumn } from "../../types/column.types"

/**
 * Centralized column width defaults
 * Use these constants instead of magic numbers throughout the codebase
 */
export const COLUMN_WIDTH_DEFAULTS = {
  DEFAULT: 200,
  MIN: 100,
  MAX: 800,
} as const

const DEFAULT_COLUMN_WIDTH = COLUMN_WIDTH_DEFAULTS.DEFAULT
const DEFAULT_MIN_WIDTH = COLUMN_WIDTH_DEFAULTS.MIN
const DEFAULT_MAX_WIDTH = COLUMN_WIDTH_DEFAULTS.MAX

/**
 * Resolve the actual width for a column
 * Priority: userWidth (from state) > column.width > DEFAULT_COLUMN_WIDTH
 *
 * @param column - Column configuration
 * @param userWidth - User-customized width from state
 * @returns Resolved width in pixels, constrained by min/max
 */
export function resolveColumnWidth<TData>(
  column: DatatableColumn<TData>,
  userWidth?: number,
): number {
  const width = userWidth ?? column.width ?? DEFAULT_COLUMN_WIDTH
  const minWidth = column.minWidth ?? DEFAULT_MIN_WIDTH
  const maxWidth = column.maxWidth ?? DEFAULT_MAX_WIDTH

  return Math.max(minWidth, Math.min(maxWidth, width))
}

/**
 * Get minimum width for a column
 */
export function getColumnMinWidth<TData>(column: DatatableColumn<TData>): number {
  return column.minWidth ?? DEFAULT_MIN_WIDTH
}

/**
 * Get maximum width for a column
 */
export function getColumnMaxWidth<TData>(column: DatatableColumn<TData>): number {
  return column.maxWidth ?? DEFAULT_MAX_WIDTH
}

/**
 * Check if a width is valid for a column (within min/max bounds)
 */
export function isValidColumnWidth<TData>(column: DatatableColumn<TData>, width: number): boolean {
  const minWidth = getColumnMinWidth(column)
  const maxWidth = getColumnMaxWidth(column)
  return width >= minWidth && width <= maxWidth
}

/**
 * Get comprehensive width information for a column
 * Useful for resize dialogs and column width UI components
 *
 * @param column - Column configuration (can be null/undefined for safety)
 * @param currentWidth - Current width from state (optional)
 * @returns Object with current, default, min, max widths
 */
export function getColumnWidthInfo<TData>(
  column: DatatableColumn<TData> | null | undefined,
  currentWidth?: number,
): {
  current: number
  default: number
  min: number
  max: number
} {
  const defaultWidth = column?.width ?? COLUMN_WIDTH_DEFAULTS.DEFAULT
  const min = column?.minWidth ?? COLUMN_WIDTH_DEFAULTS.MIN
  const max = column?.maxWidth ?? COLUMN_WIDTH_DEFAULTS.MAX
  const current = currentWidth ?? defaultWidth

  return {
    current,
    default: defaultWidth,
    min,
    max,
  }
}
