/**
 * Type definitions for DatatableViewDropdown module
 */

import type { DatatableProps } from "../../types/props.types"

export interface ViewsContextValue {
  // Dialog state
  isCreateDialogOpen: boolean
  setIsCreateDialogOpen: (open: boolean) => void
  renameDialogViewId: string | null
  setRenameDialogViewId: (viewId: string | null) => void
  deleteDialogViewId: string | null
  setDeleteDialogViewId: (viewId: string | null) => void

  // Dropdown state
  isDropdownOpen: boolean
  setIsDropdownOpen: (open: boolean) => void
  searchValue: string
  setSearchValue: (value: string) => void

  // Menu state
  openMenuForViewId: string | null
  setOpenMenuForViewId: (viewId: string | null) => void
  isSubmenuOpen: boolean
  setIsSubmenuOpen: (open: boolean) => void

  // Keyboard navigation
  searchInputRef: React.RefObject<HTMLInputElement | null>
  handleKeyDown: (e: React.KeyboardEvent) => void
  isItemFocused: (itemId: string) => boolean
  resetFocus: () => void
}

export interface DatatableViewDropdownProps<TData> {
  viewsConfig?: DatatableProps<TData>["views"]
  currentUserId?: string
}
