import { createContext, useContext } from "react"
import type { StoreApi, UseBoundStore } from "zustand"
import type { DatatableStore } from "./store.types"

/**
 * Context for the Zustand store
 * Follows the codebase pattern of Context + custom hook with error handling
 */
export const DatatableStoreContext = createContext<UseBoundStore<StoreApi<DatatableStore>> | null>(
  null,
)

/**
 * Hook to access the datatable store
 *
 * Usage:
 * - Single value: const sorting = useDatatableStore(s => s.sorting)
 * - Multiple values: const { sorting, filters } = useDatatableStore(useShallow(s => ({ sorting: s.sorting, filters: s.filters })))
 *
 * @throws Error if used outside DatatableProvider
 */
export function useDatatableStore<T>(selector: (state: DatatableStore) => T): T {
  const store = useContext(DatatableStoreContext)

  if (!store) {
    throw new Error("useDatatableStore must be used within DatatableProvider")
  }

  return store(selector)
}

/**
 * Hook to get the entire store (use sparingly)
 */
export function useDatatableStoreApi() {
  const store = useContext(DatatableStoreContext)

  if (!store) {
    throw new Error("useDatatableStoreApi must be used within DatatableProvider")
  }

  return store
}
