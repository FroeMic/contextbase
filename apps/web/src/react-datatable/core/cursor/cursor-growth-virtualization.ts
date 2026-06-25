import type { RenderableRow } from "../../types/renderable-row.types"
import type { RenderedRowRange } from "../loading/range-loader"

export type CursorGrowthFetchIntent<TCursor> = {
  type: "next-page"
  cursor: TCursor | null
  fetchSignature: string
}

export function buildCursorGrowthRenderableRows<TData>({
  getRowId,
  hasMore,
  rows,
  runwayRows,
}: {
  getRowId: (row: TData, index: number) => string
  hasMore: boolean
  rows: readonly TData[]
  runwayRows: number
}): RenderableRow<TData>[] {
  const renderableRows: RenderableRow<TData>[] = rows.map((row, index) => ({
    type: "data",
    rowId: getRowId(row, index),
    data: row,
    dataIndex: index,
    groupPath: [],
  }))

  if (!hasMore) {
    return renderableRows
  }

  const runwayCount = Math.max(0, Math.floor(runwayRows))
  for (let offset = 0; offset < runwayCount; offset += 1) {
    const dataIndex = rows.length + offset
    renderableRows.push({
      type: "loading",
      rowId: `__cursor_runway_${dataIndex}`,
      dataIndex,
      groupPath: [],
    })
  }

  return renderableRows
}

export function appendCursorGrowthRunwayRows<TData>({
  hasMore,
  renderableRows,
  runwayRows,
}: {
  hasMore: boolean
  renderableRows: readonly RenderableRow<TData>[]
  runwayRows: number
}): RenderableRow<TData>[] {
  if (!hasMore) {
    return [...renderableRows]
  }

  const dataRows = renderableRows.filter((row) => row.type === "data")
  const nextDataIndex =
    dataRows.reduce(
      (max, row) => Math.max(max, typeof row.dataIndex === "number" ? row.dataIndex : -1),
      -1,
    ) + 1
  const withRunway = [...renderableRows]
  const runwayCount = Math.max(0, Math.floor(runwayRows))
  for (let offset = 0; offset < runwayCount; offset += 1) {
    const dataIndex = nextDataIndex + offset
    withRunway.push({
      type: "loading",
      rowId: `__cursor_runway_${dataIndex}`,
      dataIndex,
      groupPath: [],
    })
  }

  return withRunway
}

export function resolveCursorGrowthFetchIntent<TCursor>({
  hasMore,
  isFetchingNextPage,
  lastFetchSignature,
  loadedRowCount,
  nextCursor,
  prefetchThresholdRows = 0,
  querySignature,
  range,
}: {
  hasMore: boolean
  isFetchingNextPage: boolean
  lastFetchSignature: string | null
  loadedRowCount: number
  nextCursor: TCursor | null
  prefetchThresholdRows?: number
  querySignature: string
  range: RenderedRowRange
}): CursorGrowthFetchIntent<TCursor> | null {
  if (!hasMore || isFetchingNextPage || loadedRowCount < 0) {
    return null
  }

  const thresholdRows = Math.max(0, Math.floor(prefetchThresholdRows))
  const triggerRowIndex = Math.max(0, loadedRowCount - thresholdRows)
  if (range.rowStopIndex < triggerRowIndex) {
    return null
  }

  const fetchSignature = `${querySignature}:${loadedRowCount}`
  if (fetchSignature === lastFetchSignature) {
    return null
  }

  return {
    type: "next-page",
    cursor: nextCursor,
    fetchSignature,
  }
}
