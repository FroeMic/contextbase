import { describe, expect, test } from "vitest"

import { resolveDatatableColumnOrder } from "./use-datatable-table"

describe("resolveDatatableColumnOrder", () => {
  test("appends newly defined columns to an existing persisted order", () => {
    expect(
      resolveDatatableColumnOrder(
        ["name", "stage", "email", "phone", "linkedinUrl", "updatedAt"],
        ["name", "stage", "email", "phone", "updatedAt"],
      ),
    ).toEqual(["name", "stage", "email", "phone", "updatedAt", "linkedinUrl"])
  })

  test("drops stale persisted columns that no longer exist", () => {
    expect(resolveDatatableColumnOrder(["name", "email"], ["name", "old", "email"])).toEqual([
      "name",
      "email",
    ])
  })
})
