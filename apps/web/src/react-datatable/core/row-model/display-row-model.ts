import type { ExpandedState } from "@tanstack/react-table"
import { expandedStateToSet, isGroupExpanded } from "../../features/grouping/group-expansion"
import type { OnlineGroupingSummary, OnlineQueryResponse } from "../../types/props.types"
import type {
  RenderableDataRow,
  RenderableGroupHeader,
  RenderableLoadingRow,
  RenderableRow,
} from "../../types/renderable-row.types"

export type DisplayRow<TData> =
  | { kind: "column-header" }
  | { kind: "group-header"; row: RenderableGroupHeader; renderableIndex: number }
  | {
      kind: "data"
      row: RenderableDataRow<TData>
      renderableIndex: number
      rowId: string
      dataIndex: number
    }
  | {
      kind: "loading"
      row: RenderableLoadingRow
      renderableIndex: number
      rowId: string
      dataIndex: number
    }

export interface DisplayRowModel<TData> {
  rowCount: number
  bodyRowCount: number
  loadedRowCount: number
  loadedDataRowCount: number
  orderedDataRows: RenderableDataRow<TData>[]
  orderedActiveItems: Array<
    | { id: string; kind: "data"; row: RenderableDataRow<TData> }
    | { id: string; kind: "group-header"; row: RenderableGroupHeader }
  >
  getRowAt: (gridRowIndex: number) => DisplayRow<TData> | null
  getRenderableRowAt: (gridRowIndex: number) => RenderableRow<TData> | null
  getRenderableIndexAt: (gridRowIndex: number) => number | null
  getRowHeight: (gridRowIndex: number) => number
  getIndexByRowId: (rowId: string) => number | null
  getDataRowById: (rowId: string) => RenderableDataRow<TData> | null
  getDataRangeForRenderedRange: (
    rowStartIndex: number,
    rowStopIndex: number,
  ) => { dataStartIndex: number; dataStopIndex: number } | null
}

export function createDisplayRowModel<TData>({
  renderableRows,
  showColumnHeaders,
  rowHeight,
  headerHeight = rowHeight,
  groupHeaderHeight,
  bodyRowCount = renderableRows.length,
  unloadedDataRowCount = 0,
}: {
  renderableRows: RenderableRow<TData>[]
  showColumnHeaders: boolean
  rowHeight: number
  headerHeight?: number
  groupHeaderHeight: number
  bodyRowCount?: number
  unloadedDataRowCount?: number
}): DisplayRowModel<TData> {
  const headerOffset = showColumnHeaders ? 1 : 0
  const rowCount = bodyRowCount + headerOffset
  const orderedDataRows: RenderableDataRow<TData>[] = []
  const orderedActiveItems: DisplayRowModel<TData>["orderedActiveItems"] = []
  const dataRowsById = new Map<string, RenderableDataRow<TData>>()
  const gridIndexByRowId = new Map<string, number>()

  renderableRows.forEach((row, renderableIndex) => {
    if (row.type === "group-header") {
      gridIndexByRowId.set(row.groupId, renderableIndex + headerOffset)
      orderedActiveItems.push({ id: row.groupId, kind: "group-header", row })
      return
    }

    if (row.type === "data") {
      orderedDataRows.push(row)
      orderedActiveItems.push({ id: row.rowId, kind: "data", row })
      dataRowsById.set(row.rowId, row)
    }

    gridIndexByRowId.set(row.rowId, renderableIndex + headerOffset)
  })

  const getRenderableIndexAt = (gridRowIndex: number) => {
    if (showColumnHeaders && gridRowIndex === 0) {
      return null
    }

    const renderableIndex = gridRowIndex - headerOffset
    return renderableIndex >= 0 && renderableIndex < bodyRowCount ? renderableIndex : null
  }

  const getRenderableRowAt = (gridRowIndex: number) => {
    const renderableIndex = getRenderableIndexAt(gridRowIndex)
    if (renderableIndex === null) {
      return null
    }

    return renderableRows[renderableIndex] ?? null
  }

  const getRowAt = (gridRowIndex: number): DisplayRow<TData> | null => {
    if (showColumnHeaders && gridRowIndex === 0) {
      return { kind: "column-header" }
    }

    const renderableIndex = getRenderableIndexAt(gridRowIndex)
    if (renderableIndex === null) {
      return null
    }

    const row = renderableRows[renderableIndex]
    if (!row) {
      return null
    }

    if (row.type === "group-header") {
      return { kind: "group-header", row, renderableIndex }
    }

    if (row.type === "loading") {
      return { kind: "loading", row, renderableIndex, rowId: row.rowId, dataIndex: row.dataIndex }
    }

    return {
      kind: "data",
      row,
      renderableIndex,
      rowId: row.rowId,
      dataIndex: row.dataIndex ?? renderableIndex,
    }
  }

  const getRowHeight = (gridRowIndex: number) => {
    const row = getRowAt(gridRowIndex)
    if (row?.kind === "column-header") {
      return headerHeight
    }

    if (row?.kind === "group-header") {
      return groupHeaderHeight
    }

    if (row?.kind === "data" || row?.kind === "loading") {
      return rowHeight
    }

    const renderableIndex = getRenderableIndexAt(gridRowIndex)
    if (renderableIndex === null) {
      return rowHeight
    }

    const firstUnknownIndex = renderableRows.length
    if (
      renderableIndex >= firstUnknownIndex &&
      renderableIndex < firstUnknownIndex + unloadedDataRowCount
    ) {
      return rowHeight
    }

    return groupHeaderHeight
  }

  const getIndexByRowId = (rowId: string) => gridIndexByRowId.get(rowId) ?? null
  const getDataRowById = (rowId: string) => dataRowsById.get(rowId) ?? null

  const getDataRangeForRenderedRange = (rowStartIndex: number, rowStopIndex: number) => {
    let dataStartIndex: number | null = null
    let dataStopIndex: number | null = null
    const startIndex = Math.max(0, rowStartIndex)
    const stopIndex = Math.min(rowCount - 1, rowStopIndex)

    for (let gridRowIndex = startIndex; gridRowIndex <= stopIndex; gridRowIndex += 1) {
      const row = getRowAt(gridRowIndex)
      if (row?.kind !== "data" && row?.kind !== "loading") {
        continue
      }

      dataStartIndex =
        dataStartIndex === null ? row.dataIndex : Math.min(dataStartIndex, row.dataIndex)
      dataStopIndex =
        dataStopIndex === null ? row.dataIndex : Math.max(dataStopIndex, row.dataIndex)
    }

    if (dataStartIndex === null || dataStopIndex === null) {
      return null
    }

    return { dataStartIndex, dataStopIndex }
  }

  return {
    rowCount,
    bodyRowCount,
    loadedRowCount: renderableRows.length,
    loadedDataRowCount: orderedDataRows.length,
    orderedDataRows,
    orderedActiveItems,
    getRowAt,
    getRenderableRowAt,
    getRenderableIndexAt,
    getRowHeight,
    getIndexByRowId,
    getDataRowById,
    getDataRangeForRenderedRange,
  }
}

