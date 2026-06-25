import { arrayMove } from "@dnd-kit/sortable"
import type { DatatableColumn } from "../../types/column.types"

export type ColumnVisibilityUIMode = "badges" | "dropdown" | "auto"
export type ResolvedColumnVisibilityUIMode = Exclude<ColumnVisibilityUIMode, "auto">
export type ColumnVisibilityBucket = "visible" | "hidden"

export type ColumnVisibilityPresentationColumn<TData = unknown> = Pick<
  DatatableColumn<TData>,
  "id" | "header" | "defaultVisible" | "meta"
>

export interface ColumnVisibilityUIConfig {
  mode?: ColumnVisibilityUIMode
  autoThreshold?: number
}

export interface ColumnVisibilityPresentationItem<TData = unknown> {
  id: string
  label: string
  isVisible: boolean
  column: DatatableColumn<TData>
}

export interface ColumnVisibilityPresentationModel<TData> {
  items: ColumnVisibilityPresentationItem<TData>[]
  visibleItems: ColumnVisibilityPresentationItem<TData>[]
  hiddenItems: ColumnVisibilityPresentationItem<TData>[]
  orderedColumnIds: string[]
  visibleColumnIds: Set<string>
  hideableCount: number
}

export interface ReorderColumnVisibilityItemsResult {
  columnOrder: string[]
  columnVisibility: Record<string, boolean>
}

export interface ColumnVisibilityDropTarget {
  bucket: ColumnVisibilityBucket
  itemId?: string
}

const DEFAULT_AUTO_THRESHOLD = 12

function getResolvedColumnOrder<TData>(
  columns: ColumnVisibilityPresentationColumn<TData>[],
  columnOrder: string[],
): string[] {
  const columnIds = new Set(columns.map((column) => column.id))
  const nextOrder: string[] = []

  columnOrder.forEach((columnId) => {
    if (columnIds.has(columnId) && !nextOrder.includes(columnId)) {
      nextOrder.push(columnId)
    }
  })

  columns.forEach((column) => {
    if (!nextOrder.includes(column.id)) {
      nextOrder.push(column.id)
    }
  })

  return nextOrder
}

function isColumnVisible<TData>(
  column: ColumnVisibilityPresentationColumn<TData>,
  columnVisibility: Record<string, boolean>,
): boolean {
  return columnVisibility[column.id] ?? column.defaultVisible ?? true
}

function isColumnIdVisible(
  columnId: string,
  columnVisibility: Record<string, boolean>,
  columnDefaults: Record<string, boolean | undefined>,
): boolean {
  return columnVisibility[columnId] ?? columnDefaults[columnId] ?? true
}

function getColumnDefaults<TData>(
  columns: ColumnVisibilityPresentationColumn<TData>[],
): Record<string, boolean | undefined> {
  return Object.fromEntries(columns.map((column) => [column.id, column.defaultVisible]))
}

export function buildColumnVisibilityPresentationModel<TData>({
  columns,
  columnOrder,
  columnVisibility,
}: {
  columns: ColumnVisibilityPresentationColumn<TData>[]
  columnOrder: string[]
  columnVisibility: Record<string, boolean>
}): ColumnVisibilityPresentationModel<TData> {
  const columnsById = new Map(columns.map((column) => [column.id, column]))
  const orderedColumnIds = getResolvedColumnOrder(columns, columnOrder)
  const items = orderedColumnIds
    .map((columnId) => {
      const column = columnsById.get(columnId)
      if (!column) {
        return null
      }

      return {
        id: column.id,
        label: column.meta?.displayName ?? column.header,
        isVisible: isColumnVisible(column, columnVisibility),
        column,
      } satisfies ColumnVisibilityPresentationItem<TData>
    })
    .filter((item): item is ColumnVisibilityPresentationItem<TData> => item !== null)

  const visibleItems = items.filter((item) => item.isVisible)
  const hiddenItems = items.filter((item) => !item.isVisible)

  return {
    items: [...visibleItems, ...hiddenItems],
    visibleItems,
    hiddenItems,
    orderedColumnIds,
    visibleColumnIds: new Set(visibleItems.map((item) => item.id)),
    hideableCount: items.length,
  }
}

export function reorderColumnsInVisibilityBucket({
  columnOrder,
  visibleColumnIds,
  activeId,
  overId,
}: {
  columnOrder: string[]
  visibleColumnIds: Set<string>
  activeId: string
  overId: string
}): string[] {
  const activeIsVisible = visibleColumnIds.has(activeId)
  const overIsVisible = visibleColumnIds.has(overId)

  if (activeIsVisible !== overIsVisible) {
    return columnOrder
  }

  const bucketColumnIds = columnOrder.filter(
    (columnId) => visibleColumnIds.has(columnId) === activeIsVisible,
  )
  const oldIndex = bucketColumnIds.indexOf(activeId)
  const newIndex = bucketColumnIds.indexOf(overId)

  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
    return columnOrder
  }

  const reorderedBucket = arrayMove(bucketColumnIds, oldIndex, newIndex)
  let nextBucketIndex = 0

  return columnOrder.map((columnId) => {
    if (visibleColumnIds.has(columnId) !== activeIsVisible) {
      return columnId
    }

    const nextColumnId = reorderedBucket[nextBucketIndex]
    nextBucketIndex += 1
    return nextColumnId
  })
}

