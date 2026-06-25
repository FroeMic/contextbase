/**
 * Saved Views Hook
 *
 * Manages saved views CRUD operations and state synchronization.
 * Uses the configured view adapter directly, so saved views do not require an
 * app-level data-fetching provider.
 *
 * Features:
 * - List views (private + shared)
 * - Create, update, delete views
 * - Apply view to table state
 * - Share views (if adapter supports it)
 * - Set user/workspace defaults
 * - Detect when current state differs from active view (dirty state)
 *
 * Usage:
 * ```tsx
 * const { views, createView, applyView, deleteView } = useDatatableViews({
 *   adapter: localStorageDatatableViewAdapter,
 *   tableKey: "contacts",
 *   workspaceId: "wsp_123",
 * })
 * ```
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { deepEqual } from "../../shared/utils/deep-equal"
import { applySavedViewState } from "../lifecycle/merge-state-with-priority"
import { buildDatatableViewState, replaySavedViewState } from "../lifecycle/table-state-snapshot"
import { extractPersistedState } from "../persistence/table-state-adapter.types"
import { useDatatableStore } from "../store/use-datatable-store"
import {
  adapterSupportsDefaults,
  adapterSupportsSharing,
  type DatatableView,
  type DatatableViewAdapter,
  type DatatableViewAdapterConfig,
} from "./datatable-view-adapter.types"

export interface UseDatatableViewsOptions {
  /**
   * Adapter to use for persistence
   * If not provided, saved views are disabled
   */
  adapter?: DatatableViewAdapter

  /**
   * Table key (e.g., "contacts", "deals")
   * Used to scope views per table
   */
  tableKey?: string

  /**
   * Workspace ID (optional - depends on adapter)
   */
  workspaceId?: string

  /**
   * User ID (optional - inferred from context in most cases)
   */
  userId?: string

  /**
   * Code-defined views owned by the table. These are merged into the view list
   * but are never persisted through the adapter.
   */
  fixedViews?: DatatableView[]

  /**
   * Error callback
   */
  onError?: (error: Error) => void

  /**
   * Success callback after mutations
   */
  onSuccess?: () => void
}

const EMPTY_DATATABLE_FIXED_VIEWS: DatatableView[] = []

export function defaultDatatableFixedViews(): DatatableView[] {
  return EMPTY_DATATABLE_FIXED_VIEWS
}

export function isReadonlyDatatableView(view: DatatableView | null | undefined): boolean {
  return view?.readonly === true || view?.source === "fixed"
}

export function assertMutableDatatableView(
  view: DatatableView | null | undefined,
  operation: string,
): asserts view is DatatableView {
  if (!view) {
    throw new Error(`Cannot ${operation} unknown datatable view`)
  }

  if (isReadonlyDatatableView(view)) {
    throw new Error(`Cannot ${operation} readonly datatable view ${view.id}`)
  }
}

export function mergeDatatableFixedViews(
  adapterViews: DatatableView[],
  fixedViews: DatatableView[] = [],
): DatatableView[] {
  const normalizedFixedViews = fixedViews.map((view) => ({
    ...view,
    createdBy: "system",
    isShared: true,
    isUserDefault: false,
    isWorkspaceDefault: false,
    readonly: true,
    source: "fixed" as const,
  }))
  const fixedViewIds = new Set(normalizedFixedViews.map((view) => view.id))
  const nonCollidingAdapterViews = adapterViews.filter((view) => !fixedViewIds.has(view.id))

  return [...normalizedFixedViews, ...nonCollidingAdapterViews]
}

export function viewsAfterDatatableAdapterLoadError(
  fixedViews: DatatableView[] = [],
): DatatableView[] {
  return mergeDatatableFixedViews([], fixedViews)
}

export function resolveLinkedDatatableView(
  views: DatatableView[],
  slug: string | null | undefined,
): DatatableView | null {
  if (!slug) {
    return null
  }

  return (
    views.find(
      (view) => isReadonlyDatatableView(view) && view.source === "fixed" && view.slug === slug,
    ) ?? null
  )
}

