"use client"

import type { Table } from "@tanstack/react-table"
import { Button } from "../../components/ui/button"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import type { DatatableProps } from "../../types/props.types"
import { ColumnVisibilitySection } from "../column-visibility/ColumnVisibilitySection"
import { DisplaySettingsSection } from "./DisplaySettingsSection"
import { FreezeColumnsSection } from "./FreezeColumnsSection"
import { GroupingSection } from "./GroupingSection"
import { OrderingSection } from "./OrderingSection"
import { QueryOptionsSection } from "./QueryOptionsSection"

/**
 * Display Options Popover
 * Main container for all display configuration sections
 *
 * Contains sections for:
 * - Column visibility
 * - Display settings (show headers, etc.)
 * - Grouping controls
 * - Sorting controls
 * - Column widths (future)
 */

interface DisplayOptionsPopoverProps<TData> {
  table: Table<TData>
  columnVisibilityUI?: DatatableProps<TData>["columnVisibilityUI"]
  displayOptionsConfig?: DatatableProps<TData>["displayOptions"]
  variant?: "default" | "mobile"
}

export function DisplayOptionsPopover<TData>({
  table,
  columnVisibilityUI,
  displayOptionsConfig,
  variant = "default",
}: DisplayOptionsPopoverProps<TData>) {
  const resetDisplayOptions = useDatatableStore((s) => s.resetDisplayOptions)
  const resetQueryOptions = useDatatableStore((s) => s.resetQueryOptions)
  const sections =
    typeof displayOptionsConfig === "object" ? displayOptionsConfig.sections : undefined
  const queryOptions =
    typeof displayOptionsConfig === "object" ? (displayOptionsConfig.queryOptions ?? []) : []
  const showQueryOptions = sections?.queryOptions !== false && queryOptions.length > 0

  const handleReset = () => {
    resetDisplayOptions()
    if (showQueryOptions) {
      resetQueryOptions()
    }
  }

  return (
    <div className="divide-y">
      {/* Grouping and Ordering section - combined without divider */}
      {(sections?.grouping !== false || sections?.ordering !== false) && (
        <div className={variant === "mobile" ? "space-y-4 px-4 py-3" : "space-y-3 px-3 py-2.5"}>
          {sections?.grouping !== false && <GroupingSection table={table} variant={variant} />}
          {sections?.ordering !== false && <OrderingSection variant={variant} />}
        </div>
      )}

      {/* Freeze Columns section */}
      {sections?.freezeColumns !== false && (
        <div className={variant === "mobile" ? "px-4 py-3" : "px-3 py-2.5"}>
          <FreezeColumnsSection table={table} variant={variant} />
        </div>
      )}

      {/* Domain query options section */}
      {showQueryOptions && (
        <div className={variant === "mobile" ? "px-4 py-3" : "px-3 py-2.5"}>
          <QueryOptionsSection options={queryOptions} variant={variant} />
        </div>
      )}

      {/* Display settings section */}
      {sections?.displaySettings !== false && (
        <div className={variant === "mobile" ? "px-4 py-3" : "px-3 py-2.5"}>
          <DisplaySettingsSection
            config={typeof displayOptionsConfig === "object" ? displayOptionsConfig : undefined}
            variant={variant}
          />
        </div>
      )}

      {/* Column visibility section */}
      {sections?.columnVisibility !== false && (
        <div className={variant === "mobile" ? "px-4 py-3" : "px-3 py-2.5"}>
          <ColumnVisibilitySection ui={columnVisibilityUI} variant={variant} />
        </div>
      )}

      {/* Future sections will be added here:
          - <ColumnWidthsSection />
      */}

      {/* Reset button */}
      <div className={variant === "mobile" ? "flex justify-end px-4 py-3" : "flex justify-end px-3 py-2.5"}>
        <Button
          variant="ghost"
          size="sm"
          className={
            variant === "mobile"
              ? "focus-visible:outline-ring h-10 text-sm focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-1"
              : "focus-visible:outline-ring h-7 !text-xs focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-1"
          }
          onClick={handleReset}
        >
          Reset
        </Button>
      </div>
    </div>
  )
}
