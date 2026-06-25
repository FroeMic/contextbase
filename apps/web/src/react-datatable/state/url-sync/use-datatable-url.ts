/**
 * Datatable URL State Synchronization Hook
 *
 * Synchronizes datatable state with URL parameters using browser history APIs.
 *
 * Architecture (Two-Phase):
 * - Phase 1 (Initial Load): Returns StateSource for coordinator - parses URL params once
 * - Phase 2 (Continuous Sync): After initialization, bidirectionally syncs store ↔ URL
 *
 * This separation ensures:
 * - URL state has highest priority (applied last by coordinator)
 * - No race conditions during initialization
 * - Clean separation between initial load and continuous sync
 *
 * What gets synced to URL:
 * - globalFilter (q)
 * - columnFilters (f.columnId)
 * - sorting (s)
 * - filterMode (fm)
 * - grouping (g)
 *
 * What doesn't get synced (user preferences, stored in persistence):
 * - columnVisibility, columnWidths, columnOrder, stickyColumnsCount, activeViewId
 *
 * Usage:
 * ```tsx
 * // Phase 1: Get initial URL state
 * const { urlStateSource, enableContinuousSync } = useDatatableUrl(store, {
 *   columns,
 *   enabled: true,
 *   acceptUrlParams: true,
 * })
 *
 * // Use urlStateSource in coordinator...
 *
 * // Phase 2: Enable continuous sync after initialization
 * useEffect(() => {
 *   if (isReady) {
 *     enableContinuousSync(true)
 *   }
 * }, [isReady])
 * ```
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { StoreApi, UseBoundStore } from "zustand"
import type { DatatableColumn } from "../../types/column.types"
import type {
  BooleanFilterPayload,
  CustomFilterPayload,
  DateFilterPayload,
  FilterPayload,
  FilterType,
  IdListFilterPayload,
  NumberFilterPayload,
  TextFilterPayload,
  TextListFilterPayload,
} from "../../types/filter.types"
import type { DatatableState } from "../../types/state.types"
import type { StateSource } from "../lifecycle/use-table-state-coordinator"
import type { DatatableStore } from "../store/store.types"
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
 */
interface ParserConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parse: (value: string) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serialize: (value: any) => string
}

/**
 * Options for URL state synchronization
 */
export interface UseDatatableUrlOptions<TData> {
  /**
   * Column definitions (needed to determine filter types)
   */
  columns: DatatableColumn<TData>[]

  /**
   * Enable writing state changes to URL (Store → URL sync)
   * When enabled, table state is automatically written to URL as users interact
   * @default false
   */
  enabled?: boolean

  /**
   * Enable reading initial state from URL (URL → Store sync on mount)
   * When true, allows shareable links to work even when automatic URL updates are disabled
   * When false, URL parameters are completely ignored
   *
   * Special behavior: When acceptUrlParams=true AND enabled=false, URL params are automatically
   * cleared after initial load to prevent URL pollution (shareable link mode)
   *
   * @default true
   */
  acceptUrlParams?: boolean

  /**
   * History mode for URL updates
   * - "push": Creates new history entries (enables back/forward navigation)
   * - "replace": Updates current entry without creating history
   * @default "push"
   */
  historyMode?: "push" | "replace"

  /**
   * Callback invoked when URL state is updated
   * Called on every store → URL sync (when enabled=true), but NOT on initial URL → store load
   * @param state The serialized state object being written to URL
   */
  onUrlChange?: (state: Record<string, unknown>) => void
}

/**
 * Return type for useDatatableUrl hook
 */
export interface UseDatatableUrlResult {
  /**
   * State source for coordinator (initial URL state)
   */
  urlStateSource: StateSource<Partial<DatatableState>>

  /**
   * Enable/disable continuous sync after initialization
   * Call with true once coordinator has initialized the store
   */
  enableContinuousSync: (enabled: boolean) => void
}

/**
 * Type-safe helper to convert URL filter values to typed FilterPayload
 */
function parseFilterPayload(filterType: FilterType, filterValue: unknown): FilterPayload | null {
  if (!filterValue) {
    return null
  }

  // Type guards ensure we only cast when types match
  switch (filterType) {
    case "text":
      return filterValue as TextFilterPayload
    case "number":
      return filterValue as NumberFilterPayload
    case "date":
      return filterValue as DateFilterPayload
    case "text-list":
      return filterValue as TextListFilterPayload
    case "boolean":
      return filterValue as BooleanFilterPayload
    case "id-list":
      return filterValue as IdListFilterPayload
    case "custom":
      return filterValue as CustomFilterPayload
    default:
      console.warn(`[URL Sync] Unknown filter type: ${filterType}`)
      return null
  }
}

