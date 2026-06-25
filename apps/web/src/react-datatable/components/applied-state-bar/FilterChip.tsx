import { memo, useState } from "react"
import { useIsMobile } from "@/shared/hooks/use-mobile"
import { useDatatableColumns } from "../../core/DatatableProvider"
import {
  isBooleanFilterPayload,
  isDateFilterPayload,
  isIdListFilterPayload,
  isNumberFilterPayload,
  isTextFilterPayload,
  isTextListFilterPayload,
} from "../../features/filters/filter-type-guards"
import type { ColumnFilter } from "../../types/filter.types"
import { DatatableMobileDrawerNavigator } from "../mobile/DatatableMobileDrawerNavigator"
import { XIcon } from "../ui/icons"
import { BooleanFilterChip } from "./BooleanFilterChip"
import { DateFilterChip } from "./DateFilterChip"
import { GenericFilterChip } from "./GenericFilterChip"
import { IdListFilterChip } from "./IdListFilterChip"
import {
  FILTER_CHIP_DRAWER_INITIAL_PAGE,
  FILTER_CHIP_DRAWER_INITIAL_PARAMS,
  type FilterChipDrawerPageId,
  type FilterChipDrawerPageParams,
  useMobileFilterChipDrawerPages,
} from "./MobileFilterChipDrawerContent"
import { NumberFilterChip } from "./NumberFilterChip"
import { TextFilterChip } from "./TextFilterChip"
import { TextListFilterChip } from "./TextListFilterChip"

interface FilterChipProps {
  filter: ColumnFilter
  onRemove: () => void
}

/**
 * Filter chip router component
 *
 * Routes to the appropriate specialized chip component based on filter type:
 * - Text filters → TextFilterChip (single & multi-condition support)
 * - Text-list filters → TextListFilterChip (multi-select checkbox list)
 * - Date filters → DateFilterChip (preset or custom date ranges)
 * - Number filters → NumberFilterChip (single & multi-condition support)
 * - Other filters → GenericFilterChip (fallback for unimplemented types)
 *
 * This component is intentionally lightweight - all rendering logic lives in
 * the specialized chip components for better separation of concerns.
 *
 * Benefits of this architecture:
 * - Single Responsibility Principle: Each chip handles one filter type
 * - Easier testing: Test each chip variant independently
 * - Conditional hooks: Hooks only run for relevant filter types
 * - Easy to extend: Add new chip types without modifying this router
 *
 * Performance:
 * - React.memo prevents re-renders when other filters change
 * - Only re-renders when its own filter or columns change
 */
export const FilterChip = memo(({ filter, onRemove }: FilterChipProps) => {
  const columns = useDatatableColumns()
  const column = columns.find((c) => c.id === filter.id)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isMobile = useIsMobile()
  const mobilePages = useMobileFilterChipDrawerPages({
    column,
    filter,
  })

  // Column not found - return null
  if (!column) {
    return null
  }

  if (isMobile) {
    return (
      <>
        <div className="bg-background inline-flex h-7 items-center divide-x overflow-hidden rounded-full border text-sm">
          <button
            className="hover:bg-accent h-full px-2 font-medium transition-colors"
            onClick={() => setDrawerOpen(true)}
            type="button"
          >
            {column.header}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="hover:bg-accent text-muted-foreground hover:text-foreground h-full px-2 transition-colors"
            aria-label={`Remove ${column.header} filter`}
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <DatatableMobileDrawerNavigator<FilterChipDrawerPageId, FilterChipDrawerPageParams>
          initialPage={FILTER_CHIP_DRAWER_INITIAL_PAGE}
          initialParams={FILTER_CHIP_DRAWER_INITIAL_PARAMS}
          onOpenChange={setDrawerOpen}
          open={drawerOpen}
          pages={mobilePages}
        />
      </>
    )
  }

  // Route to text filter chip if text filter
  if (isTextFilterPayload(filter.payload)) {
    return <TextFilterChip column={column} filter={filter} onRemove={onRemove} />
  }

  // Route to text-list filter chip if text-list filter
  if (isTextListFilterPayload(filter.payload)) {
    return <TextListFilterChip column={column} filter={filter} onRemove={onRemove} />
  }

  if (isBooleanFilterPayload(filter.payload)) {
    return <BooleanFilterChip column={column} filter={filter} onRemove={onRemove} />
  }

  if (isIdListFilterPayload(filter.payload)) {
    return <IdListFilterChip column={column} filter={filter} onRemove={onRemove} />
  }

  // Route to date filter chip if date filter
  if (isDateFilterPayload(filter.payload)) {
    return <DateFilterChip column={column} filter={filter} onRemove={onRemove} />
  }

  // Route to number filter chip if number filter
  if (isNumberFilterPayload(filter.payload)) {
    return <NumberFilterChip column={column} filter={filter} onRemove={onRemove} />
  }

  // Fallback to generic chip for unimplemented filter types
  return <GenericFilterChip column={column} filter={filter} onRemove={onRemove} />
})

FilterChip.displayName = "FilterChip"
