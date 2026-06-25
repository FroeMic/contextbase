import { describe, expect, test } from "vitest"

import {
  buildGridVisibleColumnOrder,
  DATATABLE_SELECTION_COLUMN_ID,
  getEffectiveFrozenColumnsCount,
} from "./selection-columns"

describe("selection columns", () => {
  test("can keep selection enabled without prepending the visible selection column", () => {
    expect(buildGridVisibleColumnOrder(["name", "status"], true, false)).toEqual(["name", "status"])
    expect(getEffectiveFrozenColumnsCount(1, true, false)).toBe(1)
  })

  test("prepends the selection column when selection UI is visible", () => {
    expect(buildGridVisibleColumnOrder(["name"], true, true)).toEqual([
      DATATABLE_SELECTION_COLUMN_ID,
      "name",
    ])
    expect(getEffectiveFrozenColumnsCount(1, true, true)).toBe(2)
  })
})