export function createOnlineVirtualDisplayRowModel<TData>({
  pagesByOffset,
  totalDataRows,
  totalRenderedRows,
  groupingSummary,
  groupExpanded = true,
  showColumnHeaders,
  rowHeight,
  headerHeight = rowHeight,
  groupHeaderHeight,
}: {
  pagesByOffset: Map<number, OnlineQueryResponse<TData>>
  totalDataRows: number
  totalRenderedRows: number
  groupingSummary?: OnlineGroupingSummary
  groupExpanded?: ExpandedState
  showColumnHeaders: boolean
  rowHeight: number
  headerHeight?: number
  groupHeaderHeight: number
}): DisplayRowModel<TData> {
  const loadedRowsByDataIndex = new Map<number, RenderableDataRow<TData>>()
  const dataRowsById = new Map<string, RenderableDataRow<TData>>()
  const orderedDataRows: RenderableDataRow<TData>[] = []

  for (const [offset, page] of pagesByOffset) {
    let dataIndex = offset
    for (const row of page.rows) {
      if (row.type !== "data") {
        continue
      }

      if (dataIndex >= totalDataRows) {
        break
      }

      const dataRow: RenderableDataRow<TData> = {
        type: "data",
        rowId: row.rowId,
        data: row.item,
        dataIndex,
        groupPath: row.groupPath,
      }
      loadedRowsByDataIndex.set(dataIndex, dataRow)
      dataRowsById.set(row.rowId, dataRow)
      orderedDataRows.push(dataRow)
      dataIndex += 1
    }
  }

  orderedDataRows.sort((a, b) => (a.dataIndex ?? 0) - (b.dataIndex ?? 0))

  const headerOffset = showColumnHeaders ? 1 : 0
  const segments = groupingSummary
    ? buildGroupedSegments({
        groupingSummary,
        groupExpanded,
        totalDataRows,
      })
    : [
        {
          type: "data-span" as const,
          renderStart: 0,
          renderEnd: Math.max(0, totalRenderedRows - 1),
          dataStart: 0,
          groupPath: [],
        },
      ]
  const bodyRowCount = groupingSummary ? (segments.at(-1)?.renderEnd ?? -1) + 1 : totalRenderedRows
  const rowCount = bodyRowCount + headerOffset
  const groupHeaderIndexById = new Map<string, number>()
  const orderedActiveItems: DisplayRowModel<TData>["orderedActiveItems"] = []
  let activeDataRowIndex = 0

  for (const segment of segments) {
    if (segment.type === "group-header") {
      groupHeaderIndexById.set(segment.row.groupId, segment.renderStart + headerOffset)
      orderedActiveItems.push({ id: segment.row.groupId, kind: "group-header", row: segment.row })
      continue
    }

    const segmentDataEnd = segment.dataStart + (segment.renderEnd - segment.renderStart)
    while (
      activeDataRowIndex < orderedDataRows.length &&
      (orderedDataRows[activeDataRowIndex].dataIndex ?? 0) < segment.dataStart
    ) {
      activeDataRowIndex += 1
    }

    while (activeDataRowIndex < orderedDataRows.length) {
      const row = orderedDataRows[activeDataRowIndex]
      const dataIndex = row.dataIndex ?? 0
      if (dataIndex > segmentDataEnd) {
        break
      }

      orderedActiveItems.push({ id: row.rowId, kind: "data", row })
      activeDataRowIndex += 1
    }
  }

  const getRenderableIndexAt = (gridRowIndex: number) => {
    if (showColumnHeaders && gridRowIndex === 0) {
      return null
    }

    const renderableIndex = gridRowIndex - headerOffset
    return renderableIndex >= 0 && renderableIndex < bodyRowCount ? renderableIndex : null
  }

  const getRenderableRowAt = (gridRowIndex: number): RenderableRow<TData> | null => {
    const renderableIndex = getRenderableIndexAt(gridRowIndex)
    if (renderableIndex === null) {
      return null
    }

    const segment = findSegmentForRenderableIndex(segments, renderableIndex)
    if (!segment) {
      return null
    }

    if (segment.type === "group-header") {
      return segment.row
    }

    const dataIndex = segment.dataStart + (renderableIndex - segment.renderStart)
    return (
      loadedRowsByDataIndex.get(dataIndex) ?? {
        type: "loading",
        rowId: `__loading_${dataIndex}`,
        dataIndex,
        groupPath: segment.groupPath,
      }
    )
  }

  const getRowAt = (gridRowIndex: number): DisplayRow<TData> | null => {
    if (showColumnHeaders && gridRowIndex === 0) {
      return { kind: "column-header" }
    }

    const renderableIndex = getRenderableIndexAt(gridRowIndex)
    const row = getRenderableRowAt(gridRowIndex)
    if (renderableIndex === null || !row) {
      return null
    }

    if (row.type === "data") {
      return {
        kind: "data",
        row,
        renderableIndex,
        rowId: row.rowId,
        dataIndex: row.dataIndex ?? renderableIndex,
      }
    }

    if (row.type === "group-header") {
      return { kind: "group-header", row, renderableIndex }
    }

    return {
      kind: "loading",
      row,
      renderableIndex,
      rowId: row.rowId,
      dataIndex: row.dataIndex,
    }
  }

  const getRowHeight = (gridRowIndex: number) => {
    const row = getRowAt(gridRowIndex)
    if (row?.kind === "column-header") {
      return headerHeight
    }

    if (row?.kind === "group-header") {
      return groupHeaderHeight
    }

    return rowHeight
  }

  const getIndexByRowId = (rowId: string) => {
    const groupHeaderIndex = groupHeaderIndexById.get(rowId)
    if (groupHeaderIndex !== undefined) {
      return groupHeaderIndex
    }

    const row = dataRowsById.get(rowId)
    if (!row || row.dataIndex === undefined) {
      return null
    }

    const segment = findSegmentForDataIndex(segments, row.dataIndex)
    if (!segment) {
      return null
    }

    return segment.renderStart + (row.dataIndex - segment.dataStart) + headerOffset
  }

  const getDataRangeForRenderedRange = (rowStartIndex: number, rowStopIndex: number) => {
    let dataStartIndex: number | null = null
    let dataStopIndex: number | null = null
    const startIndex = Math.max(headerOffset, rowStartIndex)
    const stopIndex = Math.min(rowCount - 1, rowStopIndex)
    if (stopIndex < startIndex) {
      return null
    }

    for (let gridRowIndex = startIndex; gridRowIndex <= stopIndex; gridRowIndex += 1) {
      const row = getRowAt(gridRowIndex)
      if (row?.kind !== "data" && row?.kind !== "loading") {
        continue
      }

      dataStartIndex =
        dataStartIndex === null ? row.dataIndex : Math.min(dataStartIndex, row.dataIndex)
      dataStopIndex =
        dataStopIndex === null ? row.dataIndex : Math.max(dataStopIndex, row.dataIndex)
    }

    if (dataStartIndex === null || dataStopIndex === null) {
      return null
    }

    return { dataStartIndex, dataStopIndex }
  }

  return {
    rowCount,
    bodyRowCount,
    loadedRowCount: orderedDataRows.length,
    loadedDataRowCount: orderedDataRows.length,
    orderedDataRows,
    orderedActiveItems,
    getRowAt,
    getRenderableRowAt,
    getRenderableIndexAt,
    getRowHeight,
    getIndexByRowId,
    getDataRowById: (rowId) => dataRowsById.get(rowId) ?? null,
    getDataRangeForRenderedRange,
  }
}

