import { useCallback, useEffect, useRef, useState } from "react"
import { debug } from "../../shared/utils/debug"

/**
 * Types of focusable elements in the views dropdown
 */
export type FocusableItemType =
  | "create-button"
  | "section-header"
  | "view-main"
  | "view-action-button"
  | "view-unsaved-button"

export interface FocusableItem {
  id: string
  type: FocusableItemType
  /** Index in the flat list */
  index: number
  /** Whether this item can receive keyboard focus */
  focusable: boolean
  /** View ID if this is a view-related item */
  viewId?: string
  /** Action type for button items */
  action?: "menu" | "update" | "save-as"
}

interface UseViewsKeyboardNavOptions {
  /** Total number of views in the list */
  viewCount?: number
  /** IDs of views that are dirty (show unsaved buttons) */
  dirtyViewIds: string[]
  /** Callback when create button is selected with Enter/Space */
  onCreateView: () => void
  /** Callback when a view is selected (main area) */
  onApplyView: (viewId: string) => void
  /** Callback when a view action button is triggered */
  onViewAction: (viewId: string, action: "menu" | "update" | "save-as") => void
  /** View IDs in display order */
  viewIds: string[]
  /** Whether sections are present (affects navigation structure) */
  hasSections?: boolean
  /** Whether a submenu is currently open (disables main keyboard nav) */
  isSubmenuOpen?: boolean
}

/**
 * Hook for managing keyboard navigation in the ViewsButton dropdown
 *
 * Handles:
 * - Building flat list of all focusable elements
 * - Arrow key navigation (up/down between items)
 * - Tab/Shift+Tab navigation (cycles through all focusable elements)
 * - Enter/Space to activate focused element
 * - Skipping non-focusable items (section headers)
 * - Focus management within composite items (view + action buttons)
 *
 * Navigation structure:
 * 1. Search input (managed by parent component)
 * 2. Create new view button
 * 3. [Section header - not focusable]
 * 4. View 1 - main area
 * 5. View 1 - three-dot menu button
 * 6. View 1 - update button (if dirty)
 * 7. View 1 - save as button (if dirty)
 * 8. View 2 - main area
 * 9. ...
 */
