/**
 * LocalStorage Datatable Views Adapter
 *
 * Stores datatable views in browser localStorage.
 * Useful for:
 * - Development and testing
 * - Offline-first applications
 * - Tables that don't need server-side persistence
 *
 * Storage format:
 * Key: `datatableViews:${workspaceId}:${tableKey}:${userId}`
 * Value: JSON-serialized DatatableView[]
 *
 * Limitations:
 * - No sharing support (private views only)
 * - No workspace defaults
 * - User defaults stored locally only
 *
 * Note: This adapter will be replaced with tRPC adapter in production for sharing
 */

import type {
  DatatableView,
  DatatableViewAdapter,
  DatatableViewAdapterConfig,
  DatatableViewState,
} from "./datatable-view-adapter.types"

/**
 * Build localStorage key from config
 */
function buildStorageKey(config: DatatableViewAdapterConfig): string {
  const { workspaceId = "default", tableKey, userId = "default" } = config

  // Format: datatableViews:workspaceId:tableKey:userId
  return `datatableViews:${workspaceId}:${tableKey}:${userId}`
}

function isDatatableViewState(value: unknown): value is DatatableViewState {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const snapshot = value as Partial<DatatableViewState>
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isDatatableView(value: unknown): value is DatatableView {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const candidate = value as Partial<DatatableView>
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    isDatatableViewState(candidate.state)
  )
}

/**
 * Get all views from localStorage
 */
function getStoredViews(config: DatatableViewAdapterConfig): DatatableView[] {
  try {
    const key = buildStorageKey(config)
    const stored = localStorage.getItem(key)

    if (!stored) {
      return []
    }

    const parsed = JSON.parse(stored) as DatatableView[]

    // Validate structure
    if (!Array.isArray(parsed)) {
      console.warn("[LocalStorageViewAdapter] Invalid stored views, returning empty array")
      localStorage.removeItem(key)
      return []
    }

    if (!parsed.every(isDatatableView)) {
      localStorage.removeItem(key)
      return []
    }

    // Parse date strings back to Date objects.
    return parsed.map((view) => ({
      ...view,
      createdAt: new Date(view.createdAt),
      updatedAt: new Date(view.updatedAt),
    }))
  } catch (error) {
    console.error("[LocalStorageViewAdapter] Failed to get views:", error)
    return []
  }
}

/**
 * Save views to localStorage
 */
function saveViews(config: DatatableViewAdapterConfig, views: DatatableView[]): void {
  try {
    const key = buildStorageKey(config)
    const serialized = JSON.stringify(views)
    localStorage.setItem(key, serialized)
  } catch (error) {
    console.error("[LocalStorageViewAdapter] Failed to save views:", error)
    throw error
  }
}

/**
 * Generate unique ID for new views
 */
