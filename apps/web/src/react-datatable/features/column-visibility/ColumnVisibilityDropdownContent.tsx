"use client"

import { DndContext, DragOverlay } from "@dnd-kit/core"
import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import { DotsSixVerticalIcon, EyeIcon, EyeSlashIcon } from "../../components/ui/icons"
import { Input } from "../../components/ui/input"
import { useOverlaySearchInput } from "../../shared/hooks/use-overlay-search-input"
import { cn } from "../../shared/utils/cn"
import type {
  ColumnVisibilityBucket,
  ColumnVisibilityPresentationColumn,
  ColumnVisibilityPresentationItem,
} from "./column-visibility-presentation"
import {
  useColumnVisibilityBucketDropZone,
  useColumnVisibilityDnd,
  useColumnVisibilityDragItem,
} from "./use-column-visibility-dnd"

interface ColumnVisibilityDropdownContentProps {
  columns: ColumnVisibilityPresentationColumn[]
  columnOrder: string[]
  columnVisibility: Record<string, boolean>
  onToggleColumn: (columnId: string) => void
  onColumnOrderChange: (columnOrder: string[]) => void
  onColumnVisibilityChange: (columnVisibility: Record<string, boolean>) => void
}

interface ColumnVisibilityListItemProps {
  item: ColumnVisibilityPresentationItem
  sortable: boolean
  onToggleColumn: (columnId: string) => void
}

interface ColumnVisibilityListSectionProps {
  title: string
  items: ColumnVisibilityPresentationItem[]
  sortable: boolean
  onToggleColumn: (columnId: string) => void
  activeItemId?: string | null
  dropBucket: ColumnVisibilityBucket
}

