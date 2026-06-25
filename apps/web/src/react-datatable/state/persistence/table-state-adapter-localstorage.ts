/**
 * LocalStorage Table State Adapter
 *
 * Stores table preferences in browser localStorage.
 * Useful for:
 * - Development and testing
 * - Offline-first applications
 * - Tables that don't need server-side persistence
 *
 * Storage format:
 * Key: `datatable:${workspaceId}:${tableKey}:${userId}`
 * Value: JSON-serialized PersistedTableState snapshot
 *
 * Note: This adapter will be replaced with tRPC adapter in production
 */

import type {
  PersistedTableStateSnapshot,
  TableStateAdapter,
  TableStateAdapterConfig,
} from "./table-state-adapter.types"

/**
 * Build localStorage key from config
 */
function buildStorageKey(config: TableStateAdapterConfig): string {
  const { workspaceId = "default", tableKey, userId = "default" } = config

  // Format: datatable:workspaceId:tableKey:userId
  return `datatable:${workspaceId}:${tableKey}:${userId}`
}

function isPersistedTableStateSnapshot(value: unknown): value is PersistedTableStateSnapshot {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const snapshot = value as Partial<PersistedTableStateSnapshot>
  const query = snapshot.query
  const presentation = snapshot.presentation

  if (
    snapshot.version !== 1 ||
    typeof query !== "object" ||
    query === null ||
    typeof presentation !== "object" ||
    presentation === null
  ) {
    return false
  }

  const grouping = query.grouping
  const hasValidGrouping =
    grouping === null ||
    (typeof grouping === "object" &&
      grouping !== null &&
      Array.isArray(grouping.columns) &&
      typeof grouping.showEmptyGroups === "boolean" &&
      typeof grouping.expansion === "object" &&
      grouping.expansion !== null &&
      typeof grouping.expansion.defaultExpanded === "boolean" &&
      isBooleanRecord(grouping.expansion.overrides))

  return (
    Array.isArray(query.filters) &&
    Array.isArray(query.sorting) &&
    typeof query.globalFilter === "string" &&
    (query.filterMode === "AND" || query.filterMode === "OR") &&
    (query.options === undefined || isQueryOptionsRecord(query.options)) &&
    hasValidGrouping &&
    typeof presentation.showColumnHeaders === "boolean" &&
    typeof presentation.stickyColumnsCount === "number" &&
    typeof presentation.showHorizontalLines === "boolean" &&
    typeof presentation.showVerticalLines === "boolean" &&
    typeof presentation.showOrderingBadge === "boolean" &&
    Array.isArray(presentation.columnOrder) &&
    isBooleanRecord(presentation.columnVisibility) &&
    isNumberRecord(presentation.columnWidths) &&
    (typeof presentation.activeViewId === "string" || presentation.activeViewId === null)
  )
}

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "boolean")
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "number")
}

function isQueryOptionsRecord(
  value: unknown,
): value is Record<string, boolean | string | number | null> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (item) =>
        typeof item === "boolean" ||
        typeof item === "string" ||
        typeof item === "number" ||
        item === null,
    )
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * LocalStorage adapter implementation
 */
export const localStorageAdapter: TableStateAdapter = {
  async get(config: TableStateAdapterConfig): Promise<PersistedTableStateSnapshot | null> {
    try {
      const key = buildStorageKey(config)
      const stored = localStorage.getItem(key)

      if (!stored) {
        return null
      }

      const parsed = JSON.parse(stored) as PersistedTableStateSnapshot

      if (!isPersistedTableStateSnapshot(parsed)) {
        localStorage.removeItem(key)
        return null
      }

      return parsed
    } catch (error) {
      console.error("[LocalStorageAdapter] Failed to get state:", error)
      return null
    }
  },

  async set(config: TableStateAdapterConfig, state: PersistedTableStateSnapshot): Promise<void> {
    try {
      const key = buildStorageKey(config)
      const serialized = JSON.stringify(state)

      localStorage.setItem(key, serialized)
    } catch (error) {
      console.error("[LocalStorageAdapter] Failed to save state:", error)
      throw error
    }
  },

  async delete(config: TableStateAdapterConfig): Promise<void> {
    try {
      const key = buildStorageKey(config)
      localStorage.removeItem(key)
    } catch (error) {
      console.error("[LocalStorageAdapter] Failed to delete state:", error)
      throw error
    }
  },
}

/**
 * SessionStorage adapter (alternative for session-only persistence)
 *
 * Use this if you want preferences to reset on browser close
 */
export const sessionStorageAdapter: TableStateAdapter = {
  async get(config: TableStateAdapterConfig): Promise<PersistedTableStateSnapshot | null> {
    try {
      const key = buildStorageKey(config)
      const stored = sessionStorage.getItem(key)

      if (!stored) {
        return null
      }

      const parsed = JSON.parse(stored) as PersistedTableStateSnapshot

      if (!isPersistedTableStateSnapshot(parsed)) {
        sessionStorage.removeItem(key)
        return null
      }

      return parsed
    } catch (error) {
      console.error("[SessionStorageAdapter] Failed to get state:", error)
      return null
    }
  },

  async set(config: TableStateAdapterConfig, state: PersistedTableStateSnapshot): Promise<void> {
    try {
      const key = buildStorageKey(config)
      const serialized = JSON.stringify(state)

      sessionStorage.setItem(key, serialized)
    } catch (error) {
      console.error("[SessionStorageAdapter] Failed to save state:", error)
      throw error
    }
  },

  async delete(config: TableStateAdapterConfig): Promise<void> {
    try {
      const key = buildStorageKey(config)
      sessionStorage.removeItem(key)
    } catch (error) {
      console.error("[SessionStorageAdapter] Failed to delete state:", error)
      throw error
    }
  },
}
