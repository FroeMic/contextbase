import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react"
import {
  type DatatableViewsSourceData,
  type StateSource,
  useTableStateCoordinator,
} from "../state/lifecycle/use-table-state-coordinator"
import {
  useTableStatePersistence,
  useTableStatePersistenceAutoSave,
} from "../state/persistence/use-table-state-persistence"
import {
  resolveLinkedDatatableView,
  type UseDatatableViewsState,
  useDatatableViews,
} from "../state/saved-views/use-datatable-views"
import { createDatatableStore } from "../state/store/create-datatable-store"
import { DatatableStoreContext } from "../state/store/use-datatable-store"
import { type UseDatatableUrlOptions, useDatatableUrl } from "../state/url-sync/use-datatable-url"
import type { DatatableColumn } from "../types/column.types"
import type { DatatableProps } from "../types/props.types"
import type { DatatableState } from "../types/state.types"

interface DatatableProviderProps<TData> {
  children: ReactNode
  columns: DatatableColumn<TData>[]
  initialState?: Partial<DatatableState>
  urlSync?: boolean | Omit<UseDatatableUrlOptions<TData>, "columns">
  persistState?: DatatableProps<TData>["persistState"]
  views?: DatatableProps<TData>["views"]
}

/**
 * Column definition metadata type for context
 *
 * Filter components and display options only need metadata (id, header, filterType, etc),
 * not the generic data accessors. This allows type-safe context without `any`.
 *
 * Note: This is distinct from the ColumnMetadata interface in types/column.types.ts
 * which is used for TanStack Table's columnDef.meta property.
 */
type ColumnDefinitionMetadata = Pick<
  DatatableColumn<unknown>,
  | "id"
  | "header"
  | "filterType"
  | "filterOptions"
  | "enableFiltering"
  | "defaultVisible"
  | "enableSorting"
  | "showSortInHeader"
  | "width"
  | "minWidth"
  | "maxWidth"
> & {
  meta?: DatatableColumn<unknown>["meta"]
}

/**
 * Context for accessing column metadata throughout the component tree
 * Used by filter components to display available filters
 */
const ColumnsContext = createContext<ColumnDefinitionMetadata[] | null>(null)

/**
 * Context for coordinator readiness state
 * Used by useDatatableTable to know when it's safe to initialize columnOrder
 */
const CoordinatorReadyContext = createContext<boolean>(false)

const DatatableViewsContext = createContext<UseDatatableViewsState | null>(null)

/**
 * Hook to access column metadata from context
 * Must be used within DatatableProvider
 *
 * Returns only column metadata (id, header, filterType, etc), not data accessors.
 * This is sufficient for filter UI components.
 */
export function useDatatableColumns(): ColumnDefinitionMetadata[] {
  const columns = useContext(ColumnsContext)
  if (!columns) {
    throw new Error("useDatatableColumns must be used within DatatableProvider")
  }
  return columns
}

/**
 * Hook to access coordinator readiness state
 * Returns true once coordinator has finished loading and initializing store
 */
export function useCoordinatorReady(): boolean {
  return useContext(CoordinatorReadyContext)
}

export function useDatatableViewsContext(): UseDatatableViewsState | null {
  return useContext(DatatableViewsContext)
}

/**
 * Inner provider that uses hooks requiring store context
 */
function DatatableProviderInner<TData>({
  children,
  columns,
  initialState,
  store,
  persistState,
  urlSync,
  views,
}: DatatableProviderProps<TData> & { store: ReturnType<typeof createDatatableStore> }) {
  const shouldUseViews = Boolean(
    (views?.adapter && views.tableKey) || (views?.fixedViews && views.fixedViews.length > 0),
  )
  const shouldUseUrlState = shouldInitializeUrlState(urlSync)

  if (shouldUseViews && shouldUseUrlState) {
    return (
      <DatatableProviderWithViewsAndUrl
        columns={columns}
        initialState={initialState}
        store={store}
        persistState={persistState}
        urlSync={urlSync}
        views={views}
      >
        {children}
      </DatatableProviderWithViewsAndUrl>
    )
  }

  if (shouldUseViews) {
    return (
      <DatatableProviderWithViews
        columns={columns}
        initialState={initialState}
        store={store}
        persistState={persistState}
        views={views}
      >
        {children}
      </DatatableProviderWithViews>
    )
  }

  if (shouldUseUrlState) {
    return (
      <DatatableProviderWithUrl
        columns={columns}
        initialState={initialState}
        store={store}
        persistState={persistState}
        urlSync={urlSync}
      >
        {children}
      </DatatableProviderWithUrl>
    )
  }

  return (
    <DatatableProviderCoordinator
      columns={columns}
      initialState={initialState}
      store={store}
      persistState={persistState}
    >
      {children}
    </DatatableProviderCoordinator>
  )
}

