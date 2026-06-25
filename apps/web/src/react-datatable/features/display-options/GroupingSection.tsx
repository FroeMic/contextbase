"use client"

import type { Column, RowData, Table } from "@tanstack/react-table"
import { memo, useCallback, useMemo, useState } from "react"
import { useShallow } from "zustand/shallow"
import { Button } from "../../components/ui/button"
import { ArrowsLeftRight, CaretDown, Gradient, List } from "../../components/ui/icons"
import { SearchableDropdown } from "../../components/ui/searchable-dropdown"
import { cn } from "../../shared/utils/cn"
import { useDatatableStore } from "../../state/store/use-datatable-store"

/**
 * GroupingSection Component
 * UI for selecting columns to group by (up to 2 levels)
 *
 * Design matches Linear:
 * - Searchable dropdown for primary group
 * - Searchable dropdown for secondary group (shown when primary is selected)
 * - Swap button to reorder levels
 * - Helper text below dropdowns
 */

interface GroupingSectionProps<TData> {
  table: Table<TData>
  variant?: "default" | "mobile"
}

type GroupingItem = { type: "none" } | { type: "column"; id: string; name: string }

function getGroupingColumnLabel<TData extends RowData>(column: Column<TData, unknown>) {
  const header = column.columnDef.header
  const headerLabel = typeof header === "string" ? header : column.id
  return column.columnDef.meta?.displayName ?? headerLabel
}

