/**
 * ViewsContext
 *
 * Shared state management for DatatableViewDropdown component.
 * Coordinates dropdown state, dialog visibility, and keyboard navigation.
 */

import { createContext, type ReactNode, useContext, useRef, useState } from "react"
import type { ViewsContextValue } from "./types"
import { useViewsKeyboardNav } from "./use-views-keyboard-nav"

const ViewsContext = createContext<ViewsContextValue | null>(null)

export function useViewsContext() {
  const context = useContext(ViewsContext)
  if (!context) {
    throw new Error("useViewsContext must be used within ViewsContextProvider")
  }
  return context
}

interface ViewsContextProviderProps {
  children: ReactNode
  viewCount: number
  dirtyViewIds: string[]
  viewIds: string[]
  onCreateView: () => void
  onApplyView: (viewId: string) => void
  onViewAction: (viewId: string, action: "update" | "save-as" | "menu") => void
  hasSections: boolean
}

export function ViewsContextProvider({
  children,
  viewCount,
  dirtyViewIds,
  viewIds,
  onCreateView,
  onApplyView,
  onViewAction,
  hasSections,
}: ViewsContextProviderProps) {
  // Dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [renameDialogViewId, setRenameDialogViewId] = useState<string | null>(null)
  const [deleteDialogViewId, setDeleteDialogViewId] = useState<string | null>(null)

  // Dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  // Menu state
  const [openMenuForViewId, setOpenMenuForViewId] = useState<string | null>(null)
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false)

  // Keyboard navigation
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const { isItemFocused, resetFocus, handleKeyDown } = useViewsKeyboardNav({
    viewCount,
    dirtyViewIds,
    viewIds,
    onCreateView: () => {
      setIsCreateDialogOpen(true)
      onCreateView()
    },
    onApplyView: (viewId) => {
      setIsDropdownOpen(false)
      onApplyView(viewId)
    },
    onViewAction: (viewId, action) => {
      if (action === "menu") {
        setOpenMenuForViewId(viewId)
      } else if (action === "save-as") {
        setIsCreateDialogOpen(true)
      }
      onViewAction(viewId, action)
    },
    hasSections,
    isSubmenuOpen,
  })

  const value: ViewsContextValue = {
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    renameDialogViewId,
    setRenameDialogViewId,
    deleteDialogViewId,
    setDeleteDialogViewId,
    isDropdownOpen,
    setIsDropdownOpen,
    searchValue,
    setSearchValue,
    openMenuForViewId,
    setOpenMenuForViewId,
    isSubmenuOpen,
    setIsSubmenuOpen,
    searchInputRef,
    handleKeyDown,
    isItemFocused,
    resetFocus,
  }

  return <ViewsContext.Provider value={value}>{children}</ViewsContext.Provider>
}
