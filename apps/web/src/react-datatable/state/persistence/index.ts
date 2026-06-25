/**
 * Table State Persistence Module
 *
 * Provides pluggable adapters for persisting table state (display options,
 * layout, sorting, grouping) to various storage backends.
 *
 * Usage:
 * ```tsx
 * import { localStorageAdapter } from "./persistence"
 *
 * <Datatable
 *   persistState={{
 *     adapter: localStorageAdapter,
 *     tableKey: "contacts",
 *   }}
 * />
 * ```
 */

// Table State Persistence - Type exports
export type {
  PersistedTableState,
  PersistedTableStateSnapshot,
  TableStateAdapter,
  TableStateAdapterConfig,
} from "./table-state-adapter.types"

// Table State Persistence - Helper exports
export { extractPersistedState } from "./table-state-adapter.types"

// Table State Persistence - Adapter exports
export { localStorageAdapter, sessionStorageAdapter } from "./table-state-adapter-localstorage"
