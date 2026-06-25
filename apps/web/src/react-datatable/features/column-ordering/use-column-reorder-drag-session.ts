import type {
  CollisionDetection,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { buildVisibleColumnSlotsForDrag } from "./build-visible-column-slots-for-drag"
import { getAllowedColumnTargetIndex } from "./get-allowed-column-target-index"
import {
  type ColumnDragTargetPane,
  getColumnTargetVisibleIndexFromPointerClientX,
} from "./get-column-target-visible-index-from-pointer-client-x"
import { type ColumnDragWidthMorphMode, getOverlayMorphWidth } from "./get-overlay-morph-width"
import { reorderVisibleColumns } from "./reorder-visible-columns"

function lockVerticalScrollForColumnDrag(scrollContainer: HTMLDivElement | null) {
  const previousDocumentElementOverflowY = document.documentElement.style.overflowY
  const previousBodyOverflowY = document.body.style.overflowY
  const previousScrollContainerOverflowY = scrollContainer?.style.overflowY ?? null

  document.documentElement.style.overflowY = "hidden"
  document.body.style.overflowY = "hidden"

  if (scrollContainer) {
    scrollContainer.style.overflowY = "hidden"
  }

  return () => {
    document.documentElement.style.overflowY = previousDocumentElementOverflowY
    document.body.style.overflowY = previousBodyOverflowY

    if (scrollContainer && previousScrollContainerOverflowY !== null) {
      scrollContainer.style.overflowY = previousScrollContainerOverflowY
    }
  }
}

interface UseColumnReorderDragSessionArgs {
  visibleColumnOrder: string[]
  columnOrder: string[]
  columnVisibility: Record<string, boolean>
  stickyColumnsCount: number
  allowFrozenBoundaryCrossing: boolean
  widthMorph: ColumnDragWidthMorphMode
  getColumnWidth: (columnId: string) => number
  gridContainerRef: React.RefObject<HTMLDivElement | null>
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  setColumnOrder: (order: string[]) => void
}

export function useColumnReorderDragSession({
  visibleColumnOrder,
  columnOrder,
  columnVisibility,
  stickyColumnsCount,
  allowFrozenBoundaryCrossing,
  widthMorph,
  getColumnWidth,
  gridContainerRef,
  scrollContainerRef,
  setColumnOrder,
}: UseColumnReorderDragSessionArgs) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [targetIndex, setTargetIndex] = useState<number | null>(null)
  const [pointerRelativeX, setPointerRelativeX] = useState<number | null>(null)
  const lastPointerRelativeXRef = useRef<number | null>(null)
  const lastResolvedPaneRef = useRef<ColumnDragTargetPane | null>(null)
  const releaseVerticalScrollLockRef = useRef<(() => void) | null>(null)

  const sourceIndex = useMemo(
    () => (activeId ? visibleColumnOrder.indexOf(activeId) : null),
    [activeId, visibleColumnOrder],
  )

  const activeWidth = useMemo(
    () => (activeId ? getColumnWidth(activeId) : 0),
    [activeId, getColumnWidth],
  )

  const slotWidths = useMemo(
    () => visibleColumnOrder.map((columnId) => getColumnWidth(columnId)),
    [getColumnWidth, visibleColumnOrder],
  )

  const slotOffsets = useMemo(() => {
    let runningOffset = 0
    return slotWidths.map((width) => {
      const offset = runningOffset
      runningOffset += width
      return offset
    })
  }, [slotWidths])

  const allowedTargetIndex = useMemo(() => {
    if (sourceIndex === null || targetIndex === null) {
      return targetIndex
    }

    return getAllowedColumnTargetIndex({
      sourceIndex,
      targetIndex,
      frozenColumnsCount: stickyColumnsCount,
      allowFrozenBoundaryCrossing,
    })
  }, [allowFrozenBoundaryCrossing, sourceIndex, stickyColumnsCount, targetIndex])

  const previewVisibleColumnSlots = useMemo(
    () =>
      buildVisibleColumnSlotsForDrag({
        visibleColumnOrder,
        activeId,
        sourceIndex,
        targetIndex: allowedTargetIndex,
      }),
    [activeId, allowedTargetIndex, sourceIndex, visibleColumnOrder],
  )

  const widthMorphProgress = useMemo(() => {
    if (
      sourceIndex === null ||
      allowedTargetIndex === null ||
      sourceIndex === allowedTargetIndex ||
      pointerRelativeX === null
    ) {
      return 0
    }

    const getSlotCenter = (index: number) => {
      const slotStart = slotWidths.slice(0, index).reduce((sum, width) => sum + width, 0)
      return slotStart + (slotWidths[index] ?? 0) / 2
    }

    const sourceCenter = getSlotCenter(sourceIndex)
    const targetCenter = getSlotCenter(allowedTargetIndex)
    const denominator = Math.abs(targetCenter - sourceCenter)

    if (denominator === 0) {
      return 1
    }

    return Math.min(Math.max(Math.abs(pointerRelativeX - sourceCenter) / denominator, 0), 1)
  }, [allowedTargetIndex, pointerRelativeX, slotWidths, sourceIndex])

  const overlayWidth = useMemo(() => {
    if (sourceIndex === null) {
      return activeWidth
    }

    const targetWidth =
      allowedTargetIndex !== null ? (slotWidths[allowedTargetIndex] ?? activeWidth) : activeWidth

    return getOverlayMorphWidth({
      mode: widthMorph,
      sourceWidth: activeWidth,
      targetWidth,
      progress: widthMorphProgress,
    })
  }, [activeWidth, allowedTargetIndex, slotWidths, sourceIndex, widthMorph, widthMorphProgress])

  const cleanup = useCallback(() => {
    releaseVerticalScrollLockRef.current?.()
    releaseVerticalScrollLockRef.current = null
    setActiveId(null)
    setTargetIndex(null)
    setPointerRelativeX(null)
    lastPointerRelativeXRef.current = null
    lastResolvedPaneRef.current = null
    document.body.style.cursor = ""
  }, [])

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      releaseVerticalScrollLockRef.current?.()
      releaseVerticalScrollLockRef.current = lockVerticalScrollForColumnDrag(
        scrollContainerRef.current,
      )
      setActiveId(event.active.id as string)
      document.body.style.cursor = "grabbing"
    },
    [scrollContainerRef],
  )

  useEffect(() => cleanup, [cleanup])

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      if (sourceIndex === null) {
        return
      }

      const sourceOffset = slotOffsets[sourceIndex] ?? 0
      const nextPointerRelativeX = sourceOffset + activeWidth / 2 + event.delta.x

      if (lastPointerRelativeXRef.current === nextPointerRelativeX) {
        return
      }

      lastPointerRelativeXRef.current = nextPointerRelativeX
      setPointerRelativeX(nextPointerRelativeX)
    },
    [activeWidth, slotOffsets, sourceIndex],
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event

      if (!over) {
        setTargetIndex(null)
        return
      }

      const rawTargetIndex = visibleColumnOrder.indexOf(over.id as string)
      if (rawTargetIndex === -1) {
        setTargetIndex(null)
        return
      }

      if (activeId && over.id === activeId) {
        setTargetIndex(null)
        return
      }

      setTargetIndex(rawTargetIndex)
    },
    [activeId, visibleColumnOrder],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active } = event

      if (
        allowedTargetIndex !== null &&
        activeId &&
        active.id === activeId &&
        sourceIndex !== null &&
        allowedTargetIndex !== sourceIndex
      ) {
        const effectiveOverId = visibleColumnOrder[allowedTargetIndex]

        if (effectiveOverId) {
          const nextOrder = reorderVisibleColumns({
            columnOrder,
            columnVisibility,
            activeId,
            overId: effectiveOverId,
          })

          if (nextOrder !== columnOrder) {
            setColumnOrder(nextOrder)
          }
        }
      }

      cleanup()
    },
    [
      activeId,
      allowedTargetIndex,
      cleanup,
      columnOrder,
      columnVisibility,
      setColumnOrder,
      sourceIndex,
      visibleColumnOrder,
    ],
  )

  const handleDragCancel = useCallback(() => {
    cleanup()
  }, [cleanup])

  const collisionDetection: CollisionDetection = useCallback(
    ({ pointerCoordinates, droppableContainers }) => {
      if (!pointerCoordinates || !gridContainerRef.current || !scrollContainerRef.current) {
        return []
      }

      const containerRect = gridContainerRef.current.getBoundingClientRect()
      const scrollLeft = scrollContainerRef.current?.scrollLeft ?? 0
      const scrollContainerRect = scrollContainerRef.current.getBoundingClientRect()

      const target = getColumnTargetVisibleIndexFromPointerClientX({
        pointerClientX: pointerCoordinates.x,
        gridLeft: containerRect.left,
        scrollContainerLeft: scrollContainerRect.left,
        scrollLeft,
        columnWidths: slotWidths,
        frozenColumnsCount: stickyColumnsCount,
        previousPane: lastResolvedPaneRef.current,
      })

      if (!target || target.index === null) {
        return []
      }

      lastResolvedPaneRef.current = target.pane

      const targetColumnId = visibleColumnOrder[target.index]
      const container = Array.from(droppableContainers).find((item) => item.id === targetColumnId)

      if (!container) {
        return []
      }

      return [
        {
          id: targetColumnId,
          data: {
            droppableContainer: container,
            value: 1,
          },
        },
      ]
    },
    [gridContainerRef, scrollContainerRef, slotWidths, stickyColumnsCount, visibleColumnOrder],
  )

  return {
    activeId,
    sourceIndex,
    targetIndex: allowedTargetIndex,
    previewVisibleColumnSlots,
    overlayWidth,
    handleDragStart,
    handleDragMove,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    collisionDetection,
  }
}