function DatatableProviderWithViewsAndUrl<TData>({
  children,
  columns,
  initialState,
  store,
  persistState,
  urlSync,
  views,
}: DatatableProviderProps<TData> & { store: ReturnType<typeof createDatatableStore> }) {
  const datatableViewsState = useDatatableViews(views ?? {})
  const datatableViewsSource = useDatatableViewsSource(datatableViewsState, views?.linkedViewSlug)
  const { urlStateSource, enableContinuousSync } = useDatatableUrl(store, {
    columns,
    ...(typeof urlSync === "boolean"
      ? { enabled: urlSync, acceptUrlParams: true }
      : { acceptUrlParams: true, ...urlSync }),
  })

  return (
    <DatatableProviderCoordinator
      columns={columns}
      initialState={initialState}
      store={store}
      persistState={persistState}
      datatableViewsSource={datatableViewsSource}
      datatableViewsState={datatableViewsState}
      urlStateSource={urlStateSource}
      enableUrlContinuousSync={enableContinuousSync}
      onLinkedViewConsumed={views?.onLinkedViewConsumed}
    >
      {children}
    </DatatableProviderCoordinator>
  )
}

function DatatableProviderWithViews<TData>({
  children,
  columns,
  initialState,
  store,
  persistState,
  views,
}: DatatableProviderProps<TData> & { store: ReturnType<typeof createDatatableStore> }) {
  const datatableViewsState = useDatatableViews(views ?? {})
  const datatableViewsSource = useDatatableViewsSource(datatableViewsState, views?.linkedViewSlug)

  return (
    <DatatableProviderCoordinator
      columns={columns}
      initialState={initialState}
      store={store}
      persistState={persistState}
      datatableViewsSource={datatableViewsSource}
      datatableViewsState={datatableViewsState}
      onLinkedViewConsumed={views?.onLinkedViewConsumed}
    >
      {children}
    </DatatableProviderCoordinator>
  )
}

function DatatableProviderWithUrl<TData>({
  children,
  columns,
  initialState,
  store,
  persistState,
  urlSync,
}: DatatableProviderProps<TData> & { store: ReturnType<typeof createDatatableStore> }) {
  const { urlStateSource, enableContinuousSync } = useDatatableUrl(store, {
    columns,
    ...(typeof urlSync === "boolean"
      ? { enabled: urlSync, acceptUrlParams: true }
      : { acceptUrlParams: true, ...urlSync }),
  })

  return (
    <DatatableProviderCoordinator
      columns={columns}
      initialState={initialState}
      store={store}
      persistState={persistState}
      urlStateSource={urlStateSource}
      enableUrlContinuousSync={enableContinuousSync}
    >
      {children}
    </DatatableProviderCoordinator>
  )
}

function useDatatableViewsSource(
  datatableViewsState: UseDatatableViewsState,
  linkedViewSlug?: string | null,
): StateSource<DatatableViewsSourceData> {
  const { defaultViews, isLoading: isLoadingSavedViews, error: viewsError } = datatableViewsState
  const linkedView = resolveLinkedDatatableView(datatableViewsState.views, linkedViewSlug)

  return {
    isLoading: isLoadingSavedViews,
    data:
      defaultViews.userDefault || defaultViews.workspaceDefault || linkedView
        ? { ...defaultViews, linkedView }
        : null,
    error: viewsError ?? null,
  }
}

function shouldInitializeUrlState<TData>(
  urlSync: DatatableProviderProps<TData>["urlSync"],
): boolean {
  if (typeof urlSync === "boolean") {
    return urlSync
  }

  if (!urlSync) {
    return false
  }

  return urlSync.enabled === true || urlSync.acceptUrlParams !== false
}

