"use client"

import {
  type CollisionDetection,
  closestCenter,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { useCallback, useMemo, useState } from "react"
import {
  applyColumnVisibilityDrop,
  buildColumnVisibilityPresentationModel,
  buildProjectedColumnVisibilityPresentationModel,
  type ColumnVisibilityBucket,
  type ColumnVisibilityDropTarget,
  type ColumnVisibilityPresentationColumn,
} from "./column-visibility-presentation"

const ITEM_PREFIX = "column-visibility:item:"
const BUCKET_PREFIX = "column-visibility:bucket:"

function getItemDragId(columnId: string) {
  return `${ITEM_PREFIX}${columnId}`
}

function getBucketEndDragId(bucket: ColumnVisibilityBucket) {
  return `${BUCKET_PREFIX}${bucket}`
}

function parseDragTargetId(
  rawId: string,
  visibleColumnIds: Set<string>,
): ColumnVisibilityDropTarget | null {
  if (rawId.startsWith(ITEM_PREFIX)) {
    const itemId = rawId.slice(ITEM_PREFIX.length)
    return {
      bucket: visibleColumnIds.has(itemId) ? "visible" : "hidden",
      itemId,
    }
  }

  if (rawId.startsWith(BUCKET_PREFIX)) {
    return {
      bucket: rawId.slice(BUCKET_PREFIX.length) as ColumnVisibilityBucket,
    }
  }

  return null
}

export function useColumnVisibilityDragItem(columnId: string, disabled: boolean) {
  const draggable = useDraggable({
    id: getItemDragId(columnId),
    disabled,
  })
  const droppable = useDroppable({
    id: getItemDragId(columnId),
    disabled,
  })

  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      draggable.setNodeRef(node)
      droppable.setNodeRef(node)
    },
    [draggable, droppable],
  )

  return {
    setNodeRef,
    attributes: draggable.attributes,
    listeners: draggable.listeners,
    transform: CSS.Translate.toString(draggable.transform),
    isDragging: draggable.isDragging,
    isOver: droppable.isOver,
  }
}

export function useColumnVisibilityBucketDropZone(
  bucket: ColumnVisibilityBucket,
  disabled: boolean,
) {
  const droppable = useDroppable({
    id: getBucketEndDragId(bucket),
    disabled,
  })

  return {
    setNodeRef: droppable.setNodeRef,
    isOver: droppable.isOver,
  }
}

interface UseColumnVisibilityDndArgs {
  columns: ColumnVisibilityPresentationColumn[]
  columnOrder: string[]
  columnVisibility: Record<string, boolean>
  onColumnOrderChange: (columnOrder: string[]) => void
  onColumnVisibilityChange: (columnVisibility: Record<string, boolean>) => void
  disabled?: boolean
}

export function useColumnVisibilityDnd({
  columns,
  columnOrder,
  columnVisibility,
  onColumnOrderChange,
  onColumnVisibilityChange,
  disabled = false,
}: UseColumnVisibilityDndArgs) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [target, setTarget] = useState<ColumnVisibilityDropTarget | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  )

  const model = useMemo(
    () =>
      buildColumnVisibilityPresentationModel({
        columns,
        columnOrder,
        columnVisibility,
      }),
    [columnOrder, columnVisibility, columns],
  )

  const columnDefaults = useMemo(
    () => Object.fromEntries(columns.map((column) => [column.id, column.defaultVisible])),
    [columns],
  )

  const activeItem = activeId ? (model.items.find((item) => item.id === activeId) ?? null) : null
  const displayModel = useMemo(() => {
    if (!activeId || !target) {
      return model
    }

    return buildProjectedColumnVisibilityPresentationModel({
      columns,
      columnOrder,
      columnVisibility,
      activeId,
      target,
    })
  }, [activeId, columnOrder, columnVisibility, columns, model, target])

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerHits = pointerWithin(args)

    const itemHit = pointerHits.find((entry) => String(entry.id).startsWith(ITEM_PREFIX))
    if (itemHit) {
      return [itemHit]
    }

    const bucketHit = pointerHits.find((entry) => String(entry.id).startsWith(BUCKET_PREFIX))
    if (bucketHit) {
      return [bucketHit]
    }

    return closestCenter(args)
  }, [])

  const clearDragState = useCallback(() => {
    setActiveId(null)
    setTarget(null)
  }, [])

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (disabled) {
        return
      }

      const rawId = String(event.active.id)
      if (!rawId.startsWith(ITEM_PREFIX)) {
        return
      }

      setActiveId(rawId.slice(ITEM_PREFIX.length))
      setTarget(null)
    },
    [disabled],
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      if (disabled) {
        setTarget(null)
        return
      }

      if (!event.over) {
        return
      }

      setTarget(parseDragTargetId(String(event.over.id), model.visibleColumnIds))
    },
    [disabled, model.visibleColumnIds],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeRawId = String(event.active.id)
      const finalTarget = event.over
        ? parseDragTargetId(String(event.over.id), model.visibleColumnIds)
        : target

      if (disabled || !activeRawId.startsWith(ITEM_PREFIX) || !finalTarget) {
        clearDragState()
        return
      }

      const nextActiveId = activeRawId.slice(ITEM_PREFIX.length)
      if (finalTarget.itemId === nextActiveId) {
        clearDragState()
        return
      }

      const result = applyColumnVisibilityDrop({
        columnOrder: model.orderedColumnIds,
        columnVisibility,
        columnDefaults,
        activeId: nextActiveId,
        target: finalTarget,
      })

      if (result.columnOrder !== model.orderedColumnIds) {
        onColumnOrderChange(result.columnOrder)
      }

      if (result.columnVisibility !== columnVisibility) {
        onColumnVisibilityChange(result.columnVisibility)
      }

      clearDragState()
    },
    [
      clearDragState,
      columnDefaults,
      columnVisibility,
      disabled,
      model.orderedColumnIds,
      model.visibleColumnIds,
      onColumnOrderChange,
      onColumnVisibilityChange,
      target,
    ],
  )

  const previewItemId = target?.itemId ?? null
  const previewBucket = target && !target.itemId ? target.bucket : null

  return {
    model,
    displayModel,
    sensors,
    collisionDetection,
    activeItem,
    target,
    previewItemId,
    previewBucket,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel: clearDragState,
    getItemDragId,
    getBucketEndDragId,
  }
}
