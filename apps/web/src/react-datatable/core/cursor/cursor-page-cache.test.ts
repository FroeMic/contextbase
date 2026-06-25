import { describe, expect, test } from "vitest"

import {
  appendCursorPage,
  buildCursorQueryInput,
  createCursorPageCache,
  resetCursorPageCacheForSignature,
} from "./cursor-page-cache"

type Row = {
  id: string
}

describe("cursor page cache", () => {
  test("builds cursor query inputs without offset semantics", () => {
    const input = buildCursorQueryInput({
      cursor: null,
      filters: [],
      globalFilter: "",
      grouping: undefined,
      limit: 50,
      queryOptions: { showSubtasks: true },
      sorting: [],
    })

    expect(input.mode).toBe("cursor")
    expect(input.cursor).toBeNull()
    expect(input.limit).toBe(50)
    expect("offset" in input).toBe(false)
    expect("pageIndex" in input).toBe(false)
  })

  test("appends cursor pages in load order", () => {
    const cache = createCursorPageCache<Row, string>({
      signature: "tasks:status",
    })

    const first = appendCursorPage(cache, {
      cursor: null,
      hasMore: true,
      nextCursor: "cursor-2",
      rows: [{ id: "1" }],
    })
    const second = appendCursorPage(first, {
      cursor: "cursor-2",
      hasMore: false,
      nextCursor: null,
      rows: [{ id: "2" }],
    })

    expect(second.pages).toHaveLength(2)
    expect(second.rows).toEqual([{ id: "1" }, { id: "2" }])
    expect(second.nextCursor).toBeNull()
    expect(second.hasMore).toBe(false)
  })

  test("resets loaded pages when the query signature changes", () => {
    const cache = appendCursorPage(
      createCursorPageCache<Row, string>({
        signature: "tasks:status",
      }),
      {
        cursor: null,
        hasMore: true,
        nextCursor: "cursor-2",
        rows: [{ id: "1" }],
      },
    )

    const same = resetCursorPageCacheForSignature(cache, "tasks:status")
    const reset = resetCursorPageCacheForSignature(cache, "tasks:priority")

    expect(same).toBe(cache)
    expect(reset.signature).toBe("tasks:priority")
    expect(reset.pages).toEqual([])
    expect(reset.rows).toEqual([])
    expect(reset.nextCursor).toBeNull()
  })
})