export function useDatatableViews(options: UseDatatableViewsOptions) {
  const {
    adapter,
    tableKey,
    workspaceId,
    userId,
    fixedViews = defaultDatatableFixedViews(),
    onError,
    onSuccess,
  } = options

  // Get store actions
  const setState = useDatatableStore((s) => s.setState)
  const setActiveViewId = useDatatableStore((s) => s.setActiveViewId)
  const currentState = useDatatableStore((s) => s)

  const enabled = Boolean(adapter && tableKey)
  const [views, setViews] = useState<DatatableView[]>([])
  const [isLoading, setIsLoading] = useState(enabled)
  const [error, setError] = useState<Error | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  // Build adapter config
  const adapterConfig: DatatableViewAdapterConfig = useMemo(
    () => ({
      tableKey: tableKey ?? "",
      workspaceId,
      userId,
    }),
    [tableKey, workspaceId, userId],
  )

  const loadViews = useCallback(async () => {
    if (!enabled || !adapter) {
      setViews(mergeDatatableFixedViews([], fixedViews))
      setIsLoading(false)
      setError(null)
      return []
    }

    try {
      setIsLoading(true)
      const adapterViews = await adapter.list(adapterConfig)
      const nextViews = mergeDatatableFixedViews(adapterViews, fixedViews)
      setViews(nextViews)
      setError(null)
      return nextViews
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error(String(err))
      const fallbackViews = viewsAfterDatatableAdapterLoadError(fixedViews)
      console.error("[DatatableViews] Failed to list views:", nextError)
      setViews(fallbackViews)
      setError(fallbackViews.length > 0 ? null : nextError)
      onError?.(nextError)
      return fallbackViews
    } finally {
      setIsLoading(false)
    }
  }, [adapter, adapterConfig, enabled, fixedViews, onError])

  useEffect(() => {
    void loadViews()
  }, [loadViews])

  const runMutation = useCallback(
    async <TResult>(
      label: string,
      setPending: (pending: boolean) => void,
      operation: () => Promise<TResult>,
    ): Promise<TResult> => {
      if (!adapter) {
        throw new Error("Adapter not configured")
      }

      try {
        setPending(true)
        const result = await operation()
        await loadViews()
        onSuccess?.()
        return result
      } catch (err) {
        const nextError = err instanceof Error ? err : new Error(String(err))
        console.error(`[DatatableViews] Failed to ${label}:`, nextError)
        setError(nextError)
        onError?.(nextError)
        throw nextError
      } finally {
        setPending(false)
      }
    },
    [adapter, loadViews, onError, onSuccess],
  )

  const createViewAsync = useCallback(
    (view: Omit<DatatableView, "id" | "createdAt" | "updatedAt">) =>
      runMutation("create view", setIsCreating, () => {
        if (!adapter) {
          throw new Error("Adapter not configured")
        }
        return adapter.create(adapterConfig, view)
      }),
    [adapter, adapterConfig, runMutation],
  )

  const updateViewAsync = useCallback(
    ({ viewId, updates }: { viewId: string; updates: Partial<DatatableView> }) =>
      runMutation("update view", setIsUpdating, () => {
        if (!adapter) {
          throw new Error("Adapter not configured")
        }
        assertMutableDatatableView(
          views.find((view) => view.id === viewId),
          "update",
        )
        return adapter.update(adapterConfig, viewId, updates)
      }),
    [adapter, adapterConfig, runMutation, views],
  )

  const deleteViewAsync = useCallback(
    (viewId: string) =>
      runMutation("delete view", setIsDeleting, async () => {
        if (!adapter) {
          throw new Error("Adapter not configured")
        }
        assertMutableDatatableView(
          views.find((view) => view.id === viewId),
          "delete",
        )
        await adapter.delete(adapterConfig, viewId)
      }),
    [adapter, adapterConfig, runMutation, views],
  )

  const shareViewAsync = useCallback(
    (viewId: string) =>
      runMutation("share view", setIsSharing, () => {
        if (!adapter || !adapterSupportsSharing(adapter)) {
          throw new Error("Adapter does not support sharing")
        }
        assertMutableDatatableView(
          views.find((view) => view.id === viewId),
          "share",
        )
        return adapter.share(adapterConfig, viewId)
      }),
    [adapter, adapterConfig, runMutation, views],
  )

  const setUserDefaultAsync = useCallback(
    (viewId: string | null) =>
      runMutation("set user default", setIsUpdating, async () => {
        if (!adapter || !adapterSupportsDefaults(adapter)) {
          throw new Error("Adapter does not support default management")
        }
        if (viewId) {
          assertMutableDatatableView(
            views.find((view) => view.id === viewId),
            "set default on",
          )
        }
        await adapter.setUserDefault(adapterConfig, viewId)
      }),
    [adapter, adapterConfig, runMutation, views],
  )

  const setWorkspaceDefaultAsync = useCallback(
    (viewId: string | null) =>
      runMutation("set workspace default", setIsUpdating, async () => {
        if (!adapter || !adapterSupportsSharing(adapter)) {
          throw new Error("Adapter does not support workspace defaults")
        }
        if (viewId) {
          assertMutableDatatableView(
            views.find((view) => view.id === viewId),
            "set workspace default on",
          )
        }
        await adapter.setWorkspaceDefault(adapterConfig, viewId)
      }),
    [adapter, adapterConfig, runMutation, views],
  )

  // Get default views
  const defaultViews = useMemo(() => {
    const userDefault = views.find((v) => v.isUserDefault)
    const workspaceDefault = views.find((v) => v.isWorkspaceDefault)
    return { userDefault, workspaceDefault }
  }, [views])

  // Get active view
  const activeView = useMemo(() => {
    if (!currentState.activeViewId) {
      return null
    }
    return views.find((v) => v.id === currentState.activeViewId) ?? null
  }, [views, currentState.activeViewId])

  // Check if current state is dirty (differs from active view)
  const isDirty = useMemo(() => {
    if (!activeView) {
      return false
    }

    const currentPersisted = extractPersistedState(currentState)
    const activeViewState = replaySavedViewState(activeView.state)
    const comparableActiveViewState = activeView.readonly
      ? { ...activeViewState, columnWidths: currentPersisted.columnWidths }
      : activeViewState

    // Exclude activeViewId from comparison (it's metadata, not part of the view state)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { activeViewId: _currentActiveViewId, ...currentStateWithoutActiveViewId } =
      currentPersisted
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { activeViewId: _savedActiveViewId, ...savedStateWithoutActiveViewId } =
      comparableActiveViewState

    // Deep comparison using custom deepEqual (handles key order, proper equality)
    return !deepEqual(currentStateWithoutActiveViewId, savedStateWithoutActiveViewId)
  }, [activeView, currentState])

  // Apply view to table state
  const applyView = useCallback(
    (viewId: string) => {
      const view = views.find((v) => v.id === viewId)
      if (!view) {
        console.warn(`[DatatableViews] View ${viewId} not found`)
        return
      }

      // Apply view state to store
      // This will trigger persistState and urlSync (if enabled)
      setState(applySavedViewState(currentState, view))
    },
    [views, setState, currentState],
  )

  // Create view from current state
  const createViewFromCurrentState = useCallback(
    async (name: string, options?: { isUserDefault?: boolean }) => {
      const currentPersisted = extractPersistedState(currentState)

      const newView: Omit<DatatableView, "id" | "createdAt" | "updatedAt"> = {
        name,
        state: buildDatatableViewState(currentPersisted),
        isShared: false,
        isUserDefault: options?.isUserDefault ?? false,
        isWorkspaceDefault: false,
        createdBy: userId ?? "default",
        workspaceId,
      }

      const createdView = await createViewAsync(newView)

      // Automatically select the newly created view as active
      setActiveViewId(createdView.id)

      return createdView
    },
    [currentState, userId, workspaceId, createViewAsync, setActiveViewId],
  )

  // Update active view with current state
  const updateActiveViewWithCurrentState = useCallback(async () => {
    if (!activeView) {
      throw new Error("No active view to update")
    }

    const currentPersisted = extractPersistedState(currentState)
    assertMutableDatatableView(activeView, "update")

    return updateViewAsync({
      viewId: activeView.id,
      updates: {
        state: buildDatatableViewState(currentPersisted),
      },
    })
  }, [activeView, currentState, updateViewAsync])

  // Clear active view
  const clearActiveView = useCallback(() => {
    setActiveViewId(null)
  }, [setActiveViewId])

  return {
    // Data
    views,
    isLoading,
    error,
    defaultViews,
    activeView,
    isDirty,

    // Mutations
    createView: (view: Omit<DatatableView, "id" | "createdAt" | "updatedAt">) => {
      void createViewAsync(view)
    },
    createViewAsync,
    updateView: (input: { viewId: string; updates: Partial<DatatableView> }) => {
      void updateViewAsync(input)
    },
    updateViewAsync,
    deleteView: (viewId: string) => {
      void deleteViewAsync(viewId)
    },
    deleteViewAsync,
    shareView: (viewId: string) => {
      void shareViewAsync(viewId)
    },
    shareViewAsync,
    setUserDefault: (viewId: string | null) => {
      void setUserDefaultAsync(viewId)
    },
    setUserDefaultAsync,
    setWorkspaceDefault: (viewId: string | null) => {
      void setWorkspaceDefaultAsync(viewId)
    },
    setWorkspaceDefaultAsync,

    // Helpers
    applyView,
    createViewFromCurrentState,
    updateActiveViewWithCurrentState,
    clearActiveView,

    // Adapter capabilities
    canShare: adapter ? adapterSupportsSharing(adapter) : false,
    canSetDefaults: adapter ? adapterSupportsDefaults(adapter) : false,

    // Mutation states
    isCreating,
    isUpdating,
    isDeleting,
    isSharing,
  }
}

export type UseDatatableViewsState = ReturnType<typeof useDatatableViews>
