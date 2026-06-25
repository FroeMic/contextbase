/**
 * Table State Persistence Hook
 *
 * Manages loading and saving table state using a pluggable adapter.
 * Works with localStorage, sessionStorage, tRPC, or any custom adapter.
 *
 * Architecture (Two-Phase):
 * - Phase 1 (Initial Load): Returns StateSource for coordinator - does NOT mutate store
 * - Phase 2 (Auto-save): Separate hook that watches store and saves changes (debounced)
 *
 * This separation ensures:
 * - Clean initialization (coordinator decides when/how to apply state)
 * - No race conditions between loading and saving
 * - Testable in isolation
 *
 * Usage:
 * ```tsx
 * // Phase 1: Get initial persisted state
 * const persistedStateSource = useTableStatePersistence({
 *   adapter: localStorageAdapter,
 *   tableKey: "contacts",
 * })
 *
 * // Phase 2: Enable auto-save after initialization
 * useTableStatePersistenceAutoSave(store, {
 *   adapter: localStorageAdapter,
 *   tableKey: "contacts",
 * }, isReady)
 * ```
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { StoreApi, UseBoundStore } from "zustand"
import {
  buildPersistedTableStateSnapshot,
  replayPersistedTableState,
} from "../lifecycle/table-state-snapshot"
import type { StateSource } from "../lifecycle/use-table-state-coordinator"
import type { DatatableStore } from "../store/store.types"
import {
  extractPersistedState,
  type PersistedTableState,
  type TableStateAdapter,
  type TableStateAdapterConfig,
} from "./table-state-adapter.types"

export interface UseTableStatePersistenceOptions {
  /**
   * Adapter to use for persistence
   * Examples: localStorageAdapter, sessionStorageAdapter, trpcAdapter
   * If not provided, persistence is disabled
   */
  adapter?: TableStateAdapter

  /**
   * Table key (e.g., "contacts", "deals")
   * Used to scope preferences per table
   * If not provided, persistence is disabled
   */
  tableKey?: string

  /**
   * Workspace ID (optional - depends on adapter)
   */
  workspaceId?: string

  /**
   * User ID (optional - depends on adapter)
   */
  userId?: string

  /**
   * Error callback
   */
  onError?: (error: Error) => void
}

/**
 * Phase 1: Hook to load persisted state (returns StateSource for coordinator)
 *
 * Does NOT mutate the store - returns data for coordinator to decide what to do with it.
 * This enables atomic initialization from multiple sources.
 *
 * @returns StateSource with loading state, data, and error
 */
export function useTableStatePersistence(
  options: UseTableStatePersistenceOptions,
): StateSource<PersistedTableState> {
  const { adapter, tableKey, workspaceId, userId, onError } = options

  const [isLoading, setIsLoading] = useState(!adapter || !tableKey ? false : true)
  const [data, setData] = useState<PersistedTableState | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // Early return if persistence is disabled
  const enabled = Boolean(adapter && tableKey)

  // Build adapter config (memoized to prevent dependency changes)
  const adapterConfig: TableStateAdapterConfig = useMemo(
    () => ({
      tableKey: tableKey ?? "",
      workspaceId,
      userId,
    }),
    [tableKey, workspaceId, userId],
  )

  // Load saved state from adapter on mount
  useEffect(() => {
    if (!enabled || !adapter) {
      setIsLoading(false)
      return
    }

    const loadState = async () => {
      try {
        setIsLoading(true)

        const savedState = await adapter.get(adapterConfig)

        if (savedState) {
          setData(replayPersistedTableState(savedState))
        } else {
          setData(null)
        }

        setError(null)
      } catch (err) {
        const error = err as Error
        console.error("[TableStatePersistence] Failed to load state:", error)
        setError(error)
        setData(null)
        onError?.(error)
      } finally {
        setIsLoading(false)
      }
    }

    loadState()
  }, [enabled, adapter, adapterConfig, onError])

  return {
    isLoading,
    data,
    error,
  }
}

/**
 * Options for auto-save hook
 */
export interface UseTableStatePersistenceAutoSaveOptions extends UseTableStatePersistenceOptions {
  /**
   * Debounce delay for auto-save in milliseconds
   * @default 1000ms
   */
  debounceMs?: number

  /**
   * Success callback after save
   */
  onSave?: () => void
}

/**
 * Phase 2: Hook to auto-save table state changes (continuous sync after initialization)
 *
 * Watches store for changes and saves them to adapter with debouncing.
 * Only starts saving once `enabled` is true (after coordinator initializes store).
 *
 * This separation from loading ensures:
 * - No infinite loops during initialization
 * - No race conditions between load and save
 * - Clean separation of concerns
 *
 * @param store - Zustand store instance
 * @param options - Persistence configuration
 * @param enabled - Only start auto-saving when true (after initialization)
 */
export function useTableStatePersistenceAutoSave(
  store: UseBoundStore<StoreApi<DatatableStore>>,
  options: UseTableStatePersistenceAutoSaveOptions,
  enabled: boolean,
): void {
  const { adapter, tableKey, workspaceId, userId, debounceMs = 1000, onError, onSave } = options

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Build adapter config (memoized to prevent dependency changes)
  const adapterConfig: TableStateAdapterConfig = useMemo(
    () => ({
      tableKey: tableKey ?? "",
      workspaceId,
      userId,
    }),
    [tableKey, workspaceId, userId],
  )

  // Early return if persistence is disabled
  const persistenceEnabled = Boolean(adapter && tableKey)

  // Subscribe to store changes and save with debouncing
  useEffect(() => {
    if (!persistenceEnabled || !enabled || !adapter) {
      return
    }

    const unsubscribe = store.subscribe((state) => {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      // Schedule save after debounce delay
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          // Extract only persistable state
          const stateToSave = extractPersistedState(state)

          // Save to adapter
          await adapter.set(adapterConfig, buildPersistedTableStateSnapshot(stateToSave))

          onSave?.()
        } catch (err) {
          const error = err as Error
          console.error("[TableStatePersistence] Failed to save state:", error)
          onError?.(error)
        }
      }, debounceMs)
    })

    return () => {
      unsubscribe()

      // Clear timeout on unmount
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [persistenceEnabled, enabled, adapter, adapterConfig, store, debounceMs, onError, onSave])
}
