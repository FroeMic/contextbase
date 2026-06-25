import { describe, expect, test } from "vitest"

import {
  buildInfiniteOnlineQueryKey,
  buildOnlineQueryStateInput,
  buildPaginationOnlineQueryKey,
  ONLINE_QUERY_STALE_TIME_MS,
} from "./online-query-keys"

describe("online query key helpers", () => {
  test("builds the normalized online query state used by route loaders and mounted tables", () => {
    expect(
      buildOnlineQueryStateInput({
        filters: [{ id: "status", payload: { mode: "include", values: ["backlog"] }, type: "text-list" }],
        globalFilter: "paperclip",
        groupExpanded: { "status:backlog": false },
        groupingColumns: ["status"],
        limit: 250,
        mode: "infinite",
        showEmptyGroups: false,
        sorting: [{ desc: true, id: "updatedAt" }],
      }),
    ).toEqual({
      filters: [{ id: "status", payload: { mode: "include", values: ["backlog"] }, type: "text-list" }],
      globalFilter: "paperclip",
      grouping: {
        columns: ["status"],
        expansion: { defaultExpanded: true, overrides: {} },
        showEmptyGroups: false,
      },
      limit: 250,
      sorting: [{ desc: true, id: "updatedAt" }],
    })
  })

  test("builds stable online query keys for pagination and infinite mode", () => {
    const baseKey = ["tasks", "table", "biz_123"] as const
    const queryStateSignature = JSON.stringify({ limit: 250 })

    expect(buildInfiniteOnlineQueryKey(baseKey, queryStateSignature)).toEqual([
      "tasks",
      "table",
      "biz_123",
      "infinite",
      queryStateSignature,
    ])
    expect(buildPaginationOnlineQueryKey(baseKey, queryStateSignature, 2)).toEqual([
      "tasks",
      "table",
      "biz_123",
      "pagination",
      queryStateSignature,
      2,
    ])
    expect(ONLINE_QUERY_STALE_TIME_MS).toBe(5 * 60 * 1000)
  })
})
