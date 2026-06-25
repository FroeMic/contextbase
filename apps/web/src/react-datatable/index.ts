/**
 * Datatable - Public API
 *
 * Public API for the datatable component and documented customization points.
 */

export { DatatableAppliedStateBar } from "./components/applied-state-bar/DatatableAppliedStateBar"
// Toolbar components
export { DatatableToolbar } from "./components/toolbar/DatatableToolbar"
export { FilterButton } from "./components/toolbar/FilterButton"
export type { CursorGrowthFetchIntent } from "./core/cursor/cursor-growth-virtualization"
export {
  buildCursorGrowthRenderableRows,
  resolveCursorGrowthFetchIntent,
} from "./core/cursor/cursor-growth-virtualization"
export type {
  CursorPage,
  CursorPageCache,
  CursorQueryInput,
} from "./core/cursor/cursor-page-cache"
export {
  appendCursorPage,
  buildCursorQueryInput,
  createCursorPageCache,
  resetCursorPageCacheForSignature,
} from "./core/cursor/cursor-page-cache"
// Core component
export { Datatable } from "./core/Datatable"
export { useDatatableColumnSizing } from "./core/DatatableBody"
export { DatatableProvider, useDatatableColumns } from "./core/DatatableProvider"

// Filter components
export { FilterDropdown } from "./features/filters/FilterDropdown"
export { FilterItem } from "./features/filters/FilterItem"
export { FilterTypeIcon } from "./features/filters/FilterTypeIcon"
// Store types (for advanced usage)
export type { DatatableActions, DatatableStore } from "./state/store/store.types"
// Hooks
export { useDatatableStore, useDatatableStoreApi } from "./state/store/use-datatable-store"
// Types
export type * from "./types"
