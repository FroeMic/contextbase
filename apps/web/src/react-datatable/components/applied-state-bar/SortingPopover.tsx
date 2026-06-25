import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useCallback, useMemo, useState } from "react"
import { useDatatableColumns } from "../../core/DatatableProvider"
import { cn } from "../../shared/utils/cn"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import { Button } from "../ui/button"
import { ArrowDownIcon, ArrowUpIcon, CaretDownIcon, DotsSixVertical, XIcon } from "../ui/icons"
import { SearchableDropdown } from "../ui/searchable-dropdown"

/**
 * Sorting popover content
 *
 * Shows list of applied sorts with:
 * - Drag handle for reordering
 * - Column name
 * - Direction toggle button (asc/desc)
 * - Remove button
 *
 * Below the list: dropdown to add another sort column
 */
interface SortingPopoverProps {
  variant?: "default" | "mobile"
}

export function SortingPopover({ variant = "default" }: SortingPopoverProps) {
  const columns = useDatatableColumns()
  const sorting = useDatatableStore((s) => s.sorting)
  const setSorting = useDatatableStore((s) => s.setSorting)
  const reorderSorting = useDatatableStore((s) => s.reorderSorting)
  const toggleSortDirection = useDatatableStore((s) => s.toggleSortDirection)

  const [addDropdownOpen, setAddDropdownOpen] = useState(false)

  // Get unsorted columns for the "add" dropdown
  const sortedColumnIds = useMemo(() => new Set(sorting.map((s) => s.id)), [sorting])
  const unsortedColumns = useMemo(
    () => columns.filter((c) => !sortedColumnIds.has(c.id) && c.enableSorting !== false),
    [columns, sortedColumnIds],
  )

  // Drag & drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before activating drag
      },
    }),
    useSensor(KeyboardSensor),
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (over && active.id !== over.id) {
        const oldIndex = sorting.findIndex((s) => s.id === active.id)
        const newIndex = sorting.findIndex((s) => s.id === over.id)

        const newOrder = arrayMove(sorting, oldIndex, newIndex)
        reorderSorting(newOrder)
      }
    },
    [sorting, reorderSorting],
  )

  const handleAddSort = useCallback(
    (column: (typeof unsortedColumns)[number]) => {
      // Add new sort as ascending
      setSorting([...sorting, { id: column.id, desc: false }])
      setAddDropdownOpen(false)
    },
    [sorting, setSorting],
  )

  const handleRemoveSort = useCallback(
    (columnId: string) => {
      setSorting(sorting.filter((s) => s.id !== columnId))
    },
    [sorting, setSorting],
  )

  const handleToggleDirection = useCallback(
    (columnId: string) => {
      toggleSortDirection(columnId)
    },
    [toggleSortDirection],
  )

  return (
    <div className={cn("w-72 p-2", variant === "mobile" && "w-full p-2")}>
      {/* Sort items list */}
      {sorting.length > 0 && (
        <div className="mb-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sorting.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {sorting.map((sort) => {
                const column = columns.find((c) => c.id === sort.id)
                if (!column) {
                  return null
                }

                return (
                  <SortableItem
                    key={sort.id}
                    id={sort.id}
                    columnName={column.meta?.displayName ?? column.header}
                    isDesc={sort.desc}
                    onToggleDirection={() => handleToggleDirection(sort.id)}
                    onRemove={() => handleRemoveSort(sort.id)}
                    variant={variant}
                  />
                )
              })}
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Add sort dropdown */}
      {unsortedColumns.length > 0 && (
        <div
          className={cn(
            "flex items-center justify-between gap-2 py-1",
            variant === "mobile" && "py-2",
          )}
        >
          <span
            className={cn("text-muted-foreground ml-2 text-xs", variant === "mobile" && "text-sm")}
          >
            Add Column
          </span>
          <SearchableDropdown
            open={addDropdownOpen}
            onOpenChange={setAddDropdownOpen}
            items={unsortedColumns}
            getItemKey={(col) => col.id}
            renderItem={(col) => col.meta?.displayName ?? col.header}
            onSelect={handleAddSort}
            filterFn={(col, search) => {
              const name = col.meta?.displayName ?? col.header
              return name.toLowerCase().includes(search.toLowerCase())
            }}
            searchPlaceholder="Search columns..."
            emptyText="No columns found"
            align="end"
            width="w-48"
            variant={variant}
          >
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "text-muted-foreground h-6 min-w-[120px] justify-between px-2 text-xs font-normal",
                variant === "mobile" && "h-10 min-w-40 text-sm",
              )}
            >
              Select column
              <CaretDownIcon
                className={cn("ml-1.5 h-3 w-3 opacity-50", variant === "mobile" && "h-4 w-4")}
              />
            </Button>
          </SearchableDropdown>
        </div>
      )}
    </div>
  )
}

interface SortableItemProps {
  id: string
  columnName: string
  isDesc: boolean
  onToggleDirection: () => void
  onRemove: () => void
  variant?: "default" | "mobile"
}

function SortableItem({
  id,
  columnName,
  isDesc,
  onToggleDirection,
  onRemove,
  variant = "default",
}: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "mb-0.5 flex items-center gap-2 py-1 text-xs",
        variant === "mobile" && "h-11 py-2 text-sm",
        isDragging && "opacity-50",
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring cursor-grab rounded p-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <DotsSixVertical className={cn("h-4 w-4", variant === "mobile" && "h-5 w-5")} />
      </button>

      {/* Column name */}
      <span className="flex-1 font-medium">{columnName}</span>

      {/* Direction toggle button */}
      <Button
        variant="outline"
        size="icon-sm"
        className={cn("h-5 w-5 p-0", variant === "mobile" && "h-9 w-9")}
        onClick={onToggleDirection}
      >
        {isDesc ? (
          <ArrowDownIcon className={cn("size-3", variant === "mobile" && "size-4")} />
        ) : (
          <ArrowUpIcon className={cn("size-3", variant === "mobile" && "size-4")} />
        )}
      </Button>

      {/* Remove button */}
      <Button
        variant="outline"
        size="icon-sm"
        className={cn(
          "text-muted-foreground hover:text-foreground h-5 w-5 p-0",
          variant === "mobile" && "h-9 w-9",
        )}
        onClick={onRemove}
        aria-label={`Remove ${columnName} sort`}
      >
        <XIcon className={cn("size-3", variant === "mobile" && "size-4")} />
      </Button>
    </div>
  )
}
