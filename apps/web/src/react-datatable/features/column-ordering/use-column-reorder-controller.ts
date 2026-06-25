import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { useMemo } from "react"
import { buildDisplayedColumnsForDrag } from "./build-displayed-columns-for-drag"
import type { ColumnDragWidthMorphMode } from "./get-overlay-morph-width"
import { useColumnReorderDragSession } from "./use-column-reorder-drag-session"

interface UseColumnReorderControllerArgs {
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

export function useColumnReorderController({
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
}: UseColumnReorderControllerArgs) {
  const dragSession = useColumnReorderDragSession({
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
  })

  const displayedColumns = useMemo(
    () =>
      buildDisplayedColumnsForDrag({
        activeId: dragSession.activeId,
        visibleColumnOrder,
        previewVisibleColumnSlots: dragSession.previewVisibleColumnSlots,
        getColumnWidth,
      }),
    [
      dragSession.activeId,
      dragSession.previewVisibleColumnSlots,
      getColumnWidth,
      visibleColumnOrder,
    ],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  )

  return {
    ...dragSession,
    ...displayedColumns,
    sensors,
  }
}
