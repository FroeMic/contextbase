import { useCallback, useEffect, useMemo, useState } from "react"

interface UseDropdownKeyboardNavOptions<T> {
  /** Array of items to navigate through */
  items: readonly T[]
  /** Callback when an item is selected (Enter key) */
  onSelect: (item: T) => void
  /** Optional: Filter function for search - takes item and search string */
  filterFn?: (item: T, search: string) => boolean
  /** Optional: Callback when Escape key is pressed (to close dropdown) */
  onEscape?: () => void
}

interface UseDropdownKeyboardNavReturn<T> {
  /** Current search query */
  search: string
  /** Update search query */
  setSearch: (search: string) => void
  /** Currently selected index in filtered list */
  selectedIndex: number
  /** Keyboard event handler for the dropdown container */
  handleKeyDown: (e: React.KeyboardEvent) => void
  /** Filtered items (pass this to your render logic) */
  filteredItems: readonly T[]
}

/**
 * Shared hook for keyboard navigation in dropdown menus
 *
 * Provides full keyboard navigation support for dropdown/popover menus with optional search filtering.
 * Handles all keyboard interactions including Tab, Arrow keys, Enter, and Escape.
 *
 * @template T - Type of items in the dropdown
 *
 * @param options - Configuration options
 * @param options.items - Array of items to navigate through
 * @param options.onSelect - Callback when an item is selected (Enter key or click)
 * @param options.filterFn - Optional filter function for search. Takes (item, searchQuery) and returns boolean
 * @param options.onEscape - Optional callback when Escape key is pressed (typically closes dropdown)
 *
 * @returns Object containing:
 * - `search` - Current search query string
 * - `setSearch` - Function to update search query
 * - `selectedIndex` - Currently highlighted index in filtered list
 * - `handleKeyDown` - Event handler to attach to dropdown container
 * - `filteredItems` - Items after applying search filter
 *
 * @example
 * ```tsx
 * const {
 *   search,
 *   setSearch,
 *   selectedIndex,
 *   handleKeyDown,
 *   filteredItems
 * } = useDropdownKeyboardNav({
 *   items: TEXT_FILTER_MODE_OPTIONS,
 *   onSelect: (option) => {
 *     console.log('Selected:', option)
 *     setDropdownOpen(false)
 *   },
 *   filterFn: (opt, search) => opt.label.toLowerCase().includes(search.toLowerCase()),
 *   onEscape: () => setDropdownOpen(false),
 * })
 *
 * return (
 *   <div onKeyDown={handleKeyDown}>
 *     <Input value={search} onChange={e => setSearch(e.target.value)} />
 *     {filteredItems.map((item, index) => (
 *       <button
 *         key={index}
 *         onClick={() => onSelect(item)}
 *         className={index === selectedIndex ? 'bg-accent' : ''}
 *       >
 *         {item.label}
 *       </button>
 *     ))}
 *   </div>
 * )
 * ```
 *
 * @remarks
 * Keyboard controls:
 * - **Tab/Shift+Tab** - Navigate through items (wraps around)
 * - **Arrow Up/Down** - Navigate through items (wraps around)
 * - **Enter** - Select currently highlighted item
 * - **Escape** - Close dropdown (if onEscape provided)
 *
 * Used by:
 * - FilterChip mode dropdown
 * - TextFilterEditor ConditionRow mode dropdown
 */
export function useDropdownKeyboardNav<T>({
  items,
  onSelect,
  filterFn,
  onEscape,
}: UseDropdownKeyboardNavOptions<T>): UseDropdownKeyboardNavReturn<T> {
  const [search, setSearch] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Filter items based on search if filterFn provided
  const filteredItems = useMemo(() => {
    if (!filterFn || !search) {
      return items
    }
    return items.filter((item) => filterFn(item, search))
  }, [items, search, filterFn])

  // Reset selection when filtered items change
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredItems])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Escape key - close dropdown
      if (e.key === "Escape") {
        e.preventDefault()
        onEscape?.()
        return
      }

      if (filteredItems.length === 0) {
        return
      }

      // Tab/Shift+Tab navigation
      if (e.key === "Tab") {
        e.preventDefault()
        const direction = e.shiftKey ? -1 : 1
        setSelectedIndex((prev) => {
          const newIndex = prev + direction
          if (newIndex < 0) {
            return filteredItems.length - 1
          }
          if (newIndex >= filteredItems.length) {
            return 0
          }
          return newIndex
        })
        return
      }

      // Arrow key navigation
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length)
      } else if (e.key === "Enter") {
        e.preventDefault()
        const selectedItem = filteredItems[selectedIndex]
        if (selectedItem) {
          onSelect(selectedItem)
        }
      }
    },
    [filteredItems, selectedIndex, onSelect, onEscape],
  )

  return {
    search,
    setSearch,
    selectedIndex,
    handleKeyDown,
    filteredItems,
  }
}