function DatatableProviderCoordinator<TData>({
  children,
  columns,
  initialState,
  store,
  persistState,
  datatableViewsSource,
  datatableViewsState,
  urlStateSource,
  enableUrlContinuousSync,
  onLinkedViewConsumed,
}: DatatableProviderProps<TData> & {
  store: ReturnType<typeof createDatatableStore>
  datatableViewsSource?: StateSource<DatatableViewsSourceData>
  datatableViewsState?: UseDatatableViewsState
  urlStateSource?: StateSource<Partial<DatatableState>>
  enableUrlContinuousSync?: (enabled: boolean) => void
  onLinkedViewConsumed?: () => void
}) {
  const persistedStateSource = useTableStatePersistence(persistState ?? {})
  const { isReady, error: coordinatorError } = useTableStateCoordinator({
    persistedState: persistedStateSource,
    datatableViews: datatableViewsSource,
    urlState: urlStateSource,
    initialState,
    store,
    onLinkedViewConsumed,
  })

  // ==========================================
  // Phase 3: Enable Continuous Sync
  // ==========================================

  // Enable auto-save persistence after initialization
  useTableStatePersistenceAutoSave(
    store,
    {
      ...persistState,
      debounceMs: persistState?.debounceMs ?? 1000,
    },
    isReady,
  )

  // Enable URL continuous sync after initialization
  useEffect(() => {
    if (isReady) {
      enableUrlContinuousSync?.(true)
    }
  }, [isReady, enableUrlContinuousSync])

  // ==========================================
  // UI Rendering
  // ==========================================

  // Extract only metadata from columns (type-safe, no generics needed)
  const columnMetadata: ColumnDefinitionMetadata[] = useMemo(
    () =>
      columns.map((col) => ({
        id: col.id,
        header: col.header,
        filterType: col.filterType,
        filterOptions: col.filterOptions,
        enableFiltering: col.enableFiltering,
        defaultVisible: col.defaultVisible,
        enableSorting: col.enableSorting,
        showSortInHeader: col.showSortInHeader,
        width: col.width,
        minWidth: col.minWidth,
        maxWidth: col.maxWidth,
        meta: col.meta,
      })),
    [columns],
  )

  // Show loading state until store is initialized with persisted state
  // Use isReady instead of !isInitializing to ensure coordinator has applied state before rendering
  if (!isReady) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading table preferences...</div>
      </div>
    )
  }

  // Show error state if coordinator encountered an error
  if (coordinatorError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-destructive text-sm">
          Failed to load table: {coordinatorError.message}
        </div>
      </div>
    )
  }

  const content = (
    <CoordinatorReadyContext.Provider value={isReady}>
      <ColumnsContext.Provider value={columnMetadata}>{children}</ColumnsContext.Provider>
    </CoordinatorReadyContext.Provider>
  )

  if (datatableViewsState) {
    return (
      <DatatableViewsContext.Provider value={datatableViewsState}>
        {content}
      </DatatableViewsContext.Provider>
    )
  }

  return content
}

/**
 * Provider component that creates and provides Zustand store + columns context
 * Each Datatable instance gets its own isolated store
 *
 * Pattern: Store factory + Context provider + State coordinator
 *
 * State Loading Architecture (New Production-Grade Pattern):
 *
 * Phase 1: Parallel Data Fetching
 * - All sources (persistedState, views, urlState) fetch data in parallel
 * - Sources return StateSource objects (isLoading, data, error)
 * - No store mutations during this phase
 *
 * Phase 2: Coordinated Initialization
 * - Coordinator waits for all sources to finish loading
 * - Merges states using deterministic priority (pure function)
 * - Initializes store atomically (single setState call)
 *
 * Priority (lowest to highest):
 * 1. Default state (defaultDatatableState)
 * 2. initialState prop (developer defaults)
 * 3. Workspace default view (organization defaults)
 * 4. User default view (user's preferred default)
 * 5. Persisted state (auto-saved preferences, includes activeViewId if user selected a view)
 * 6. URL state (highest priority - enables shareable links)
 *
 * Phase 3: Continuous Sync
 * - After initialization, enable auto-save persistence (debounced)
 * - Enable bidirectional URL sync (if configured)
 * - Enable saved views dirty detection
 *
 * Benefits:
 * - Single, predictable initialization (no race conditions)
 * - Clear separation of concerns (fetch → coordinate → sync)
 * - Testable (pure merge function)
 * - Composable (easy to add new sources)
 * - Type-safe (StateSource interface enforces contract)
 */
export function DatatableProvider<TData>(props: DatatableProviderProps<TData>) {
  const { initialState } = props

  // Create store once per instance with initialState
  // Store is created once on mount and never recreated (store factory pattern)
  // Using useState with factory function ensures store survives Strict Mode double-mounting
  const [store] = useState(() => createDatatableStore(initialState))

  return (
    <DatatableStoreContext.Provider value={store}>
      <DatatableProviderInner {...props} store={store} />
    </DatatableStoreContext.Provider>
  )
}