export function applyColumnVisibilityDrop({
  columnOrder,
  columnVisibility,
  columnDefaults,
  activeId,
  target,
}: {
  columnOrder: string[]
  columnVisibility: Record<string, boolean>
  columnDefaults: Record<string, boolean | undefined>
  activeId: string
  target: ColumnVisibilityDropTarget
}): ReorderColumnVisibilityItemsResult {
  const visibleColumnIds = columnOrder.filter((columnId) =>
    isColumnIdVisible(columnId, columnVisibility, columnDefaults),
  )
  const hiddenColumnIds = columnOrder.filter(
    (columnId) => !isColumnIdVisible(columnId, columnVisibility, columnDefaults),
  )
  const sourceBucket: ColumnVisibilityBucket = isColumnIdVisible(
    activeId,
    columnVisibility,
    columnDefaults,
  )
    ? "visible"
    : "hidden"

  if (sourceBucket === target.bucket && target.itemId) {
    const bucketColumnIds = sourceBucket === "visible" ? visibleColumnIds : hiddenColumnIds
    const oldIndex = bucketColumnIds.indexOf(activeId)
    const newIndex = bucketColumnIds.indexOf(target.itemId)

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
      return {
        columnOrder,
        columnVisibility,
      }
    }

    const reorderedBucketIds = arrayMove(bucketColumnIds, oldIndex, newIndex)

    return {
      columnOrder:
        sourceBucket === "visible"
          ? [...reorderedBucketIds, ...hiddenColumnIds]
          : [...visibleColumnIds, ...reorderedBucketIds],
      columnVisibility,
    }
  }

  const nextVisibleColumnIds = [...visibleColumnIds].filter((columnId) => columnId !== activeId)
  const nextHiddenColumnIds = [...hiddenColumnIds].filter((columnId) => columnId !== activeId)
  const targetBucketIds = target.bucket === "visible" ? nextVisibleColumnIds : nextHiddenColumnIds
  const normalizedTargetIndex =
    target.itemId && targetBucketIds.includes(target.itemId)
      ? targetBucketIds.indexOf(target.itemId)
      : targetBucketIds.length

  targetBucketIds.splice(normalizedTargetIndex, 0, activeId)

  const nextOrder = [...nextVisibleColumnIds, ...nextHiddenColumnIds]
  const nextVisibilityState =
    sourceBucket === target.bucket
      ? columnVisibility
      : {
          ...columnVisibility,
          [activeId]: target.bucket === "visible",
        }

  return {
    columnOrder: nextOrder,
    columnVisibility: nextVisibilityState,
  }
}

export function buildProjectedColumnVisibilityPresentationModel<TData>({
  columns,
  columnOrder,
  columnVisibility,
  activeId,
  target,
}: {
  columns: ColumnVisibilityPresentationColumn<TData>[]
  columnOrder: string[]
  columnVisibility: Record<string, boolean>
  activeId: string
  target: ColumnVisibilityDropTarget
}): ColumnVisibilityPresentationModel<TData> {
  const result = applyColumnVisibilityDrop({
    columnOrder,
    columnVisibility,
    columnDefaults: getColumnDefaults(columns),
    activeId,
    target,
  })

  return buildColumnVisibilityPresentationModel({
    columns,
    columnOrder: result.columnOrder,
    columnVisibility: result.columnVisibility,
  })
}

export function reorderColumnVisibilityItems({
  columnOrder,
  columnVisibility,
  columnDefaults,
  activeId,
  overId,
}: {
  columnOrder: string[]
  columnVisibility: Record<string, boolean>
  columnDefaults: Record<string, boolean | undefined>
  activeId: string
  overId: string
}): ReorderColumnVisibilityItemsResult {
  const target: ColumnVisibilityDropTarget = {
    bucket: isColumnIdVisible(overId, columnVisibility, columnDefaults) ? "visible" : "hidden",
    itemId: overId,
  }

  return applyColumnVisibilityDrop({
    columnOrder,
    columnVisibility,
    columnDefaults,
    activeId,
    target,
  })
}

export function resolveColumnVisibilityMode(
  config: ColumnVisibilityUIConfig | undefined,
  hideableColumnCount: number,
): ResolvedColumnVisibilityUIMode {
  const mode = config?.mode ?? "auto"

  if (mode === "badges" || mode === "dropdown") {
    return mode
  }

  const autoThreshold = config?.autoThreshold ?? DEFAULT_AUTO_THRESHOLD
  return hideableColumnCount >= autoThreshold ? "dropdown" : "badges"
}
