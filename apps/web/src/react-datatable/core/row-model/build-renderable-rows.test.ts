import { describe, expect, test } from "vitest"

import { ALL_GROUPS_EXPANDED_MARKER } from "../../features/grouping/group-expansion"
import type { GroupingConfig } from "../../types/renderable-row.types"
import { buildRenderableRows } from "./build-renderable-rows"

type Row = {
  id: string
  priority: string
  status: string
}

const baseConfig = {
  expandedGroups: new Set([ALL_GROUPS_EXPANDED_MARKER]),
  getGroupValue: (columnId, row) => row[columnId as "priority" | "status"],
  getRowId: (row) => row.id,
  groupByColumns: ["status"],
} satisfies GroupingConfig<Row>

describe("buildRenderableRows", () => {
  test("uses exact group counts when cursor rows only contain a loaded prefix", () => {
    const rows = buildRenderableRows(
      [
        { data: { id: "tsk_1", priority: "high", status: "ready" }, rowId: "tsk_1" },
        { data: { id: "tsk_2", priority: "low", status: "ready" }, rowId: "tsk_2" },
      ],
      {
        ...baseConfig,
        getGroupCount: (groupId) => (groupId === "status:ready" ? 5 : undefined),
      },
    )

    expect(rows[0]).toMatchObject({
      count: 5,
      groupId: "status:ready",
      type: "group-header",
    })
  })

  test("uses exact subgroup counts from the full-result summary", () => {
    const rows = buildRenderableRows(
      [{ data: { id: "tsk_1", priority: "high", status: "ready" }, rowId: "tsk_1" }],
      {
        ...baseConfig,
        getGroupCount: (groupId) =>
          groupId === "status:ready|priority:high" ? 3 : groupId === "status:ready" ? 7 : undefined,
        groupByColumns: ["status", "priority"],
      },
    )

    expect(rows[0]).toMatchObject({ count: 7, groupId: "status:ready" })
    expect(rows[1]).toMatchObject({ count: 3, groupId: "status:ready|priority:high" })
  })

  test("merges loaded cursor pages into one group header across page boundaries", () => {
    const rows = buildRenderableRows(
      [
        { data: { id: "tsk_1", priority: "high", status: "ready" }, rowId: "tsk_1" },
        { data: { id: "tsk_2", priority: "low", status: "ready" }, rowId: "tsk_2" },
        { data: { id: "tsk_3", priority: "high", status: "ready" }, rowId: "tsk_3" },
        { data: { id: "tsk_4", priority: "high", status: "done" }, rowId: "tsk_4" },
      ],
      {
        ...baseConfig,
        getGroupCount: (groupId) =>
          groupId === "status:ready" ? 3 : groupId === "status:done" ? 1 : undefined,
      },
    )

    expect(rows.filter((row) => row.type === "group-header").map((row) => row.groupId)).toEqual([
      "status:done",
      "status:ready",
    ])
  })
})
