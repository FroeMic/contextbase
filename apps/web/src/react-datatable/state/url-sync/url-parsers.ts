import type { SortingState } from "@tanstack/react-table"
import type {
  BooleanFilterPayload,
  DateFilterPayload,
  IdListFilterPayload,
  NumberFilterPayload,
  TextFilterPayload,
  TextListFilterPayload,
} from "../../types/filter.types"

/**
 * URL parsers for Datatable state.
 *
 * Maintains short, human-readable URL notation (e.g., f.name=contains:john).
 */

export interface UrlParser<T> {
  parse: (value: string) => T
  serialize: (value: T) => string
}

function createParser<T>(parser: UrlParser<T>): UrlParser<T> {
  return parser
}

// ============================================================================
// Text Filter Parser
// ============================================================================

/**
 * Parse text filter from URL
 * Format: "contains:john|startsWith:jane" (OR) or "contains:john&startsWith:jane" (AND)
 * @example f.name=contains:john|startsWith:jane
 */
export const textFilterParser = createParser<TextFilterPayload>({
  parse(value): TextFilterPayload {
    try {
      // Detect operator: if contains "|" use OR, else AND
      const hasOrSeparator = value.includes("|")
      const separator = hasOrSeparator ? "|" : "&"
      const operator = hasOrSeparator ? "OR" : "AND"

      const conditions = value.split(separator).map((condition) => {
        const [mode, ...valueParts] = condition.split(":")
        const decodedValue = decodeURIComponent(valueParts.join(":")) // Handle values with colons
        return {
          mode: mode as TextFilterPayload["conditions"][0]["mode"],
          value: decodedValue,
        }
      })

      return { conditions, operator }
    } catch (error) {
      console.warn("[URL Parse] Invalid text filter, using safe fallback:", value, error)
      return { conditions: [], operator: "AND" }
    }
  },

  serialize(payload): string {
    const separator = payload.operator === "AND" ? "&" : "|"
    return payload.conditions.map((c) => `${c.mode}:${encodeURIComponent(c.value)}`).join(separator)
  },
})

// ============================================================================
// Number Filter Parser
// ============================================================================

/**
 * Parse number filter from URL
 * Format: "gt:18" or "between:50:100"
 * @example f.age=gt:18 or f.salary=between:50000:100000
 */
export const numberFilterParser = createParser<NumberFilterPayload>({
  parse(value): NumberFilterPayload {
    try {
      const hasOrSeparator = value.includes("|")
      const separator = hasOrSeparator ? "|" : "&"
      const operator = hasOrSeparator ? "OR" : "AND"

      const conditions = value.split(separator).map((condition) => {
        const parts = condition.split(":")
        const mode = parts[0] as NumberFilterPayload["conditions"][0]["mode"]

        if (mode === "between") {
          const value1 = parseFloat(parts[1])
          const value2 = parseFloat(parts[2])

          if (isNaN(value1) || isNaN(value2)) {
            throw new Error(`Invalid number values: ${parts[1]}, ${parts[2]}`)
          }

          return {
            mode,
            value: value1,
            value2: value2,
          }
        }

        const parsedValue = parseFloat(parts[1])

        if (isNaN(parsedValue)) {
          throw new Error(`Invalid number value: ${parts[1]}`)
        }

        return {
          mode,
          value: parsedValue,
        }
      })

      return { conditions, operator }
    } catch (error) {
      console.warn("[URL Parse] Invalid number filter, using safe fallback:", value, error)
      return { conditions: [], operator: "AND" }
    }
  },

  serialize(payload): string {
    const separator = payload.operator === "AND" ? "&" : "|"
    return payload.conditions
      .map((c) => {
        if (c.mode === "between" && c.value2 !== undefined) {
          return `${c.mode}:${c.value}:${c.value2}`
        }
        return `${c.mode}:${c.value}`
      })
      .join(separator)
  },
})

// ============================================================================
// Date Filter Parser
// ============================================================================

/**
 * Parse date filter from URL
 * Format: "preset:last7d" or "range:2024-01-01:2024-12-31"
 * @example f.created=preset:last7d or f.deadline=range:2024-01-01:2024-12-31
 */
export const dateFilterParser = createParser<DateFilterPayload>({
  parse(value): DateFilterPayload {
    try {
      const parts = value.split(":")
      const mode = parts[0]

      if (mode === "preset") {
        return { mode: "preset", preset: parts[1] }
      } else if (mode === "range") {
        return { mode: "range", value: parts[1], value2: parts[2] }
      } else if (mode === "before") {
        return { mode: "before", value: parts[1] }
      } else if (mode === "after") {
        return { mode: "after", value: parts[1] }
      } else if (mode === "custom") {
        return { mode: "custom", value: parts[1] }
      }

      // Fallback for unknown mode
      console.warn(`[URL Parse] Unknown date filter mode: ${mode}, using safe fallback`)
      return { mode: "preset", preset: "last7d" }
    } catch (error) {
      console.warn("[URL Parse] Invalid date filter, using safe fallback:", value, error)
      return { mode: "preset", preset: "last7d" }
    }
  },

  serialize(payload): string {
    if (payload.mode === "preset" && payload.preset) {
      return `preset:${payload.preset}`
    } else if (payload.mode === "range" && payload.value && payload.value2) {
      return `range:${payload.value}:${payload.value2}`
    } else if (payload.mode === "before" && payload.value) {
      return `before:${payload.value}`
    } else if (payload.mode === "after" && payload.value) {
      return `after:${payload.value}`
    } else if (payload.mode === "custom" && payload.value) {
      return `custom:${payload.value}`
    }
    return ""
  },
})