type OnlineVirtualSegment =
  | { type: "group-header"; renderStart: number; renderEnd: number; row: RenderableGroupHeader }
  | {
      type: "data-span"
      renderStart: number
      renderEnd: number
      dataStart: number
      groupPath: string[]
    }
type OnlineVirtualDataSegment = Extract<OnlineVirtualSegment, { type: "data-span" }>

function findSegmentForRenderableIndex(segments: OnlineVirtualSegment[], renderableIndex: number) {
  return (
    segments.find(
      (segment) => renderableIndex >= segment.renderStart && renderableIndex <= segment.renderEnd,
    ) ?? null
  )
}

function findSegmentForDataIndex(
  segments: OnlineVirtualSegment[],
  dataIndex: number,
): OnlineVirtualDataSegment | null {
  for (const segment of segments) {
    if (segment.type !== "data-span") {
      continue
    }

    if (
      dataIndex >= segment.dataStart &&
      dataIndex <= segment.dataStart + (segment.renderEnd - segment.renderStart)
    ) {
      return segment
    }
  }

  return null
}

function buildGroupedSegments({
  groupingSummary,
  groupExpanded,
  totalDataRows,
}: {
  groupingSummary: OnlineGroupingSummary
  groupExpanded: ExpandedState
  totalDataRows: number
}): OnlineVirtualSegment[] {
  const expandedGroups = expandedStateToSet(groupExpanded)
  const segments: OnlineVirtualSegment[] = []
  let renderIndex = 0
  let dataIndex = 0

  const pushGroupHeader = ({
    groupId,
    depth,
    count,
    groupPath,
  }: {
    groupId: string
    depth: number
    count: number
    groupPath: string[]
  }) => {
    const row = createGroupHeader({ groupId, depth, count, groupPath })
    row.isExpanded = isGroupExpanded(expandedGroups, groupId)
    segments.push({ type: "group-header", renderStart: renderIndex, renderEnd: renderIndex, row })
    renderIndex += 1
    return row
  }

  const pushDataSpan = ({ count, groupPath }: { count: number; groupPath: string[] }) => {
    const boundedCount = Math.min(count, Math.max(0, totalDataRows - dataIndex))
    if (boundedCount <= 0) {
      return
    }

    segments.push({
      type: "data-span",
      renderStart: renderIndex,
      renderEnd: renderIndex + boundedCount - 1,
      dataStart: dataIndex,
      groupPath,
    })
    renderIndex += boundedCount
    dataIndex += boundedCount
  }

  for (const [groupId, group] of Object.entries(groupingSummary.groups)) {
    const groupHeader = pushGroupHeader({ groupId, depth: 0, count: group.total, groupPath: [] })
    const subgroupEntries = Object.entries(group.subgroups ?? {})

    if (!groupHeader.isExpanded) {
      dataIndex += group.total
      continue
    }

    if (subgroupEntries.length === 0) {
      pushDataSpan({ count: group.total, groupPath: [groupId] })
      continue
    }

    for (const [subgroupId, subgroup] of subgroupEntries) {
      const subgroupHeader = pushGroupHeader({
        groupId: subgroupId,
        depth: 1,
        count: subgroup.total,
        groupPath: [groupId],
      })
      if (!subgroupHeader.isExpanded) {
        dataIndex += subgroup.total
        continue
      }

      pushDataSpan({ count: subgroup.total, groupPath: [groupId, subgroupId] })
    }
  }

  if (dataIndex < totalDataRows) {
    pushDataSpan({ count: totalDataRows - dataIndex, groupPath: [] })
  }

  return segments
}

function createGroupHeader({
  groupId,
  depth,
  count,
  groupPath,
}: {
  groupId: string
  depth: number
  count: number
  groupPath: string[]
}): RenderableGroupHeader {
  const segment = groupId.split("|").at(-1) ?? groupId
  const separatorIndex = segment.indexOf(":")
  const columnId = separatorIndex === -1 ? segment : segment.slice(0, separatorIndex)
  const value = separatorIndex === -1 ? segment : segment.slice(separatorIndex + 1)

  return {
    type: "group-header",
    groupId,
    columnId,
    value,
    depth,
    count,
    isExpanded: true,
    groupPath,
  }
}
