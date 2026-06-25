import { describe, expect, test } from "vitest"

import {
  appendCursorGrowthRunwayRows,
  buildCursorGrowthRenderableRows,
  resolveCursorGrowthFetchIntent,
} from "./cursor-growth-virtualization"

type Row = {
  id: string
  title: string
}

const rows: Row[] = [
  { id: "1", title: "One" },
  { id: "2", title: "Two" },
]

describe("cursor growth virtualization", () => {
  test("renders loaded rows plus finite runway instead of full-result height", () => {
    const renderableRows = buildCursorGrowthRenderableRows({
      getRowId: (row) => row.id,
      hasMore: true,
      rows,
      runwayRows: 3,
    })

    expect(renderableRows).toHaveLength(5)
    expect(renderableRows.map((row) => row.type)).toEqual([
      "data",
      "data",
      "loading",
      "loading",
      "loading",
    ])
    expect(renderableRows[2]).toMatchObject({ dataIndex: 2, rowId: "__cursor_runway_2" })
  })

  test("omits runway rows when there is no next cursor page", () => {
    const renderableRows = buildCursorGrowthRenderableRows({
      getRowId: (row) => row.id,
      hasMore: false,
      rows,
      runwayRows: 3,
    })

    expect(renderableRows).toHaveLength(2)
    expect(renderableRows.every((row) => row.type === "data")).toBe(true)
  })

  test("preserves grouped renderable rows and appends finite runway rows", () => {
    const renderableRows = appendCursorGrowthRunwayRows({
      hasMore: true,
      renderableRows: [
        {
          columnId: "status",
          count: 5,
          depth: 0,
          groupId: "status:ready",
          groupPath: [],
          isExpanded: true,
          type: "group-header",
          value: "ready",
        },
        {
          data: rows[0],
          dataIndex: 0,
          groupPath: ["status:ready"],
          rowId: "1",
          type: "data",
        },
      ],
      runwayRows: 2,
    })

    expect(renderableRows.map((row) => row.type)).toEqual([
      "group-header",
      "data",
      "loading",
      "loading",
    ])
    expect(renderableRows[0]).toMatchObject({ groupId: "status:ready", type: "group-header" })
    expect(renderableRows[2]).toMatchObject({ dataIndex: 1, rowId: "__cursor_runway_1" })
  })

  test("requests the next cursor page when the viewport enters the bottom runway", () => {
    const intent = resolveCursorGrowthFetchIntent({
      hasMore: true,
      isFetchingNextPage: false,
      lastFetchSignature: null,
      loadedRowCount: 2,
      nextCursor: "cursor-2",
      querySignature: "tasks:default",
      range: { rowStartIndex: 2, rowStopIndex: 4 },
    })

    expect(intent).toEqual({
      cursor: "cursor-2",
      fetchSignature: "tasks:default:2",
      type: "next-page",
    })
  })

  test("requests the next cursor page before the runway when a prefetch threshold is configured", () => {
    const intent = resolveCursorGrowthFetchIntent({
      hasMore: true,
      isFetchingNextPage: false,
      lastFetchSignature: null,
      loadedRowCount: 50,
      nextCursor: "cursor-50",
      prefetchThresholdRows: 20,
      querySignature: "tasks:default",
      range: { rowStartIndex: 24, rowStopIndex: 31 },
    })

    expect(intent).toEqual({
      cursor: "cursor-50",
      fetchSignature: "tasks:default:50",
      type: "next-page",
    })
  })

  test("waits when the viewport is above the configured prefetch threshold", () => {
    const intent = resolveCursorGrowthFetchIntent({
      hasMore: true,
      isFetchingNextPage: false,
      lastFetchSignature: null,
      loadedRowCount: 50,
      nextCursor: "cursor-50",
      prefetchThresholdRows: 20,
      querySignature: "tasks:default",
      range: { rowStartIndex: 20, rowStopIndex: 29 },
    })

    expect(intent).toBeNull()
  })

  test("does not cascade fetches while the same loaded-count signature is pending", () => {
    const intent = resolveCursorGrowthFetchIntent({
      hasMore: true,
      isFetchingNextPage: false,
      lastFetchSignature: "tasks:default:2",
      loadedRowCount: 2,
      nextCursor: "cursor-2",
      querySignature: "tasks:default",
      range: { rowStartIndex: 2, rowStopIndex: 4 },
    })

    expect(intent).toBeNull()
  })
})
