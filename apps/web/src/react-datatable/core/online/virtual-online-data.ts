import type { OnlineGroupingSummary, OnlineQueryResponse } from "../../types/props.types"
import type { RenderableRow } from "../../types/renderable-row.types"

export function getVirtualPageOffsetsForRange({
  rowStartIndex,
  rowStopIndex,
  pageSize,
  totalDataRows,
  overscanPages = 1,
  prefetchRows = 0,
}: {
  rowStartIndex: number
  rowStopIndex: number
  pageSize: number
  totalDataRows: number
  overscanPages?: number
  prefetchRows?: number
}): number[] {
  if (pageSize <= 0 || totalDataRows <= 0 || rowStopIndex < 0 || rowStopIndex < rowStartIndex) {
    return []
  }

  const prefetchRowCount = Math.max(0, Math.floor(prefetchRows))
  const firstPage = Math.floor(Math.max(0, rowStartIndex - prefetchRowCount) / pageSize)
  const lastPage = Math.floor(
    Math.min(rowStopIndex + prefetchRowCount, totalDataRows - 1) / pageSize,
  )
  const startPage = Math.max(0, firstPage - overscanPages)
  const endPage = Math.min(Math.floor((totalDataRows - 1) / pageSize), lastPage + overscanPages)
  const offsets: number[] = []

  for (let page = startPage; page <= endPage; page += 1) {
    offsets.push(page * pageSize)
  }

  return offsets
}

export function getInitialVirtualPageOffsets({
  pageSize,
  totalDataRows,
  prefetchRows: _prefetchRows,
}: {
  pageSize: number
  totalDataRows: number
  prefetchRows: number
}): number[] {
  if (pageSize <= 0 || totalDataRows <= 0) {
    return []
  }

  return [0]
}

export function buildSparseVirtualRows<TData>({
  pagesByOffset,
  pageSize,
  totalDataRows,
  groupingSummary,
}: {
  pagesByOffset: Map<number, OnlineQueryResponse<TData>>
  pageSize: number
  totalDataRows: number
  groupingSummary?: OnlineGroupingSummary
}): RenderableRow<TData>[] {
  const loadedRowsByDataIndex = buildLoadedRowsByDataIndex({ pagesByOffset, totalDataRows })

  if (groupingSummary) {
    return buildGroupedSparseVirtualRows({
      loadedRowsByDataIndex,
      groupingSummary,
      totalDataRows,
    })
  }

  const rows: RenderableRow<TData>[] = Array.from({ length: totalDataRows }, (_, dataIndex) => ({
    type: "loading" as const,
    rowId: `__loading_${dataIndex}`,
    dataIndex,
    groupPath: [],
  }))

  for (const [dataIndex, row] of loadedRowsByDataIndex) {
    rows[dataIndex] = row
  }

  if (pageSize <= 0) {
    return rows
  }

  return rows
}

export function getVirtualDataRangeForRenderedRange<TData>({
  renderableRows,
  rowStartIndex,
  rowStopIndex,
}: {
  renderableRows: RenderableRow<TData>[]
  rowStartIndex: number
  rowStopIndex: number
}): { dataStartIndex: number; dataStopIndex: number } | null {
  let dataStartIndex: number | null = null
  let dataStopIndex: number | null = null
  const startIndex = Math.max(0, rowStartIndex)
  const stopIndex = Math.min(renderableRows.length - 1, rowStopIndex)

  for (let renderedIndex = startIndex; renderedIndex <= stopIndex; renderedIndex += 1) {
    const row = renderableRows[renderedIndex]
    if (!row || row.type === "group-header") {
      continue
    }

    const dataIndex = row.type === "loading" ? row.dataIndex : row.dataIndex
    if (dataIndex === undefined) {
      continue
    }

    dataStartIndex = dataStartIndex === null ? dataIndex : Math.min(dataStartIndex, dataIndex)
    dataStopIndex = dataStopIndex === null ? dataIndex : Math.max(dataStopIndex, dataIndex)
  }

  if (dataStartIndex === null || dataStopIndex === null) {
    return null
  }

  return { dataStartIndex, dataStopIndex }
}

function buildLoadedRowsByDataIndex<TData>({
  pagesByOffset,
  totalDataRows,
}: {
  pagesByOffset: Map<number, OnlineQueryResponse<TData>>
  totalDataRows: number
}) {
  const loadedRowsByDataIndex = new Map<number, Extract<RenderableRow<TData>, { type: "data" }>>()

  for (const [offset, page] of pagesByOffset) {
    let dataIndex = offset

    for (const row of page.rows) {
      if (row.type !== "data") {
        continue
      }

      const targetDataIndex = row.dataIndex ?? dataIndex

      if (targetDataIndex >= totalDataRows) {
        break
      }

      loadedRowsByDataIndex.set(targetDataIndex, {
        type: "data",
        rowId: row.rowId,
        data: row.item,
        dataIndex: targetDataIndex,
        groupPath: row.groupPath,
      })
      dataIndex = Math.max(dataIndex + 1, targetDataIndex + 1)
    }
  }

  return loadedRowsByDataIndex
}

function buildGroupedSparseVirtualRows<TData>({
  loadedRowsByDataIndex,
  groupingSummary,
  totalDataRows,
}: {
  loadedRowsByDataIndex: Map<number, Extract<RenderableRow<TData>, { type: "data" }>>
  groupingSummary: OnlineGroupingSummary
  totalDataRows: number
}): RenderableRow<TData>[] {
  const rows: RenderableRow<TData>[] = []
  let dataIndex = 0

  for (const [groupId, group] of Object.entries(groupingSummary.groups)) {
    rows.push(createGroupHeader({ groupId, depth: 0, count: group.total, groupPath: [] }))

    const subgroupEntries = Object.entries(group.subgroups ?? {})
    if (subgroupEntries.length > 0) {
      for (const [subgroupId, subgroup] of subgroupEntries) {
        rows.push(
          createGroupHeader({
            groupId: subgroupId,
            depth: 1,
            count: subgroup.total,
            groupPath: [groupId],
          }),
        )

        for (let index = 0; index < subgroup.total && dataIndex < totalDataRows; index += 1) {
          rows.push(
            createDataOrLoadingRow({
              loadedRowsByDataIndex,
              dataIndex,
              groupPath: [groupId, subgroupId],
            }),
          )
          dataIndex += 1
        }
      }
      continue
    }

    for (let index = 0; index < group.total && dataIndex < totalDataRows; index += 1) {
      rows.push(createDataOrLoadingRow({ loadedRowsByDataIndex, dataIndex, groupPath: [groupId] }))
      dataIndex += 1
    }
  }

  while (dataIndex < totalDataRows) {
    rows.push(createDataOrLoadingRow({ loadedRowsByDataIndex, dataIndex, groupPath: [] }))
    dataIndex += 1
  }

  return rows
}

function createDataOrLoadingRow<TData>({
  loadedRowsByDataIndex,
  dataIndex,
  groupPath,
}: {
  loadedRowsByDataIndex: Map<number, Extract<RenderableRow<TData>, { type: "data" }>>
  dataIndex: number
  groupPath: string[]
}): RenderableRow<TData> {
  return (
    loadedRowsByDataIndex.get(dataIndex) ?? {
      type: "loading",
      rowId: `__loading_${dataIndex}`,
      dataIndex,
      groupPath,
    }
  )
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
}): Extract<RenderableRow<unknown>, { type: "group-header" }> {
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
