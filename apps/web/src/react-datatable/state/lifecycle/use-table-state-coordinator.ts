/**
 * Table State Coordinator Hook
 *
 * Orchestrates initialization from multiple state sources with deterministic priority.
 * This is the "brain" of the state management system.
 *
 * Architecture:
 * 1. Waits for all enabled sources to finish loading
 * 2. Merges states using pure priority function
 * 3. Initializes store atomically (single setState call)
 * 4. Returns initialization status
 *
 * Priority (lowest to highest):
 * 1. Base default state
 * 2. initialState prop
 * 3. Workspace default view
 * 4. User default view
 * 5. Persisted state (includes activeViewId if user explicitly selected a view)
 * 6. URL state (highest priority - enables shareable links)
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { StoreApi, UseBoundStore } from "zustand"
import { type DatatableState, defaultDatatableState } from "../../types/state.types"
import type { PersistedTableState } from "../persistence/table-state-adapter.types"
import type { DatatableView } from "../saved-views/datatable-view-adapter.types"
import type { DatatableStore } from "../store/store.types"
import { mergeStateWithPriority } from "./merge-state-with-priority"

/**
 * Generic state source interface
 * All sources (persisted state, saved views, URL state) must conform to this
 */
export interface StateSource<T> {
  isLoading: boolean
  data: T | null
  error: Error | null
}

/**
 * Saved views source data structure
 */
export interface DatatableViewsSourceData {
  userDefault?: DatatableView
  workspaceDefault?: DatatableView
  linkedView?: DatatableView | null
}

/**
 * Configuration for state coordinator
 */
export interface StateCoordinatorConfig {
  /**
   * Persisted state source (optional - localStorage/tRPC)
   */
  persistedState?: StateSource<PersistedTableState>

  /**
   * Datatable views source (optional - default user/workspace views)
   */
  datatableViews?: StateSource<DatatableViewsSourceData>

  /**
   * URL state source (optional - shareable links)
   */
  urlState?: StateSource<Partial<DatatableState>>

  /**
   * Base initial state from props
   */
  initialState?: Partial<DatatableState>

  /**
   * Zustand store instance to initialize
   */
  store: UseBoundStore<StoreApi<DatatableStore>>

  /**
   * Called once after initial linked-view coordination has been committed.
   */
  onLinkedViewConsumed?: () => void
}

/**
 * Coordinator return value
 */
export interface StateCoordinatorResult {
  /**
   * True while sources are loading (shows loading spinner)
   */
  isInitializing: boolean

  /**
   * True once store has been initialized (enables continuous sync)
   */
  isReady: boolean

  /**
   * First error encountered from any source (if any)
   */
  error: Error | null
}

/**
 * Hook to coordinate table state initialization from multiple sources
 *
 * @example
 * ```tsx
 * const { isInitializing, isReady, error } = useTableStateCoordinator({
 *   persistedState: persistedStateSource,
 *   savedViews: datatableViewsSource,
 *   urlState: urlStateSource,
 *   initialState: props.initialState,
 *   store,
 * })
 *
 * if (isInitializing) return <LoadingSpinner />
 * if (error) return <ErrorMessage error={error} />
 * // Store is now initialized, render table
 * ```
 */
export function useTableStateCoordinator(config: StateCoordinatorConfig): StateCoordinatorResult {
  const [isReady, setIsReady] = useState(false)
  const hasInitialized = useRef(false)

  // Compute aggregate loading state from all enabled sources
  const isLoading = useMemo(() => {
    const sources = [config.persistedState, config.datatableViews, config.urlState].filter(
      Boolean,
    ) as StateSource<unknown>[]

    // If no sources configured, nothing to load
    if (sources.length === 0) {
      return false
    }

    // Loading if any source is still loading
    return sources.some((source) => source.isLoading)
  }, [config.persistedState, config.datatableViews, config.urlState])

  // Collect first error from any source
  const error = useMemo(() => {
    const sources = [config.persistedState, config.datatableViews, config.urlState].filter(
      Boolean,
    ) as StateSource<unknown>[]

    const errorSource = sources.find((source) => source.error)
    return errorSource?.error ?? null
  }, [config.persistedState, config.datatableViews, config.urlState])

  // Initialize store once when all sources are ready
  useEffect(() => {
    // Only run once
    if (hasInitialized.current) {
      return
    }

    // Wait for all sources to finish loading
    if (isLoading) {
      return
    }

    hasInitialized.current = true

    // Merge states with priority order (pure function)
    const finalState = mergeStateWithPriority({
      base: defaultDatatableState,
      initialState: config.initialState,
      workspaceDefaultView: config.datatableViews?.data?.workspaceDefault,
      userDefaultView: config.datatableViews?.data?.userDefault,
      persistedState: config.persistedState?.data,
      linkedView: config.datatableViews?.data?.linkedView,
      urlState: config.urlState?.data,
    })

    // Apply atomically (single store mutation)
    config.store.setState(finalState)
    config.onLinkedViewConsumed?.()
    setIsReady(true)
  }, [isLoading, config])

  return {
    isInitializing: isLoading,
    isReady,
    error,
  }
}
