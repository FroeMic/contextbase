import { describe, expect, test } from "vitest"

import { buildVerticalScrollSignature } from "./scroll-restoration-signature"

const queryShape = {
  filters: [{ id: "status", value: "ready" }],
  globalFilter: "ship",
  grouping: { columns: ["status"], showEmptyGroups: false },
  limit: 50,
}

describe("vertical scroll restoration signatures", () => {
  test("keeps cursor-mode vertical scroll stable when appended rows change row counts", () => {
    const beforeAppend = buildVerticalScrollSignature({
      coreRowCount: 50,
      mode: "cursor",
      queryShape,
      rowCount: 70,
      tableKey: "business.tasks.overview",
    })
    const afterAppend = buildVerticalScrollSignature({
      coreRowCount: 100,
      mode: "cursor",
      queryShape,
      rowCount: 120,
      tableKey: "business.tasks.overview",
    })

    expect(afterAppend).toBe(beforeAppend)
  })

  test("keeps local-mode row-count changes in the vertical scroll signature", () => {
    const beforeAppend = buildVerticalScrollSignature({
      coreRowCount: 50,
      mode: "local",
      queryShape,
      rowCount: 50,
      tableKey: "business.tasks",
    })
    const afterAppend = buildVerticalScrollSignature({
      coreRowCount: 100,
      mode: "local",
      queryShape,
      rowCount: 100,
      tableKey: "business.tasks",
    })

    expect(afterAppend).not.toBe(beforeAppend)
  })
})
