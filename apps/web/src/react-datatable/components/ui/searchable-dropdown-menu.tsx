import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import * as React from "react"
import { useOverlaySearchInput } from "../../shared/hooks/use-overlay-search-input"
import { cn } from "../../shared/utils/cn"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "./dropdown-menu"

/**
 * SearchableDropdownMenu - A reusable dropdown menu component with integrated search
 *
 * Combines shadcn's DropdownMenu with a search input field, enabling:
 * - Searchable list of items
 * - Native hover-to-expand submenus
 * - Full keyboard navigation
 * - Proper accessibility (ARIA)
 *
 * Usage:
 * ```tsx
 * <SearchableDropdownMenu>
 *   <SearchableDropdownMenuTrigger>
 *     <Button>Open Menu</Button>
 *   </SearchableDropdownMenuTrigger>
 *   <SearchableDropdownMenuContent
 *     searchValue={search}
 *     onSearchChange={setSearch}
 *     searchPlaceholder="Search..."
 *   >
 *     <SearchableDropdownMenuItem>Item 1</SearchableDropdownMenuItem>
 *     <SearchableDropdownMenuSub>
 *       <SearchableDropdownMenuSubTrigger>
 *         Submenu
 *       </SearchableDropdownMenuSubTrigger>
 *       <SearchableDropdownMenuSubContent>
 *         <SearchableDropdownMenuItem>Sub Item</SearchableDropdownMenuItem>
 *       </SearchableDropdownMenuSubContent>
 *     </SearchableDropdownMenuSub>
 *   </SearchableDropdownMenuContent>
 * </SearchableDropdownMenu>
 * ```
 */

// Re-export base DropdownMenu
export const SearchableDropdownMenu = DropdownMenu

// Re-export trigger
export const SearchableDropdownMenuTrigger = DropdownMenuPrimitive.Trigger

// Content with integrated search
export interface SearchableDropdownMenuContentProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> {
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  showSearch?: boolean
}

export const SearchableDropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  SearchableDropdownMenuContentProps
>(
  (
    {
      className,
      children,
      searchValue = "",
      onSearchChange,
      searchPlaceholder = "Search...",
      showSearch = true,
      sideOffset = 4,
      ...props
    },
    ref,
  ) => {
    const searchInputRef = React.useRef<HTMLInputElement>(null)
    const { inputClassName } = useOverlaySearchInput(searchInputRef)

    return (
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          className={cn(
            "bg-popover text-popover-foreground z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] max-w-[calc(100vw-1rem)] overflow-x-hidden rounded-md border shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-dropdown-menu-content-transform-origin]",
            className,
          )}
          {...props}
        >
          {showSearch && onSearchChange && (
            <div className="border-b p-0.5">
              <input
                ref={searchInputRef}
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className={cn(
                  "inline-input h-8 w-full border-none bg-transparent px-2 py-1 focus-visible:ring-0 focus-visible:outline-none",
                  inputClassName,
                )}
                onKeyDown={(e) => {
                  // Prevent dropdown from closing on certain keys
                  if (e.key === "Escape") {
                    e.stopPropagation()
                  }
                }}
              />
            </div>
          )}
          <div className="scrollbar-hidden max-h-64 overflow-y-auto p-1">{children}</div>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    )
  },
)
SearchableDropdownMenuContent.displayName = "SearchableDropdownMenuContent"

// Re-export menu item
export const SearchableDropdownMenuItem = DropdownMenuItem

// Re-export submenu primitives for nested menus
export const SearchableDropdownMenuSub = DropdownMenuSub
export const SearchableDropdownMenuSubTrigger = DropdownMenuSubTrigger
export const SearchableDropdownMenuSubContent = DropdownMenuSubContent
export const SearchableDropdownMenuPortal = DropdownMenuPortal
