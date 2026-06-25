/**
 * Datatable Views Adapter Interface
 *
 * Defines the contract for datatable views persistence adapters.
 * Adapters can use localStorage, sessionStorage, tRPC, or any other backend.
 *
 * This abstraction allows us to:
 * - Start with localStorage for testing
 * - Swap to tRPC backend for production with sharing support
 * - Easily add new adapter types
 */

import type { DatatableViewState as DatatableViewStateType } from "../lifecycle/table-state-snapshot"

export type DatatableViewState = DatatableViewStateType

/**
 * Datatable view entity
 *
 * Represents a named configuration that users can save and load.
 * Can be private (user-only) or shared (workspace-wide).
 */
export interface DatatableView {
  /**
   * Unique identifier for the view
   */
  id: string

  /**
   * Display name for the view
   */
  name: string

  /**
   * Table state snapshot
   * Direct saved-view state payload.
   */
  state: DatatableViewState

  /**
   * Whether this view is shared with the workspace
   * - false: Private (visible only to creator)
   * - true: Shared (visible to all workspace members)
   *
   * Note: Once shared, a view cannot be made private again
   */
  isShared: boolean

  /**
   * Whether this is the user's default view
   * When true, this view is automatically applied on table load
   */
  isUserDefault: boolean

  /**
   * Whether this is the workspace default view
   * Only applicable for shared views
   * When true, this view is the default for all workspace members (unless they have a user default)
   */
  isWorkspaceDefault: boolean

  /**
   * User ID of the creator
   */
  createdBy: string

  /**
   * Creation timestamp
   */
  createdAt: Date

  /**
   * Last update timestamp
   */
  updatedAt: Date

  /**
   * Workspace ID (only present if shared)
   */
  workspaceId?: string

  /**
   * Stable link slug for code-defined views.
   */
  slug?: string

  /**
   * Readonly views can be applied, but cannot be changed through saved-view mutations.
   */
  readonly?: boolean

  /**
   * Origin marker used by UI and mutation guards.
   */
  source?: "fixed" | "user" | "workspace"
}

/**
 * Configuration for saved view adapters
 */
export interface DatatableViewAdapterConfig {
  /**
   * Table key (e.g., "contacts", "deals")
   * Used to scope views per table
   */
  tableKey: string

  /**
   * Workspace ID (optional - depends on adapter)
   */
  workspaceId?: string

  /**
   * User ID (optional - inferred from context in most cases)
   */
  userId?: string
}

/**
 * Adapter interface
 *
 * All adapters must implement these methods.
 * Optional methods (share, setUserDefault, setWorkspaceDefault) are only
 * available in adapters that support sharing (e.g., tRPC).
 */
export interface DatatableViewAdapter {
  /**
   * List all views accessible to the user
   * Returns both private views (created by user) and shared views (workspace-wide)
   */
  list(config: DatatableViewAdapterConfig): Promise<DatatableView[]>

  /**
   * Get a specific view by ID
   * Returns null if view doesn't exist or user doesn't have access
   */
  get(config: DatatableViewAdapterConfig, viewId: string): Promise<DatatableView | null>

  /**
   * Create a new view
   * Returns the created view with generated ID and timestamps
   */
  create(
    config: DatatableViewAdapterConfig,
    view: Omit<DatatableView, "id" | "createdAt" | "updatedAt">,
  ): Promise<DatatableView>

  /**
   * Update an existing view
   * Only the creator can update a view
   * Returns the updated view
   */
  update(
    config: DatatableViewAdapterConfig,
    viewId: string,
    updates: Partial<DatatableView>,
  ): Promise<DatatableView>

  /**
   * Delete a view
   * Only the creator can delete a view
   */
  delete(config: DatatableViewAdapterConfig, viewId: string): Promise<void>

  /**
   * Share a private view with the workspace
   * This operation is irreversible - once shared, cannot be made private again
   *
   * Optional: Only available in adapters that support sharing (e.g., tRPC)
   */
  share?(config: DatatableViewAdapterConfig, viewId: string): Promise<DatatableView>

  /**
   * Set a view as the user's default
   * Pass null to clear the user default
   *
   * Optional: Only available in adapters that support default management
   */
  setUserDefault?(config: DatatableViewAdapterConfig, viewId: string | null): Promise<void>

  /**
   * Set a view as the workspace default
   * Only workspace admins can set workspace defaults
   * Pass null to clear the workspace default
   *
   * Optional: Only available in adapters that support sharing (e.g., tRPC)
   */
  setWorkspaceDefault?(config: DatatableViewAdapterConfig, viewId: string | null): Promise<void>
}

/**
 * Type guard to check if adapter supports sharing
 */
export function adapterSupportsSharing(
  adapter: DatatableViewAdapter,
): adapter is DatatableViewAdapter & {
  share: NonNullable<DatatableViewAdapter["share"]>
  setWorkspaceDefault: NonNullable<DatatableViewAdapter["setWorkspaceDefault"]>
} {
  return typeof adapter.share === "function" && typeof adapter.setWorkspaceDefault === "function"
}

/**
 * Type guard to check if adapter supports default management
 */
export function adapterSupportsDefaults(
  adapter: DatatableViewAdapter,
): adapter is DatatableViewAdapter & {
  setUserDefault: NonNullable<DatatableViewAdapter["setUserDefault"]>
} {
  return typeof adapter.setUserDefault === "function"
}
