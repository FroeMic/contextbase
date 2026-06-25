"use client"

import { DndContext, DragOverlay } from "@dnd-kit/core"
import { useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "../../components/ui/button"
import { CaretDown } from "../../components/ui/icons"
import { Label } from "../../components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover"
import { useDatatableColumns } from "../../core/DatatableProvider"
import { cn } from "../../shared/utils/cn"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import { ColumnVisibilityDropdownContent } from "./ColumnVisibilityDropdownContent"
import {
  type ColumnVisibilityBucket,
  type ColumnVisibilityPresentationItem,
  type ColumnVisibilityUIConfig,
  resolveColumnVisibilityMode,
} from "./column-visibility-presentation"
import {
  useColumnVisibilityBucketDropZone,
  useColumnVisibilityDnd,
  useColumnVisibilityDragItem,
} from "./use-column-visibility-dnd"

interface ColumnVisibilitySectionProps {
  ui?: ColumnVisibilityUIConfig
  variant?: "default" | "mobile"
}

interface ColumnVisibilityBadgeProps {
  item: ColumnVisibilityPresentationItem
  sortable: boolean
  onToggleColumn: (columnId: string) => void
}

interface ColumnVisibilityBadgeSectionProps {
  items: ColumnVisibilityPresentationItem[]
  onToggleColumn: (columnId: string) => void
  activeItemId?: string | null
  dropBucket: ColumnVisibilityBucket
}

function ColumnVisibilityBadge({ item, sortable, onToggleColumn }: ColumnVisibilityBadgeProps) {
  const dragItem = useColumnVisibilityDragItem(item.id, !sortable)

  return (
    <div ref={dragItem.setNodeRef} className="min-w-0">
      <div
        {...dragItem.attributes}
        {...dragItem.listeners}
        className={cn(
          "inline-flex max-w-full items-center rounded-full border",
          sortable ? "cursor-grab active:cursor-grabbing" : "cursor-default",
          item.isVisible
            ? "border-border bg-transparent text-foreground"
            : "bg-accent/5 border-border/30 text-muted-foreground",
        )}
      >
        <button
          type="button"
          onClick={() => onToggleColumn(item.id)}
          className="flex h-5 min-w-0 items-center px-2 !text-xs font-normal"
        >
          <span className="truncate">{item.label}</span>
        </button>
      </div>
    </div>
  )
}

function ColumnVisibilityProjectedBadge({ item }: { item: ColumnVisibilityPresentationItem }) {
  return (
    <div className="min-w-0 opacity-15">
      <div
        className={cn(
          "inline-flex max-w-full items-center rounded-full border",
          item.isVisible
            ? "border-border bg-transparent text-foreground"
            : "bg-accent/5 border-border/30 text-muted-foreground",
        )}
      >
        <div className="flex h-5 min-w-0 items-center px-2 !text-xs font-normal">
          <span className="truncate">{item.label}</span>
        </div>
      </div>
    </div>
  )
}

function ColumnVisibilityBadgeOverlay({ item }: { item: ColumnVisibilityPresentationItem }) {
  return (
    <div className="pointer-events-none rounded-full border border-accent/70 bg-background ring-2 ring-accent/30 shadow-2xl backdrop-blur-[2px]">
      <div
        className={cn(
          "inline-flex max-w-full items-center rounded-full border",
          item.isVisible
            ? "border-border bg-transparent text-foreground"
            : "bg-accent/5 border-border/30 text-muted-foreground",
        )}
      >
        <div className="flex h-5 min-w-0 items-center px-2 !text-xs font-normal">
          <span className="whitespace-nowrap">{item.label}</span>
        </div>
      </div>
    </div>
  )
}

function ColumnVisibilityBadgeSection({
  items,
  onToggleColumn,
  activeItemId,
  dropBucket,
}: ColumnVisibilityBadgeSectionProps) {
  const dropZone = useColumnVisibilityBucketDropZone(dropBucket, false)

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 p-0.5">
        {items.map((item) =>
          item.id === activeItemId ? (
            <ColumnVisibilityProjectedBadge key={item.id} item={item} />
          ) : (
            <ColumnVisibilityBadge
              key={item.id}
              item={item}
              sortable={items.length > 1}
              onToggleColumn={onToggleColumn}
            />
          ),
        )}
        <div ref={dropZone.setNodeRef} className="h-0 w-full overflow-hidden" />
      </div>
    </div>
  )
}

export const ColumnVisibilitySection = ({
  ui,
  variant = "default",
}: ColumnVisibilitySectionProps) => {
  const columns = useDatatableColumns()
  const columnVisibility = useDatatableStore((s) => s.columnVisibility)
  const columnOrder = useDatatableStore((s) => s.columnOrder)
  const setColumnOrder = useDatatableStore((s) => s.setColumnOrder)
  const setColumnVisibility = useDatatableStore((s) => s.setColumnVisibility)
  const toggleColumnVisibility = useDatatableStore((s) => s.toggleColumnVisibility)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const {
    model,
    displayModel,
    sensors,
    collisionDetection,
    activeItem,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useColumnVisibilityDnd({
    columns,
    columnOrder,
    columnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
  })

  const resolvedMode = resolveColumnVisibilityMode(ui, model.hideableCount)

  if (resolvedMode === "dropdown") {
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="pb-0.5">
          <Label
            className={cn(
              "text-muted-foreground !text-xs font-medium",
              variant === "mobile" && "!text-sm",
            )}
          >
            Column Visibility
          </Label>
        </div>

        <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-6 min-w-[170px] justify-between px-2 !text-xs font-normal",
                variant === "mobile" && "h-9 min-w-40 rounded-full !text-sm font-normal",
              )}
              aria-label="Configure column visibility"
              aria-expanded={dropdownOpen}
              aria-haspopup="dialog"
            >
              {`${model.visibleItems.length} visible / ${model.hiddenItems.length} hidden`}
              <CaretDown
                className={cn("ml-1.5 h-3 w-3 opacity-50", variant === "mobile" && "h-4 w-4")}
              />
            </Button>
          </PopoverTrigger>

          <PopoverContent
            align="end"
            className="pointer-events-auto z-[120] w-72 p-0 shadow-lg"
            data-rdt-nested-popover-content="true"
          >
            <ColumnVisibilityDropdownContent
              columns={columns}
              columnOrder={columnOrder}
              columnVisibility={columnVisibility}
              onToggleColumn={toggleColumnVisibility}
              onColumnOrderChange={setColumnOrder}
              onColumnVisibilityChange={setColumnVisibility}
            />
          </PopoverContent>
        </Popover>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="pb-0.5">
        <Label
          className={cn(
            "text-muted-foreground !text-xs font-medium",
            variant === "mobile" && "!text-sm",
          )}
        >
          Column Visibility
        </Label>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="space-y-2">
          <ColumnVisibilityBadgeSection
            items={displayModel.visibleItems}
            onToggleColumn={toggleColumnVisibility}
            activeItemId={activeItem?.id}
            dropBucket="visible"
          />
          <ColumnVisibilityBadgeSection
            items={displayModel.hiddenItems}
            onToggleColumn={toggleColumnVisibility}
            activeItemId={activeItem?.id}
            dropBucket="hidden"
          />
        </div>

        {typeof document !== "undefined"
          ? createPortal(
              <DragOverlay dropAnimation={null}>
                {activeItem ? (
                  <div className="z-[70]">
                    <ColumnVisibilityBadgeOverlay item={activeItem} />
                  </div>
                ) : null}
              </DragOverlay>,
              document.body,
            )
          : null}
      </DndContext>
    </div>
  )
}
