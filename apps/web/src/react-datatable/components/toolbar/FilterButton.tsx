import { useState } from "react"
import { useIsMobile } from "@/shared/hooks/use-mobile"
import { FilterDropdown } from "../../features/filters/FilterDropdown"
import {
  FILTER_DRAWER_INITIAL_PAGE,
  FILTER_DRAWER_INITIAL_PARAMS,
  type FilterDrawerPageId,
  type FilterDrawerPageParams,
  MOBILE_FILTER_DRAWER_PAGES,
} from "../../features/filters/MobileFilterDrawerContent"
import { cn } from "../../shared/utils/cn"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import { DatatableMobileDrawerNavigator } from "../mobile/DatatableMobileDrawerNavigator"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { FunnelSimpleIcon } from "../ui/icons"
import {
  SearchableDropdownMenu,
  SearchableDropdownMenuContent,
  SearchableDropdownMenuTrigger,
} from "../ui/searchable-dropdown-menu"

/**
 * Filter button in toolbar
 *
 * Opens a dropdown menu showing available filters with search.
 * Shows badge with active filter count when filters are applied.
 *
 * Optimization: Only subscribes to columnFilters.length to minimize re-renders
 */
export const FilterButton = () => {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()

  // Only subscribe to filter count, not the full filters array
  // This prevents re-renders when filter values change
  const filterCount = useDatatableStore((s) => s.columnFilters.length)

  if (isMobile) {
    return (
      <>
        <Button
          aria-expanded={open}
          className={cn(
            "h-11 rounded-full px-4 text-sm",
            open && "bg-accent text-accent-foreground",
          )}
          onClick={() => setOpen(true)}
          size="xs"
          variant="ghost"
        >
          <FunnelSimpleIcon className="h-4" />
          Filter
          {filterCount > 0 && (
            <Badge className="ml-2" variant="secondary">
              {filterCount}
            </Badge>
          )}
        </Button>
        <DatatableMobileDrawerNavigator<FilterDrawerPageId, FilterDrawerPageParams>
          initialPage={FILTER_DRAWER_INITIAL_PAGE}
          initialParams={FILTER_DRAWER_INITIAL_PARAMS}
          onOpenChange={setOpen}
          open={open}
          pages={MOBILE_FILTER_DRAWER_PAGES}
        />
      </>
    )
  }

  return (
    <SearchableDropdownMenu open={open} onOpenChange={setOpen}>
      <SearchableDropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          className={cn("rounded-full px-3.5", open && "bg-accent text-accent-foreground")}
        >
          <FunnelSimpleIcon className="h-4" />
          Filter
          {filterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {filterCount}
            </Badge>
          )}
        </Button>
      </SearchableDropdownMenuTrigger>
      <SearchableDropdownMenuContent className="w-64" align="start" showSearch={false}>
        <FilterDropdown onClose={() => setOpen(false)} />
      </SearchableDropdownMenuContent>
    </SearchableDropdownMenu>
  )
}