export function useViewsKeyboardNav({
  dirtyViewIds,
  onCreateView,
  onApplyView,
  onViewAction,
  viewIds,
  isSubmenuOpen = false,
}: UseViewsKeyboardNavOptions) {
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Build flat list of all focusable items
  const focusableItems = useRef<FocusableItem[]>([])

  // Rebuild focusable items list when dependencies change
  useEffect(() => {
    const items: FocusableItem[] = []
    let index = 0

    // 1. Create button
    items.push({
      id: "create-button",
      type: "create-button",
      index: index++,
      focusable: true,
    })

    // 2. Section headers and view items
    viewIds.forEach((viewId) => {
      // Add section header if needed (we'll handle "Private" vs "Workspace" in parent)
      // Section headers are added but marked as non-focusable
      // The parent component should provide viewIds in the order they appear

      // View main area
      items.push({
        id: `view-${viewId}-main`,
        type: "view-main",
        index: index++,
        focusable: true,
        viewId,
      })

      // View action menu button (three-dot)
      items.push({
        id: `view-${viewId}-menu`,
        type: "view-action-button",
        index: index++,
        focusable: true,
        viewId,
        action: "menu",
      })

      // If view is dirty, add unsaved action buttons
      if (dirtyViewIds.includes(viewId)) {
        items.push({
          id: `view-${viewId}-update`,
          type: "view-unsaved-button",
          index: index++,
          focusable: true,
          viewId,
          action: "update",
        })
        items.push({
          id: `view-${viewId}-save-as`,
          type: "view-unsaved-button",
          index: index++,
          focusable: true,
          viewId,
          action: "save-as",
        })
      }
    })

    focusableItems.current = items
  }, [viewIds, dirtyViewIds])

  // Get only focusable items (excluding section headers)
  const getFocusableItems = useCallback(() => {
    return focusableItems.current.filter((item) => item.focusable)
  }, [])

  // Navigate to next focusable item
  const focusNext = useCallback(() => {
    const items = getFocusableItems()
    if (items.length === 0) {
      return
    }

    setFocusedIndex((prev) => {
      const currentIndexInFocusable = items.findIndex((item) => item.index === prev)
      const nextIndexInFocusable = (currentIndexInFocusable + 1) % items.length
      const nextItem = items[nextIndexInFocusable]
      debug("[ViewsKeyboardNav] focusNext - moving to:", nextItem)
      return nextItem.index
    })
  }, [getFocusableItems])

  // Navigate to previous focusable item
  const focusPrevious = useCallback(() => {
    const items = getFocusableItems()
    if (items.length === 0) {
      return
    }

    setFocusedIndex((prev) => {
      const currentIndexInFocusable = items.findIndex((item) => item.index === prev)
      const prevIndexInFocusable = (currentIndexInFocusable - 1 + items.length) % items.length
      return items[prevIndexInFocusable].index
    })
  }, [getFocusableItems])

  // Activate the currently focused item
  const activateFocused = useCallback(() => {
    const items = getFocusableItems()
    const focusedItem = items.find((item) => item.index === focusedIndex)

    if (!focusedItem) {
      return
    }

    switch (focusedItem.type) {
      case "create-button":
        onCreateView()
        break
      case "view-main":
        if (focusedItem.viewId) {
          onApplyView(focusedItem.viewId)
        }
        break
      case "view-action-button":
      case "view-unsaved-button":
        if (focusedItem.viewId && focusedItem.action) {
          onViewAction(focusedItem.viewId, focusedItem.action)
        }
        break
    }
  }, [focusedIndex, getFocusableItems, onCreateView, onApplyView, onViewAction])

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // When submenu is open, don't handle keyboard events in main dropdown
      if (isSubmenuOpen) {
        debug("[ViewsKeyboardNav] Submenu is open, ignoring keyboard event")
        return
      }

      debug("[ViewsKeyboardNav] Key pressed:", e.key, "focusedIndex:", focusedIndex)

      const items = getFocusableItems()
      debug("[ViewsKeyboardNav] Focusable items:", items.length, items)

      if (items.length === 0) {
        debug("[ViewsKeyboardNav] No items, returning")
        return
      }

      // Tab/Shift+Tab navigation
      if (e.key === "Tab") {
        debug("[ViewsKeyboardNav] Tab pressed, shift:", e.shiftKey)
        e.preventDefault()
        const direction = e.shiftKey ? -1 : 1

        // If no item is focused, start from first item
        if (focusedIndex === -1) {
          debug("[ViewsKeyboardNav] Setting focus to first item:", items[0])
          setFocusedIndex(items[0].index)
        } else {
          debug("[ViewsKeyboardNav] Moving focus, direction:", direction > 0 ? "next" : "previous")
          if (direction > 0) {
            focusNext()
          } else {
            focusPrevious()
          }
        }
        return
      }

      // Arrow key navigation
      if (e.key === "ArrowDown") {
        debug("[ViewsKeyboardNav] ArrowDown pressed")
        e.preventDefault()
        // If no item focused, start from first
        if (focusedIndex === -1) {
          debug("[ViewsKeyboardNav] Setting focus to first item:", items[0])
          setFocusedIndex(items[0].index)
        } else {
          debug("[ViewsKeyboardNav] Moving to next item")
          focusNext()
        }
      } else if (e.key === "ArrowUp") {
        debug("[ViewsKeyboardNav] ArrowUp pressed")
        e.preventDefault()
        // If no item focused, start from last
        if (focusedIndex === -1) {
          debug("[ViewsKeyboardNav] Setting focus to last item:", items[items.length - 1])
          setFocusedIndex(items[items.length - 1].index)
        } else {
          debug("[ViewsKeyboardNav] Moving to previous item")
          focusPrevious()
        }
      } else if (e.key === "Enter") {
        debug("[ViewsKeyboardNav] Enter pressed")
        e.preventDefault()
        // If focused on an item, activate it
        if (focusedIndex !== -1) {
          debug("[ViewsKeyboardNav] Activating focused item")
          activateFocused()
        } else {
          debug("[ViewsKeyboardNav] No item focused, ignoring Enter")
        }
      }
    },
    [focusNext, focusPrevious, activateFocused, getFocusableItems, focusedIndex, isSubmenuOpen],
  )

  // Reset focus when dropdown opens
  const resetFocus = useCallback(() => {
    setFocusedIndex(-1)
  }, [])

  // Get focused item info
  const getFocusedItem = useCallback(() => {
    const items = getFocusableItems()
    return items.find((item) => item.index === focusedIndex)
  }, [focusedIndex, getFocusableItems])

  // Check if a specific item is focused
  const isItemFocused = useCallback(
    (itemId: string) => {
      const focusedItem = getFocusedItem()
      return focusedItem?.id === itemId
    },
    [getFocusedItem],
  )

  return {
    searchInputRef,
    focusedIndex,
    handleKeyDown,
    resetFocus,
    getFocusedItem,
    isItemFocused,
    focusableItems: focusableItems.current,
  }
}
