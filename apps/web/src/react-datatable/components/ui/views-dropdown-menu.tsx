/**
 * ViewsDropdownMenu - Specialized dropdown menu for saved views
 *
 * Extends SearchableDropdownMenu with:
 * - Section headers (non-focusable in keyboard navigation)
 * - Composite item support (items with multiple interactive zones)
 * - Enhanced keyboard navigation for complex view items
 *
 * This is NOT a generic component - it's specifically tailored for the ViewsButton use case.
 * For simpler dropdowns with search, use SearchableDropdownMenu instead.
 */

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import * as React from "react"
import { useOverlaySearchInput } from "../../shared/hooks/use-overlay-search-input"
import { cn } from "../../shared/utils/cn"
import { DropdownMenu, DropdownMenuSeparator } from "./dropdown-menu"

// Re-export base DropdownMenu
export const ViewsDropdownMenu = DropdownMenu

// Re-export trigger
export const ViewsDropdownMenuTrigger = DropdownMenuPrimitive.Trigger

// Content with integrated search
export interface ViewsDropdownMenuContentProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> {
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  showSearch?: boolean
  searchInputRef?: React.Ref<HTMLInputElement>
  onSearchKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

export const ViewsDropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  ViewsDropdownMenuContentProps
>(
  (
    {
      className,
      children,
      searchValue = "",
      onSearchChange,
      searchPlaceholder = "Search...",
      showSearch = true,
      searchInputRef,
      onSearchKeyDown,
      sideOffset = 4,
      ...props
    },
    ref,
  ) => {
    const internalSearchInputRef = React.useRef<HTMLInputElement>(null)
    const { inputClassName } = useOverlaySearchInput(internalSearchInputRef)

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
            <div className="bg-popover sticky top-0 z-10 border-b p-0.5">
              <input
                ref={(node) => {
                  internalSearchInputRef.current = node
                  if (!searchInputRef) {
                    return
                  }
                  if ("current" in searchInputRef) {
                    searchInputRef.current = node
                  } else {
                    searchInputRef(node)
                  }
                }}
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (onSearchKeyDown) {
                    onSearchKeyDown(e)
                  }
                }}
                placeholder={searchPlaceholder}
                className={cn(
                  "inline-input h-8 w-full border-none bg-transparent px-2 py-1 focus-visible:ring-0 focus-visible:outline-none",
                  inputClassName,
                )}
              />
            </div>
          )}
          <div className="scrollbar-hidden max-h-64 overflow-y-auto p-1">{children}</div>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    )
  },
)
ViewsDropdownMenuContent.displayName = "ViewsDropdownMenuContent"

// Section header - non-focusable label for grouping views
export interface ViewsDropdownMenuSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const ViewsDropdownMenuSection = React.forwardRef<
  HTMLDivElement,
  ViewsDropdownMenuSectionProps
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("px-1 py-1 text-xs text-muted-foreground", className)}
      role="presentation"
      {...props}
    >
      {children}
    </div>
  )
})
ViewsDropdownMenuSection.displayName = "ViewsDropdownMenuSection"

// Separator with tabIndex to prevent focus
export const ViewsDropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuSeparator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuSeparator>
>((props, ref) => {
  return <DropdownMenuSeparator ref={ref} tabIndex={-1} {...props} />
})
ViewsDropdownMenuSeparator.displayName = "ViewsDropdownMenuSeparator"
