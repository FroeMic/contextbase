import { useCallback, useMemo } from "react"
import { useShallow } from "zustand/shallow"
import { useDatatableColumns } from "../../core/DatatableProvider"
import { useDatatableStore } from "../store/use-datatable-store"
import {
  booleanFilterParser,
  dateFilterParser,
  filterModeParser,
  globalFilterParser,
  groupingParser,
  idListFilterParser,
  numberFilterParser,
  sortingParser,
  textFilterParser,
  textListFilterParser,
} from "./url-parsers"

/**
 * Parser configuration interface
 * Defines the contract for URL state serialization
 * Uses flexible typing since each parser has its own specific types
 */
interface SerializerConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serialize: (value: any) => string
}

function removeDatatableParams(
  params: URLSearchParams,
  parserConfig: Record<string, SerializerConfig>,
) {
  for (const key of Object.keys(parserConfig)) {
    params.delete(key)
  }
}

/**
 * Hook to serialize current datatable state to URL query string
 *
 * Useful for:
 * - Copy link buttons
 * - Sharing current view
 * - Generating shareable URLs
 *
 * @returns Object with serialization functions
 *
 * @example
 * const { serializeToQueryString, serializeToFullUrl } = useSerializeStateToUrl()
 *
 * // For copy link
 * copy(serializeToFullUrl())
 *
 * // For manual URL construction
 * const queryString = serializeToQueryString()
 */
export function useSerializeStateToUrl(): {
  serializeToQueryString: () => string
  serializeToFullUrl: () => string
} {
  const columns = useDatatableColumns()

  // FIX: Destructure state to primitive values to prevent infinite re-renders
  const { globalFilter, columnFilters, sorting, filterMode, grouping } = useDatatableStore(
    useShallow((s) => ({
      globalFilter: s.globalFilter,
      columnFilters: s.columnFilters,
      sorting: s.sorting,
      filterMode: s.filterMode,
      grouping: s.grouping,
    })),
  )

  // Build parser config (same as useDatatableUrl)
  const parserConfig = useMemo(() => {
    const config: Record<string, SerializerConfig> = {
      q: globalFilterParser,
      s: sortingParser,
      fm: filterModeParser,
      g: groupingParser,
    }

    // Add column filter parsers
    for (const column of columns) {
      const isFilteringEnabled = column.enableFiltering ?? column.filterType !== undefined
      if (!isFilteringEnabled || !column.filterType) {
        continue
      }

      const key = `f.${column.id}`

      switch (column.filterType) {
        case "text":
          config[key] = textFilterParser
          break
        case "number":
          config[key] = numberFilterParser
          break
        case "date":
          config[key] = dateFilterParser
          break
        case "text-list":
          config[key] = textListFilterParser
          break
        case "boolean":
          config[key] = booleanFilterParser
          break
        case "id-list":
          config[key] = idListFilterParser
          break
      }
    }

    return config
  }, [columns])

  // Serialize current state to query string format
  // Note: useShallow (line 52) prevents infinite re-renders by destructuring to primitives
  const serializeToQueryString = useCallback(() => {
    const params = new URLSearchParams(window.location.search)
    removeDatatableParams(params, parserConfig)

    // Global filter
    if (globalFilter) {
      params.set("q", globalFilterParser.serialize(globalFilter))
    }

    // Column filters
    for (const filter of columnFilters) {
      const key = `f.${filter.id}`
      const parser = parserConfig[key]
      if (parser) {
        params.set(key, parser.serialize(filter.payload))
      }
    }

    // Sorting
    if (sorting.length > 0) {
      params.set("s", sortingParser.serialize(sorting))
    }

    // Filter mode (only if OR)
    if (filterMode === "OR") {
      params.set("fm", filterModeParser.serialize(filterMode))
    }

    // Grouping
    if (grouping.length > 0) {
      params.set("g", groupingParser.serialize(grouping))
    }

    const queryString = params.toString()
    return queryString ? `?${queryString}` : ""
  }, [globalFilter, columnFilters, sorting, filterMode, grouping, parserConfig])

  // Build full URL with origin + pathname + query string
  // Separated from serializeToQueryString for better testability (avoids window.location in tests)
  const serializeToFullUrl = useCallback(() => {
    const queryString = serializeToQueryString()
    return `${window.location.origin}${window.location.pathname}${queryString}`
  }, [serializeToQueryString])

  return { serializeToQueryString, serializeToFullUrl }
}