function GroupingSectionInner<TData>({ table, variant = "default" }: GroupingSectionProps<TData>) {
  const { grouping, setGrouping } = useDatatableStore(
    useShallow((s) => ({ grouping: s.grouping, setGrouping: s.setGrouping })),
  )
  const [primaryOpen, setPrimaryOpen] = useState(false)
  const [secondaryOpen, setSecondaryOpen] = useState(false)

  // Get all columns that support row grouping
  const groupableColumns = useMemo(() => {
    return table.getAllColumns().filter((col) => {
      return col.columnDef.enableGrouping === true || col.columnDef.meta?.enableRowGrouping === true
    })
  }, [table])

  const primaryGroupColumn = grouping[0]
  const secondaryGroupColumn = grouping[1]

  // Build items for primary dropdown
  const primaryItems = useMemo((): GroupingItem[] => {
    return [
      { type: "none" as const },
      ...groupableColumns.map((col) => ({
        type: "column" as const,
        id: col.id,
        name: getGroupingColumnLabel(col),
      })),
    ]
  }, [groupableColumns])

  // Build items for secondary dropdown (exclude primary)
  const secondaryItems = useMemo((): GroupingItem[] => {
    const availableColumns = groupableColumns.filter((col) => col.id !== primaryGroupColumn)
    return [
      { type: "none" as const },
      ...availableColumns.map((col) => ({
        type: "column" as const,
        id: col.id,
        name: getGroupingColumnLabel(col),
      })),
    ]
  }, [groupableColumns, primaryGroupColumn])

  const handlePrimarySelect = useCallback(
    (item: GroupingItem) => {
      if (item.type === "none") {
        setGrouping([])
      } else {
        // Set primary, preserve secondary if it's not the same
        if (secondaryGroupColumn && secondaryGroupColumn !== item.id) {
          setGrouping([item.id, secondaryGroupColumn])
        } else {
          setGrouping([item.id])
        }
      }
    },
    [setGrouping, secondaryGroupColumn],
  )

  const handleSecondarySelect = useCallback(
    (item: GroupingItem) => {
      if (item.type === "none") {
        setGrouping([primaryGroupColumn])
      } else {
        setGrouping([primaryGroupColumn, item.id])
      }
    },
    [setGrouping, primaryGroupColumn],
  )

  const swapGroupingLevels = useCallback(() => {
    if (primaryGroupColumn && secondaryGroupColumn) {
      setGrouping([secondaryGroupColumn, primaryGroupColumn])
    }
  }, [primaryGroupColumn, secondaryGroupColumn, setGrouping])

  const primaryLabel = primaryGroupColumn
    ? (() => {
        const column = groupableColumns.find((c) => c.id === primaryGroupColumn)
        return column ? getGroupingColumnLabel(column) : "Select column"
      })()
    : "None"

  const secondaryLabel = secondaryGroupColumn
    ? (() => {
        const column = groupableColumns.find((c) => c.id === secondaryGroupColumn)
        return column ? getGroupingColumnLabel(column) : "Select column"
      })()
    : "No grouping"

  return (
    <div className={cn("flex flex-col gap-2", variant === "mobile" && "gap-3")}>
      {/* Primary Grouping Row */}
      <div className="flex items-center justify-between gap-2">
        {/* Label with icon */}
        <div
          className={cn(
            "text-muted-foreground flex items-center gap-1.5 text-xs",
            variant === "mobile" && "text-sm",
          )}
        >
          <List className={cn("h-3.5 w-3.5 opacity-60", variant === "mobile" && "h-4 w-4")} />
          <span>Grouping</span>
        </div>

        {/* Dropdown */}
        <div className="flex items-center gap-1.5">
          <SearchableDropdown
            open={primaryOpen}
            onOpenChange={setPrimaryOpen}
            items={primaryItems}
            getItemKey={(item) => (item.type === "none" ? "none" : item.id)}
            renderItem={(item) => (item.type === "none" ? "None" : item.name)}
            onSelect={handlePrimarySelect}
            filterFn={(item, search) => {
              if (item.type === "none") {
                return "none".includes(search.toLowerCase())
              }
              return item.name.toLowerCase().includes(search.toLowerCase())
            }}
            searchPlaceholder="Search columns..."
            emptyText="No columns found"
            align="end"
            width="w-56"
          >
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-6 w-40 justify-between px-2 !text-xs font-normal",
                variant === "mobile" && "h-9 min-w-40 rounded-full !text-sm font-normal",
              )}
            >
              <span className="truncate">{primaryLabel}</span>
              <CaretDown
                className={cn(
                  "ml-1.5 h-3 w-3 flex-shrink-0 opacity-50",
                  variant === "mobile" && "h-4 w-4",
                )}
              />
            </Button>
          </SearchableDropdown>
        </div>
      </div>

      {/* Secondary Grouping Row (SubGroup) - Only show when primary is active */}
      {primaryGroupColumn && (
        <div className="flex items-center justify-between gap-2">
          {/* Label with icon */}
          <div
            className={cn(
              "text-muted-foreground flex items-center gap-1.5 text-xs",
              variant === "mobile" && "text-sm",
            )}
          >
            <Gradient className={cn("h-3.5 w-3.5 opacity-60", variant === "mobile" && "h-4 w-4")} />
            <span>SubGroup</span>
          </div>

          {/* Swap button and dropdown */}
          <div className="flex items-center gap-1.5">
            {/* Swap button - only show when both levels are active */}
            {secondaryGroupColumn && (
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-6 w-6 p-0", variant === "mobile" && "h-9 w-9 rounded-full")}
                onClick={swapGroupingLevels}
                title="Swap grouping levels"
              >
                <ArrowsLeftRight className={cn("h-3.5 w-3.5", variant === "mobile" && "h-4 w-4")} />
              </Button>
            )}

            <SearchableDropdown
              open={secondaryOpen}
              onOpenChange={setSecondaryOpen}
              items={secondaryItems}
              getItemKey={(item) => (item.type === "none" ? "none" : item.id)}
              renderItem={(item) => (item.type === "none" ? "No grouping" : item.name)}
              onSelect={handleSecondarySelect}
              filterFn={(item, search) => {
                if (item.type === "none") {
                  return "no grouping".includes(search.toLowerCase())
                }
                return item.name.toLowerCase().includes(search.toLowerCase())
              }}
              searchPlaceholder="Search columns..."
              emptyText="No columns found"
              align="end"
              width="w-56"
            >
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-6 w-40 justify-between px-2 !text-xs font-normal",
                  variant === "mobile" && "h-9 min-w-40 rounded-full !text-sm font-normal",
                )}
              >
                <span className="truncate">{secondaryLabel}</span>
                <CaretDown
                  className={cn(
                    "ml-1.5 h-3 w-3 flex-shrink-0 opacity-50",
                    variant === "mobile" && "h-4 w-4",
                  )}
                />
              </Button>
            </SearchableDropdown>
          </div>
        </div>
      )}
    </div>
  )
}

// Properly memoized generic component with correct typing
export const GroupingSection = memo(GroupingSectionInner) as typeof GroupingSectionInner
