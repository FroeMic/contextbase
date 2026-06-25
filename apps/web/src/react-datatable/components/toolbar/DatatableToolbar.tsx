import type { Table } from "@tanstack/react-table"
import type { ReactNode } from "react"
import { useShallow } from "zustand/shallow"
import { DatatableViewDropdown } from "../../features/saved-views/DatatableViewDropdown"
import { cn } from "../../shared/utils/cn"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import type { DatatableAppliedStateConfig, DatatableProps } from "../../types/props.types"
import { Button } from "../ui/button"
import { CopyLinkButton } from "./CopyLinkButton"
import { DisplayOptionsButton } from "./DisplayOptionsButton"
import { FilterButton } from "./FilterButton"
import { QuickSearch, type QuickSearchConfig } from "./QuickSearch"

interface DatatableToolbarProps<TData> {
  // Feature toggles
  quickSearch?: boolean | QuickSearchConfig
  filterButton?: boolean
  displayOptions?: boolean
  copyLink?: boolean
  views?: boolean
  appliedState?: DatatableAppliedStateConfig

  // Saved views configuration
  viewsConfig?: DatatableProps<TData>["views"]
  columnVisibilityUI?: DatatableProps<TData>["columnVisibilityUI"]
  displayOptionsConfig?: DatatableProps<TData>["displayOptions"]

  // Custom content
  children?: ReactNode

  // Styling
  className?: string

  // Table instance (required for display options)
  table: Table<TData>
}

/**
 * Main datatable toolbar component
 *
 * Layout: [Left Items] <spacer> [Right Items]
 *
 * Contains slots for:
 * - QuickSearch (left)
 * - FilterButton (left)
 * - SavedViews (right)
 * - DisplayOptions (right)
 *
 * Exported component - uses Datatable prefix
 */
/**
 * Resolve QuickSearch configuration from prop value
 */
const resolveQuickSearchConfig = (config: boolean | QuickSearchConfig): QuickSearchConfig => {
  if (typeof config === "boolean") {
    return {}
  }
  return config
}

export function DatatableToolbar<TData>({
  quickSearch = true,
  filterButton = true,
  displayOptions = true,
  copyLink = true,
  views = false,
  viewsConfig,
  columnVisibilityUI,
  displayOptionsConfig,
  children,
  className,
  table,
}: DatatableToolbarProps<TData>) {
  // Use shallow comparison to prevent re-renders when unrelated store values change
  const { columnFilters, globalFilter, filterMode, toggleFilterMode } = useDatatableStore(
    useShallow((s) => ({
      columnFilters: s.columnFilters,
      globalFilter: s.globalFilter,
      filterMode: s.filterMode,
      toggleFilterMode: s.toggleFilterMode,
    })),
  )

  // Show "Match all/any" button when:
  // - Multiple column filters (e.g., Name + Email filters)
  // - OR when there's QuickSearch + at least one column filter
  const hasGlobalFilter = Boolean(globalFilter && globalFilter.trim())
  const shouldShowFilterModeToggle =
    columnFilters.length > 1 || (hasGlobalFilter && columnFilters.length >= 1)

  return (
    <div
      className={cn(
        "@container bg-background border-b",
        "px-4 py-2", // Desktop
        "max-sm:px-2 max-sm:py-1.5", // Mobile
        "max-sm:sticky max-sm:left-0 max-sm:z-20 max-sm:box-border max-sm:w-[var(--rdt-mobile-toolbar-width,100%)] max-sm:max-w-full",
        className,
      )}
    >
      {/* Single-row layout - shown when container is wide (@lg and up) */}
      <div className="@max-[532px]:hidden flex items-center gap-2 max-sm:!hidden max-sm:gap-1.5">
        {/* Left section */}
        <div className="flex items-center gap-2 max-sm:gap-1.5">
          {quickSearch && <QuickSearch config={resolveQuickSearchConfig(quickSearch)} />}
          {filterButton && <FilterButton />}
          {children}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right section */}
        <div className="flex items-center gap-2 max-sm:gap-1.5">
          {views && (
            <DatatableViewDropdown viewsConfig={viewsConfig} currentUserId={viewsConfig?.userId} />
          )}
          {displayOptions && (
            <DisplayOptionsButton
              table={table}
              columnVisibilityUI={columnVisibilityUI}
              displayOptionsConfig={displayOptionsConfig}
            />
          )}
          {copyLink && <CopyLinkButton />}
        </div>
      </div>

      {/* Multi-row layout - shown when container is narrow (below @lg) */}
      <div className="@min-[533px]:hidden flex flex-col gap-2 max-sm:!flex max-sm:gap-1.5">
        {/* Row 1: QuickSearch + Filter */}
        <div className="flex min-w-0 items-center gap-2 max-sm:gap-1.5">
          {quickSearch && (
            <div className="min-w-0 flex-1">
              <QuickSearch config={resolveQuickSearchConfig(quickSearch)} />
            </div>
          )}
          {filterButton && <FilterButton />}
          {children}
        </div>

        {/* Row 2: Views on left, Display+Copy on right */}
        <div className="flex min-w-0 items-center justify-between gap-2 max-sm:gap-1.5">
          <div className="flex min-w-0 items-center gap-2 max-sm:gap-1.5">
            {views && (
              <DatatableViewDropdown
                viewsConfig={viewsConfig}
                currentUserId={viewsConfig?.userId}
              />
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 max-sm:gap-1.5">
            {displayOptions && (
              <DisplayOptionsButton
                table={table}
                columnVisibilityUI={columnVisibilityUI}
                displayOptionsConfig={displayOptionsConfig}
              />
            )}
            {copyLink && <CopyLinkButton />}
          </div>
        </div>

        {/* Row 3: Match all/any only. Clear is hidden in the wrapped toolbar state. */}
        {shouldShowFilterModeToggle && (
          <div className="flex items-center justify-end gap-2 max-sm:gap-1.5">
            {/* Match all/any button - show when multiple filters or QuickSearch + column filter */}
            <Button
              variant="ghost"
              size="xs"
              className="text-foreground/60 font-medium"
              onClick={toggleFilterMode}
            >
              {filterMode === "AND" ? "Match all" : "Match any"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
