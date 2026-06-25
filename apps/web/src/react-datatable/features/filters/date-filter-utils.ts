import { endOfDay, format, startOfDay, subDays, subMonths, subYears } from "date-fns"
import type { DateFilterPayload } from "../../types/filter.types"

/**
 * Calculate date range for relative presets
 *
 * Returns the start and end dates for a given preset value.
 * All ranges go from the start of the calculated past date to the current moment.
 *
 * @param preset - Preset value (e.g., '1d', '3d', '1w', '1m', '3m', '6m', '1y')
 * @returns Object with start and end dates
 */
export function getRelativeDateRange(preset: string): { start: Date; end: Date } {
  const now = new Date()
  const end = now

  let start: Date

  switch (preset) {
    case "1d":
      start = subDays(now, 1)
      break
    case "3d":
      start = subDays(now, 3)
      break
    case "1w":
      start = subDays(now, 7)
      break
    case "1m":
      start = subMonths(now, 1)
      break
    case "3m":
      start = subMonths(now, 3)
      break
    case "6m":
      start = subMonths(now, 6)
      break
    case "1y":
      start = subYears(now, 1)
      break
    default:
      // Unknown preset, default to last 7 days
      start = subDays(now, 7)
  }

  // Normalize to start of day for the start date
  start = startOfDay(start)

  return { start, end }
}

/**
 * Format date filter summary for chip display
 *
 * Creates a human-readable summary of the active date filter.
 *
 * @param payload - Date filter payload
 * @returns Formatted summary string
 */
export function formatDateFilterSummary(payload: DateFilterPayload): string {
  if (payload.mode === "preset" && payload.preset) {
    // Return preset label (e.g., "1 week ago")
    const presetLabels: Record<string, string> = {
      "1d": "1 day ago",
      "3d": "3 days ago",
      "1w": "1 week ago",
      "1m": "1 month ago",
      "3m": "3 months ago",
      "6m": "6 months ago",
      "1y": "1 year ago",
    }
    return presetLabels[payload.preset] ?? payload.preset
  }

  if (payload.mode === "custom" && payload.value) {
    // Format single date (e.g., "Jan 15, 2025")
    const date = new Date(payload.value)
    return format(date, "MMM d, yyyy")
  }

  if (payload.mode === "range" && payload.value && payload.value2) {
    // Format date range (e.g., "Jan 15 - Feb 20")
    const date1 = new Date(payload.value)
    const date2 = new Date(payload.value2)
    const year1 = date1.getFullYear()
    const year2 = date2.getFullYear()

    if (year1 === year2) {
      // Same year: "Jan 15 - Feb 20, 2025"
      return `${format(date1, "MMM d")} - ${format(date2, "MMM d, yyyy")}`
    }
    // Different years: "Dec 15, 2024 - Jan 20, 2025"
    return `${format(date1, "MMM d, yyyy")} - ${format(date2, "MMM d, yyyy")}`
  }

  if (payload.mode === "before" && payload.value) {
    const date = new Date(payload.value)
    return `before ${format(date, "MMM d, yyyy")}`
  }

  if (payload.mode === "after" && payload.value) {
    const date = new Date(payload.value)
    return `after ${format(date, "MMM d, yyyy")}`
  }

  return "Date filter"
}

/**
 * Format date value(s) for chip display (without mode)
 *
 * Returns just the date value(s) without the mode prefix (e.g., "before", "after")
 *
 * @param payload - Date filter payload
 * @returns Formatted date value(s) string
 */
export function formatDateFilterValue(payload: DateFilterPayload): string {
  if (payload.mode === "preset" && payload.preset) {
    // Calculate the actual date from the preset
    const { start } = getRelativeDateRange(payload.preset)
    return format(start, "MMM d, yyyy")
  }

  if (payload.mode === "custom" && payload.value) {
    const date = new Date(payload.value)
    return format(date, "MMM d, yyyy")
  }

  if (payload.mode === "range" && payload.value && payload.value2) {
    const date1 = new Date(payload.value)
    const date2 = new Date(payload.value2)
    const year1 = date1.getFullYear()
    const year2 = date2.getFullYear()

    if (year1 === year2) {
      return `${format(date1, "MMM d")} - ${format(date2, "MMM d, yyyy")}`
    }
    return `${format(date1, "MMM d, yyyy")} - ${format(date2, "MMM d, yyyy")}`
  }

  if (payload.mode === "before" && payload.value) {
    const date = new Date(payload.value)
    return format(date, "MMM d, yyyy")
  }

  if (payload.mode === "after" && payload.value) {
    const date = new Date(payload.value)
    return format(date, "MMM d, yyyy")
  }

  return "Date"
}

/**
 * Check if a date falls within a filter's criteria
 *
 * @param cellDate - The date from the table cell
 * @param payload - Date filter payload
 * @returns True if the date matches the filter criteria
 */
export function matchesDateFilter(cellDate: Date, payload: DateFilterPayload): boolean {
  if (payload.mode === "preset" && payload.preset) {
    const { start, end } = getRelativeDateRange(payload.preset)
    return cellDate >= start && cellDate <= end
  }

  if (payload.mode === "custom" && payload.value) {
    const targetDate = new Date(payload.value)
    // Match if same day
    return (
      startOfDay(cellDate).getTime() >= startOfDay(targetDate).getTime() &&
      endOfDay(cellDate).getTime() <= endOfDay(targetDate).getTime()
    )
  }

  if (payload.mode === "range" && payload.value && payload.value2) {
    const startDate = startOfDay(new Date(payload.value))
    const endDate = endOfDay(new Date(payload.value2))
    return cellDate >= startDate && cellDate <= endDate
  }

  if (payload.mode === "before" && payload.value) {
    const targetDate = startOfDay(new Date(payload.value))
    return cellDate < targetDate
  }

  if (payload.mode === "after" && payload.value) {
    const targetDate = endOfDay(new Date(payload.value))
    return cellDate > targetDate
  }

  return true
}
