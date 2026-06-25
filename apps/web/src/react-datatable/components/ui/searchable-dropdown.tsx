import {
  cloneElement,
  isValidElement,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react"
import { useDropdownKeyboardNav } from "../../shared/hooks/use-dropdown-keyboard-nav"
import { useOverlaySearchInput } from "../../shared/hooks/use-overlay-search-input"
import { DATATABLE_MOBILE_SEARCH_INPUT_CLASS } from "../../shared/styles/input-classes"
import { cn } from "../../shared/utils/cn"
import { useDatatableMobileSelector } from "../mobile/datatable-mobile-selector-context"
import { Input } from "./input"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

/**
 * SearchableDropdown - Generic dropdown with search & keyboard navigation
 *
 * A reusable dropdown component that provides:
 * - Search input with auto-focus
 * - Full keyboard navigation (Tab, Arrow keys, Enter, Escape)
 * - Visual highlight of selected item
 * - Customizable item rendering
 * - Empty state handling
 *
 * This component consolidates the pattern used across FilterDropdown,
 * TextListFilterChip, and TextFilterEditor.
 *
 * @example
 * ```tsx
 * <SearchableDropdown
 *   open={open}
 *   onOpenChange={setOpen}
 *   items={columns}
 *   renderItem={(col) => col.header}
 *   getItemKey={(col) => col.id}
 *   onSelect={(col) => console.log('Selected:', col)}
 *   searchPlaceholder="Search columns..."
 * />
 * ```
 */

export interface SearchableDropdownProps<T> {
  /** Whether the dropdown is open */
  open: boolean
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void
  /** Array of items to display */
  items: readonly T[]
  /** Function to render each item (receives item and isSelected) */
  renderItem: (item: T, isSelected: boolean) => ReactNode
  /** Function to extract unique key from item */
  getItemKey: (item: T) => string
  /** Callback when an item is selected */
  onSelect: (item: T) => void
  /** Optional: Search placeholder text */
  searchPlaceholder?: string
  /** Optional: Filter function for search */
  filterFn?: (item: T, search: string) => boolean
  /** Optional: Content alignment */
  align?: "start" | "end" | "center"
  /** Optional: Width class */
  width?: string
  /** Optional: Empty state text */
  emptyText?: string
  /** Optional: Additional popover content classes */
  contentClassName?: string
  /** Optional: Additional list classes */
  listClassName?: string
  /** Optional: Additional row classes */
  itemClassName?: string
  /** Optional: Outside interaction handler for the popover content */
  onInteractOutside?: React.ComponentProps<typeof PopoverContent>["onInteractOutside"]
  /** Optional: Trigger element */
  children?: ReactNode
  /** Optional: Mobile-sized control styling for drawer-hosted dropdowns */
  variant?: "default" | "mobile"
}

export function SearchableDropdown<T>({
  open,
  onOpenChange,
  items,
  renderItem,
  getItemKey,
  onSelect,
  searchPlaceholder = "Search...",
  filterFn,
  align = "start",
  width = "w-56",
  emptyText = "No items found",
  contentClassName,
  listClassName,
  itemClassName,
  onInteractOutside,
  children,
  variant = "default",
}: SearchableDropdownProps<T>) {
  const mobileSelector = useDatatableMobileSelector()
  const listboxId = useId()
  const selectedButtonRef = useRef<HTMLButtonElement>(null)
  const scrollAnimationRef = useRef<number | undefined>(undefined)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { handleOpenAutoFocus, inputClassName } = useOverlaySearchInput(searchInputRef, open)

  const { search, setSearch, selectedIndex, handleKeyDown, filteredItems } = useDropdownKeyboardNav(
    {
      items,
      onSelect: (item) => {
        onSelect(item)
        onOpenChange(false)
      },
      filterFn,
      onEscape: () => onOpenChange(false),
    },
  )

  // Auto-scroll selected item into view with animation frame cancellation
  // Prevents animation queue buildup during rapid keyboard navigation
  useEffect(() => {
    if (selectedIndex < 0) {
      return
    }

    // Cancel any pending scroll animation
    if (scrollAnimationRef.current !== undefined) {
      cancelAnimationFrame(scrollAnimationRef.current)
      scrollAnimationRef.current = undefined
    }

    // Schedule new scroll animation
    scrollAnimationRef.current = requestAnimationFrame(() => {
      selectedButtonRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
      scrollAnimationRef.current = undefined // Clear after execution
    })

    // Cleanup on unmount
    return () => {
      if (scrollAnimationRef.current !== undefined) {
        cancelAnimationFrame(scrollAnimationRef.current)
        scrollAnimationRef.current = undefined
      }
    }
  }, [selectedIndex])

  // Reset search when dropdown closes
  // NOTE: State reset happens before onOpenChange callback, but React state updates are async.
  // Parent components should NOT read internal search state during onOpenChange callback.
  // If parent needs search state, consider lifting search to parent as controlled prop.
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSearch("")
    }
    onOpenChange(newOpen)
  }

  if (mobileSelector) {
    const openMobileSelector = () => {
      onOpenChange(true)
      mobileSelector.openSelector({
        emptyText,
        filterFn: filterFn ? (item, query) => filterFn(item as T, query) : undefined,
        getItemKey: (item) => getItemKey(item as T),
        items: items as readonly unknown[],
        onDismiss: () => onOpenChange(false),
        onSelect: (item) => {
          onSelect(item as T)
          onOpenChange(false)
        },
        renderItem: (item, isSelected) => renderItem(item as T, isSelected),
        searchPlaceholder,
        title: searchPlaceholder.replace(/\.\.\.$/, ""),
      })
    }

    if (
      isValidElement<{
        "aria-expanded"?: boolean
        onClick?: (event: MouseEvent<HTMLElement>) => void
      }>(children)
    ) {
      return cloneElement(children, {
        "aria-expanded": open,
        onClick: (event: MouseEvent<HTMLElement>) => {
          children.props.onClick?.(event)
          if (!event.defaultPrevented) {
            openMobileSelector()
          }
        },
      })
    }

    return (
      <button type="button" onClick={openMobileSelector}>
        {children}
      </button>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      {children && <PopoverTrigger asChild>{children}</PopoverTrigger>}
      <PopoverContent
        className={cn(width, "z-[100] overflow-hidden p-0", contentClassName)}
        align={align}
        data-rdt-nested-popover-content="true"
        onInteractOutside={onInteractOutside}
        onOpenAutoFocus={handleOpenAutoFocus}
      >
        <div className="flex flex-col" onKeyDown={handleKeyDown} role="menu">
          {/* Search input - sticky at top */}
          {/* NOTE: aria-expanded should be on the trigger button, not this input (which only exists when dropdown is already open) */}
          <div className="bg-popover sticky top-0 z-10 border-b p-0.5">
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className={cn(
                variant === "mobile"
                  ? DATATABLE_MOBILE_SEARCH_INPUT_CLASS
                  : "inline-input h-8 border-none bg-transparent px-2 py-1 focus-visible:ring-0 focus-visible:outline-none",
                variant === "mobile"
                  ? "focus-visible:ring-0 focus-visible:outline-none"
                  : inputClassName,
              )}
              role="combobox"
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-activedescendant={
                selectedIndex >= 0 && filteredItems.length > 0
                  ? `${listboxId}-option-${selectedIndex}`
                  : undefined
              }
            />
          </div>

          {/* Item list - scrollable */}
          <div
            id={listboxId}
            role="listbox"
            aria-label={searchPlaceholder}
            className={cn("scrollbar-hidden max-h-[320px] overflow-y-auto py-1", listClassName)}
          >
            {filteredItems.length === 0 ? (
              <div className="text-muted-foreground px-3 py-8 text-center !text-xs">
                {emptyText}
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const key = getItemKey(item)
                const isSelected = index === selectedIndex

                return (
                  <button
                    key={key}
                    id={`${listboxId}-option-${index}`}
                    ref={isSelected ? selectedButtonRef : null}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelect(item)
                      onOpenChange(false)
                    }}
                    className={cn(
                      "hover:bg-accent hover:text-accent-foreground mx-1 w-[calc(100%-0.5rem)] rounded px-2 py-1.5 text-left !text-xs transition-colors",
                      variant === "mobile" && "h-11 px-3 py-2 !text-sm",
                      isSelected && "bg-accent text-accent-foreground",
                      itemClassName,
                    )}
                  >
                    {renderItem(item, isSelected)}
                  </button>
                )
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