/**
 * Hook to synchronize datatable state with URL parameters.
 *
 * Two-phase architecture:
 * 1. Initial load: Parses URL params and returns StateSource for coordinator
 * 2. Continuous sync: After initialization, bidirectionally syncs store ↔ URL
 */
export function useDatatableUrl<TData>(
  store: UseBoundStore<StoreApi<DatatableStore>>,
  options: UseDatatableUrlOptions<TData>,
): UseDatatableUrlResult {
  const {
    columns,
    enabled = false,
    acceptUrlParams = true,
    historyMode = "push",
    onUrlChange,
  } = options

  // Build dynamic parser config based on column filter types
  const parserConfig = useMemo(() => {
    const config: Record<string, ParserConfig> = {
      // Fixed params
      q: globalFilterParser,
      s: sortingParser,
      fm: filterModeParser,
      g: groupingParser,
    }

    // Add column filter parsers (f.columnId)
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

  const setUrlState = useCallback(
    (nextUrlState: Record<string, unknown>) => {
      writeUrlState(nextUrlState, parserConfig, historyMode)
    },
    [historyMode, parserConfig],
  )

  // Phase 1: Parse initial URL state for coordinator
  const [initialUrlState, setInitialUrlState] = useState<Partial<DatatableState> | null>(null)
  const [isLoadingInitialState, setIsLoadingInitialState] = useState(true)
  const hasLoadedInitialState = useRef(false)

  useEffect(() => {
    if (hasLoadedInitialState.current) {
      return
    }

    hasLoadedInitialState.current = true

    if (!acceptUrlParams) {
      setInitialUrlState(null)
      setIsLoadingInitialState(false)
      return
    }

    // Parse URL state
    const urlState = readUrlState(parserConfig)
    const parsedState = parseUrlStateFromParams(urlState, columns)
    setInitialUrlState(parsedState)
    setIsLoadingInitialState(false)

    // Clear URL params after initial load if shareable link mode (enabled=false, acceptUrlParams=true)
    if (!enabled && acceptUrlParams) {
      clearUrlParams(columns, setUrlState)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount

  // Return state source for coordinator
  const urlStateSource: StateSource<Partial<DatatableState>> = {
    isLoading: isLoadingInitialState,
    data: initialUrlState,
    error: null,
  }

  // Phase 2: Continuous sync (store ↔ URL)
  const [continuousSyncEnabled, setContinuousSyncEnabled] = useState(false)
  const isSyncingFromUrlRef = useRef(false)

  // Store → URL sync (when continuous sync is enabled)
  useEffect(() => {
    if (!continuousSyncEnabled || !enabled) {
      return
    }

    const unsubscribe = store.subscribe((state) => {
      // Skip if we're currently syncing from URL to avoid infinite loop
      if (isSyncingFromUrlRef.current) {
        return
      }

      // Build URL state from Zustand store
      const newUrlState: Record<string, unknown> = {}

      // Global filter
      newUrlState.q = state.globalFilter || null

      // Column filters (f.columnId)
      for (const filter of state.columnFilters) {
        newUrlState[`f.${filter.id}`] = filter.payload
      }

      // Clear filters that are no longer active
      for (const column of columns) {
        if (!column.enableFiltering) {
          continue
        }
        const hasFilter = state.columnFilters.some((f) => f.id === column.id)
        if (!hasFilter) {
          newUrlState[`f.${column.id}`] = null
        }
      }

      // Sorting
      newUrlState.s = state.sorting.length > 0 ? state.sorting : null

      // Filter mode (only include if OR, default is AND)
      newUrlState.fm = state.filterMode === "OR" ? "OR" : null

      // Grouping
      newUrlState.g = state.grouping.length > 0 ? state.grouping : null

      // Update URL
      setUrlState(newUrlState)

      // Callback
      onUrlChange?.(newUrlState)
    })

    return unsubscribe
  }, [continuousSyncEnabled, enabled, store, columns, setUrlState, onUrlChange])

  // URL → Store sync (browser back/forward navigation)
  useEffect(() => {
    if (!continuousSyncEnabled || !acceptUrlParams) {
      return
    }

    let popStateSyncTimeout: number | null = null

    const handlePopState = () => {
      popStateSyncTimeout = window.setTimeout(() => {
        isSyncingFromUrlRef.current = true

        try {
          const parsedState = parseUrlStateFromParams(readUrlState(parserConfig), columns)
          store.setState(parsedState)
        } finally {
          isSyncingFromUrlRef.current = false
          popStateSyncTimeout = null
        }
      }, 0)
    }

    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("popstate", handlePopState)
      if (popStateSyncTimeout) {
        window.clearTimeout(popStateSyncTimeout)
      }
    }
  }, [continuousSyncEnabled, acceptUrlParams, parserConfig, columns, store])

  return {
    urlStateSource,
    enableContinuousSync: setContinuousSyncEnabled,
  }
}

/**
 * Parse URL params into partial DatatableState
 */
function parseUrlStateFromParams<TData>(
  urlState: Record<string, unknown>,
  columns: DatatableColumn<TData>[],
): Partial<DatatableState> {
  const stateFromUrl: Partial<DatatableState> = {}

  // Global filter
  if (urlState.q && typeof urlState.q === "string") {
    stateFromUrl.globalFilter = urlState.q
  }

  // Column filters
  const columnFilters: DatatableStore["columnFilters"] = []
  for (const column of columns) {
    const isFilteringEnabled = column.enableFiltering ?? column.filterType !== undefined
    if (!isFilteringEnabled || !column.filterType) {
      continue
    }

    const key = `f.${column.id}` as keyof typeof urlState
    const filterValue = urlState[key]

    if (filterValue) {
      const payload = parseFilterPayload(column.filterType, filterValue)
      if (payload) {
        columnFilters.push({
          id: column.id,
          type: column.filterType,
          payload,
        })
      }
    }
  }
  if (columnFilters.length > 0) {
    stateFromUrl.columnFilters = columnFilters
  }

  // Sorting
  if (urlState.s && Array.isArray(urlState.s) && urlState.s.length > 0) {
    stateFromUrl.sorting = urlState.s as DatatableStore["sorting"]
  }

  // Filter mode
  if (urlState.fm) {
    stateFromUrl.filterMode = urlState.fm as DatatableStore["filterMode"]
  }

  // Grouping
  if (urlState.g && Array.isArray(urlState.g) && urlState.g.length > 0) {
    stateFromUrl.grouping = urlState.g as DatatableStore["grouping"]
  }

  return stateFromUrl
}

/**
 * Clear all URL params
 */
function clearUrlParams<TData>(
  columns: DatatableColumn<TData>[],
  setUrlState: (state: Record<string, null>) => void,
): void {
  const clearParams: Record<string, null> = {
    q: null,
    s: null,
    fm: null,
    g: null,
  }

  // Clear all column filter params
  for (const column of columns) {
    const isFilteringEnabled = column.enableFiltering ?? column.filterType !== undefined
    if (isFilteringEnabled && column.filterType) {
      clearParams[`f.${column.id}`] = null
    }
  }

  setUrlState(clearParams)
}

function readUrlState(parserConfig: Record<string, ParserConfig>): Record<string, unknown> {
  if (typeof window === "undefined") {
    return {}
  }

  const params = new URLSearchParams(window.location.search)
  const urlState: Record<string, unknown> = {}

  for (const [key, parser] of Object.entries(parserConfig)) {
    const value = params.get(key)
    if (value === null) {
      continue
    }

    urlState[key] = parser.parse(value)
  }

  return urlState
}

function writeUrlState(
  nextUrlState: Record<string, unknown>,
  parserConfig: Record<string, ParserConfig>,
  historyMode: "push" | "replace",
): void {
  if (typeof window === "undefined") {
    return
  }

  const params = new URLSearchParams(window.location.search)

  for (const [key, value] of Object.entries(nextUrlState)) {
    if (value === null || value === undefined || value === "") {
      params.delete(key)
      continue
    }

    const parser = parserConfig[key]
    if (!parser) {
      continue
    }

    params.set(key, parser.serialize(value))
  }

  const queryString = params.toString()
  const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ""}${window.location.hash}`
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`

  if (nextUrl === currentUrl) {
    return
  }

  const method = historyMode === "replace" ? "replaceState" : "pushState"
  window.history[method](null, "", nextUrl)
}