function generateId(): string {
  return `view_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * LocalStorage adapter implementation
 *
 * Supports:
 * - ✅ CRUD operations for private views
 * - ✅ User default views
 * - ❌ Sharing (not supported)
 * - ❌ Workspace defaults (not supported)
 */
export const localStorageDatatableViewAdapter: DatatableViewAdapter = {
  async list(config: DatatableViewAdapterConfig): Promise<DatatableView[]> {
    return getStoredViews(config)
  },

  async get(config: DatatableViewAdapterConfig, viewId: string): Promise<DatatableView | null> {
    const views = getStoredViews(config)
    return views.find((v) => v.id === viewId) ?? null
  },

  async create(
    config: DatatableViewAdapterConfig,
    view: Omit<DatatableView, "id" | "createdAt" | "updatedAt">,
  ): Promise<DatatableView> {
    const views = getStoredViews(config)

    // If this view is set as user default, clear other defaults
    if (view.isUserDefault) {
      views.forEach((v) => {
        v.isUserDefault = false
      })
    }

    const now = new Date()
    const newView: DatatableView = {
      ...view,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      // LocalStorage doesn't support sharing
      isShared: false,
      isWorkspaceDefault: false,
    }

    views.push(newView)
    saveViews(config, views)

    return newView
  },

  async update(
    config: DatatableViewAdapterConfig,
    viewId: string,
    updates: Partial<DatatableView>,
  ): Promise<DatatableView> {
    const views = getStoredViews(config)
    const index = views.findIndex((v) => v.id === viewId)

    if (index === -1) {
      throw new Error(`View with ID ${viewId} not found`)
    }

    // If updating to set as user default, clear other defaults
    if (updates.isUserDefault) {
      views.forEach((v) => {
        v.isUserDefault = false
      })
    }

    const updatedView: DatatableView = {
      ...views[index],
      ...updates,
      id: viewId, // Ensure ID doesn't change
      createdAt: views[index].createdAt, // Preserve creation date
      updatedAt: new Date(),
      // LocalStorage doesn't support sharing - prevent updates to these fields
      isShared: false,
      isWorkspaceDefault: false,
    }

    views[index] = updatedView
    saveViews(config, views)

    return updatedView
  },

  async delete(config: DatatableViewAdapterConfig, viewId: string): Promise<void> {
    const views = getStoredViews(config)
    const filteredViews = views.filter((v) => v.id !== viewId)

    if (filteredViews.length === views.length) {
      throw new Error(`View with ID ${viewId} not found`)
    }

    saveViews(config, filteredViews)
  },

  /**
   * Set user default view
   * Clears other user defaults and sets the specified view as default
   */
  async setUserDefault(config: DatatableViewAdapterConfig, viewId: string | null): Promise<void> {
    const views = getStoredViews(config)

    // Clear all user defaults
    views.forEach((v) => {
      v.isUserDefault = false
    })

    // Set new default if viewId is provided
    if (viewId !== null) {
      const view = views.find((v) => v.id === viewId)
      if (!view) {
        throw new Error(`View with ID ${viewId} not found`)
      }
      view.isUserDefault = true
      view.updatedAt = new Date()
    }

    saveViews(config, views)
  },

  // Note: share and setWorkspaceDefault are not implemented
  // LocalStorage adapter only supports private views
}

/**
 * SessionStorage adapter (alternative for session-only persistence)
 *
 * Use this if you want views to reset on browser close.
 * Same functionality as localStorage but uses sessionStorage instead.
 */
export const sessionStorageDatatableViewAdapter: DatatableViewAdapter = {
  async list(config: DatatableViewAdapterConfig): Promise<DatatableView[]> {
    try {
      const key = buildStorageKey(config)
      const stored = sessionStorage.getItem(key)

      if (!stored) {
        return []
      }

      const parsed = JSON.parse(stored) as DatatableView[]

      if (!Array.isArray(parsed)) {
        console.warn("[SessionStorageViewAdapter] Invalid stored views, returning empty array")
        sessionStorage.removeItem(key)
        return []
      }

      if (!parsed.every(isDatatableView)) {
        sessionStorage.removeItem(key)
        return []
      }

      return parsed.map((view) => ({
        ...view,
        createdAt: new Date(view.createdAt),
        updatedAt: new Date(view.updatedAt),
      }))
    } catch (error) {
      console.error("[SessionStorageViewAdapter] Failed to get views:", error)
      return []
    }
  },

  async get(config: DatatableViewAdapterConfig, viewId: string): Promise<DatatableView | null> {
    const views = await sessionStorageDatatableViewAdapter.list(config)
    return views.find((v) => v.id === viewId) ?? null
  },

  async create(
    config: DatatableViewAdapterConfig,
    view: Omit<DatatableView, "id" | "createdAt" | "updatedAt">,
  ): Promise<DatatableView> {
    const views = await sessionStorageDatatableViewAdapter.list(config)

    if (view.isUserDefault) {
      views.forEach((v) => {
        v.isUserDefault = false
      })
    }

    const now = new Date()
    const newView: DatatableView = {
      ...view,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      isShared: false,
      isWorkspaceDefault: false,
    }

    views.push(newView)

    const key = buildStorageKey(config)
    sessionStorage.setItem(key, JSON.stringify(views))

    return newView
  },

  async update(
    config: DatatableViewAdapterConfig,
    viewId: string,
    updates: Partial<DatatableView>,
  ): Promise<DatatableView> {
    const views = await sessionStorageDatatableViewAdapter.list(config)
    const index = views.findIndex((v) => v.id === viewId)

    if (index === -1) {
      throw new Error(`View with ID ${viewId} not found`)
    }

    if (updates.isUserDefault) {
      views.forEach((v) => {
        v.isUserDefault = false
      })
    }

    const updatedView: DatatableView = {
      ...views[index],
      ...updates,
      id: viewId,
      createdAt: views[index].createdAt,
      updatedAt: new Date(),
      isShared: false,
      isWorkspaceDefault: false,
    }

    views[index] = updatedView

    const key = buildStorageKey(config)
    sessionStorage.setItem(key, JSON.stringify(views))

    return updatedView
  },

  async delete(config: DatatableViewAdapterConfig, viewId: string): Promise<void> {
    const views = await sessionStorageDatatableViewAdapter.list(config)
    const filteredViews = views.filter((v) => v.id !== viewId)

    if (filteredViews.length === views.length) {
      throw new Error(`View with ID ${viewId} not found`)
    }

    const key = buildStorageKey(config)
    sessionStorage.setItem(key, JSON.stringify(filteredViews))
  },

  async setUserDefault(config: DatatableViewAdapterConfig, viewId: string | null): Promise<void> {
    const views = await sessionStorageDatatableViewAdapter.list(config)

    views.forEach((v) => {
      v.isUserDefault = false
    })

    if (viewId !== null) {
      const view = views.find((v) => v.id === viewId)
      if (!view) {
        throw new Error(`View with ID ${viewId} not found`)
      }
      view.isUserDefault = true
      view.updatedAt = new Date()
    }

    const key = buildStorageKey(config)
    sessionStorage.setItem(key, JSON.stringify(views))
  },
}