function ColumnVisibilityListItem({
  item,
  sortable,
  onToggleColumn,
}: ColumnVisibilityListItemProps) {
  const dragItem = useColumnVisibilityDragItem(item.id, !sortable)

  return (
    <div ref={dragItem.setNodeRef} className="rounded-md">
      <div className="flex items-center gap-0.5 rounded-md px-1 py-0.5">
        <button
          type="button"
          aria-label={`Reorder ${item.label}`}
          className={cn(
            "text-muted-foreground flex h-6 w-5 items-center justify-center rounded transition-colors",
            sortable
              ? "cursor-grab hover:bg-accent active:cursor-grabbing"
              : "cursor-default opacity-40",
          )}
          onClick={(event) => event.stopPropagation()}
          {...dragItem.attributes}
          {...dragItem.listeners}
        >
          <DotsSixVerticalIcon className="size-3.5" weight="bold" />
        </button>

        <button
          type="button"
          onClick={() => onToggleColumn(item.id)}
          className={cn(
            "hover:bg-accent flex h-6 min-w-0 flex-1 items-center justify-between gap-1.5 rounded px-1 py-0.5 text-left text-xs transition-colors",
            item.isVisible ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.isVisible ? (
            <EyeIcon className="text-muted-foreground size-3.5 flex-shrink-0" weight="fill" />
          ) : (
            <EyeSlashIcon className="text-muted-foreground size-3.5 flex-shrink-0" />
          )}
        </button>
      </div>
    </div>
  )
}

function ColumnVisibilityProjectedListItem({ item }: { item: ColumnVisibilityPresentationItem }) {
  return (
    <div className="rounded-md opacity-15">
      <div className="flex items-center gap-0.5 rounded-md px-1 py-0.5">
        <div className="text-muted-foreground flex h-6 w-5 items-center justify-center rounded opacity-70">
          <DotsSixVerticalIcon className="size-3.5" weight="bold" />
        </div>
        <div
          className={cn(
            "flex h-6 min-w-0 flex-1 items-center justify-between gap-1.5 rounded px-1 py-0.5 text-left text-xs",
            item.isVisible ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.isVisible ? (
            <EyeIcon className="text-muted-foreground size-3.5 flex-shrink-0" weight="fill" />
          ) : (
            <EyeSlashIcon className="text-muted-foreground size-3.5 flex-shrink-0" />
          )}
        </div>
      </div>
    </div>
  )
}

function ColumnVisibilityListOverlay({ item }: { item: ColumnVisibilityPresentationItem }) {
  return (
    <div className="pointer-events-none w-64 rounded-md border border-accent/70 bg-background ring-2 ring-accent/30 shadow-2xl backdrop-blur-[2px]">
      <div className="flex items-center gap-0.5 rounded-md px-1 py-0.5">
        <div className="text-muted-foreground flex h-6 w-5 items-center justify-center rounded opacity-70">
          <DotsSixVerticalIcon className="size-3.5" weight="bold" />
        </div>
        <div
          className={cn(
            "flex h-6 min-w-0 flex-1 items-center justify-between gap-1.5 rounded px-1 py-0.5 text-left text-xs",
            item.isVisible ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.isVisible ? (
            <EyeIcon className="text-muted-foreground size-3.5 flex-shrink-0" weight="fill" />
          ) : (
            <EyeSlashIcon className="text-muted-foreground size-3.5 flex-shrink-0" />
          )}
        </div>
      </div>
    </div>
  )
}

function ColumnVisibilityListSection({
  title,
  items,
  sortable,
  onToggleColumn,
  activeItemId,
  dropBucket,
}: ColumnVisibilityListSectionProps) {
  const dropZone = useColumnVisibilityBucketDropZone(dropBucket, false)

  return (
    <div role="group" aria-label={title}>
      <div className="px-2.5 py-1 text-xs font-medium text-muted-foreground">{title}</div>
      <div className="space-y-0.5 px-1.5 pb-1.5">
        {items.length === 0 ? (
          <div
            ref={dropZone.setNodeRef}
            className="text-muted-foreground rounded-md px-2 py-2 text-xs"
          >
            Empty
          </div>
        ) : (
          <>
            {items.map((item) =>
              item.id === activeItemId ? (
                <ColumnVisibilityProjectedListItem key={item.id} item={item} />
              ) : (
                <ColumnVisibilityListItem
                  key={item.id}
                  item={item}
                  sortable={sortable}
                  onToggleColumn={onToggleColumn}
                />
              ),
            )}
            <div ref={dropZone.setNodeRef} className="h-0 overflow-hidden" />
          </>
        )}
      </div>
    </div>
  )
}

export function ColumnVisibilityDropdownContent({
  columns,
  columnOrder,
  columnVisibility,
  onToggleColumn,
  onColumnOrderChange,
  onColumnVisibilityChange,
}: ColumnVisibilityDropdownContentProps) {
  const [search, setSearch] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { inputClassName } = useOverlaySearchInput(searchInputRef)
  const normalizedSearch = search.trim().toLowerCase()
  const isSearchActive = normalizedSearch.length > 0

  const {
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
    onColumnOrderChange,
    onColumnVisibilityChange,
    disabled: isSearchActive,
  })

  const filterItems = (items: ColumnVisibilityPresentationItem[]) =>
    items.filter((item) => item.label.toLowerCase().includes(normalizedSearch))

  const visibleItems = normalizedSearch
    ? filterItems(displayModel.visibleItems)
    : displayModel.visibleItems
  const hiddenItems = normalizedSearch
    ? filterItems(displayModel.hiddenItems)
    : displayModel.hiddenItems

  return (
    <div className="flex max-h-80 flex-col">
      <div className="bg-popover sticky top-0 z-10 border-b p-0.5">
        <Input
          ref={searchInputRef}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search columns..."
          className={cn(
            "inline-input h-8 border-none bg-transparent px-2 py-1 focus-visible:ring-0 focus-visible:outline-none",
            inputClassName,
          )}
        />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="scrollbar-hidden max-h-64 overflow-y-auto py-0.5">
          {visibleItems.length === 0 && hiddenItems.length === 0 ? (
            <div className="text-muted-foreground px-3 py-8 text-center text-xs">
              No columns found
            </div>
          ) : (
            <>
              <ColumnVisibilityListSection
                title={`Visible (${visibleItems.length})`}
                items={visibleItems}
                sortable={!isSearchActive}
                onToggleColumn={onToggleColumn}
                activeItemId={activeItem?.id}
                dropBucket="visible"
              />
              <ColumnVisibilityListSection
                title={`Hidden (${hiddenItems.length})`}
                items={hiddenItems}
                sortable={!isSearchActive}
                onToggleColumn={onToggleColumn}
                activeItemId={activeItem?.id}
                dropBucket="hidden"
              />
            </>
          )}
        </div>

        {typeof document !== "undefined"
          ? createPortal(
              <DragOverlay dropAnimation={null}>
                {activeItem ? (
                  <div className="z-[70]">
                    <ColumnVisibilityListOverlay item={activeItem} />
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