// ============================================================================
// Text List Filter Parser
// ============================================================================

/**
 * Parse text list filter from URL
 * Format: "include:active,pending" or "exclude:archived"
 * @example f.status=include:active,pending
 */
export const textListFilterParser = createParser<TextListFilterPayload>({
  parse(value): TextListFilterPayload {
    try {
      const parts = value.split(":")
      const mode = parts[0] === "exclude" ? "exclude" : "include"
      const values = parts[1].split(",").map((v) => decodeURIComponent(v))
      return { values, mode }
    } catch (error) {
      console.warn("[URL Parse] Invalid text list filter, using safe fallback:", value, error)
      return { values: [], mode: "include" }
    }
  },

  serialize(payload): string {
    const mode = payload.mode
    const values = payload.values.map((v) => encodeURIComponent(v)).join(",")
    return `${mode}:${values}`
  },
})

export const booleanFilterParser = createParser<BooleanFilterPayload>({
  parse(value): BooleanFilterPayload {
    if (value === "true") {
      return { value: true }
    }
    if (value === "false") {
      return { value: false }
    }
    return { value: null }
  },

  serialize(payload): string {
    if (payload.value === true) {
      return "true"
    }
    if (payload.value === false) {
      return "false"
    }
    return ""
  },
})

export const idListFilterParser = createParser<IdListFilterPayload>({
  parse(value): IdListFilterPayload {
    try {
      const parts = value.split(":")
      const mode = parts[0] === "exclude" ? "exclude" : "include"
      const ids = parts[1].split(",").map((v) => decodeURIComponent(v))
      return { ids, mode }
    } catch (error) {
      console.warn("[URL Parse] Invalid id list filter, using safe fallback:", value, error)
      return { ids: [], mode: "include" }
    }
  },

  serialize(payload): string {
    const mode = payload.mode
    const ids = payload.ids.map((v) => encodeURIComponent(v)).join(",")
    return `${mode}:${ids}`
  },
})

// ============================================================================
// Sorting Parser
// ============================================================================

/**
 * Parse sorting state from URL
 * Format: "name:asc" or "status:asc,created:desc"
 * @example s=name:asc or s=status:asc,created:desc
 */
export const sortingParser = createParser<SortingState>({
  parse(value): SortingState {
    if (!value) {
      return []
    }

    try {
      return value.split(",").map((item) => {
        const [id, dir] = item.split(":")
        return {
          id: decodeURIComponent(id),
          desc: dir === "desc",
        }
      })
    } catch (error) {
      console.error("[URL Parsing] Failed to parse sorting:", error)
      return []
    }
  },

  serialize(sorting): string {
    if (!sorting || sorting.length === 0) {
      return ""
    }

    return sorting.map((s) => `${encodeURIComponent(s.id)}:${s.desc ? "desc" : "asc"}`).join(",")
  },
})

// ============================================================================
// Filter Mode Parser
// ============================================================================

/**
 * Parse filter mode (AND/OR for cross-column filters)
 * Format: "or" (default is AND, so only encode OR)
 * @example fm=or
 */
export const filterModeParser = createParser<"AND" | "OR">({
  parse(value): "AND" | "OR" {
    try {
      return value === "or" ? "OR" : "AND"
    } catch (error) {
      console.warn("[URL Parse] Invalid filter mode, using safe fallback:", value, error)
      return "AND"
    }
  },
  serialize(value): string {
    return value === "OR" ? "or" : "and"
  },
})

// ============================================================================
// Grouping Parser
// ============================================================================

/**
 * Parse row grouping from URL
 * Format: "status" or "status,priority"
 * @example g=status,priority
 */
export const groupingParser = createParser<string[]>({
  parse(value): string[] {
    if (!value) {
      return []
    }

    return value.split(",").map((item) => decodeURIComponent(item))
  },
  serialize(value): string {
    return value.map((item) => encodeURIComponent(item)).join(",")
  },
})

// ============================================================================
// Global Filter Parser
// ============================================================================

/**
 * Parse global search query
 * @example q=john+doe
 */
export const globalFilterParser = createParser<string>({
  parse(value): string {
    return value
  },
  serialize(value): string {
    return value
  },
})
