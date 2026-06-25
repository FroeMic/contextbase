/**
 * Formatting utilities for datatable components
 */

/**
 * Truncate a string value to a maximum length with ellipsis
 *
 * @param value - The string to truncate
 * @param maxLength - Maximum length before truncation (default: 20)
 * @returns Truncated string with "..." appended if truncated
 */
export function formatTruncate(value: string, maxLength: number = 20): string {
  if (value.length > maxLength) {
    return value.substring(0, maxLength) + "..."
  }
  return value
}
