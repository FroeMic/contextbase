import { describe, expect, test } from "vitest"

import { summarizeOptionFilterValues } from "./option-list-filter"

describe("option list filter helpers", () => {
  test("summarizes selected option values with their display labels", () => {
    expect(
      summarizeOptionFilterValues(
        [
          { label: "Michael", value: "usr_123" },
          { label: "Rebuild the task foundation", value: "gol_123" },
          { label: "In Progress", value: "in_progress" },
        ],
        ["usr_123", "gol_123", "in_progress"],
      ),
    ).toBe("Michael, Rebuild the task foundation, In Progress")
  })

  test("falls back to raw values when options are missing and keeps empty summary behavior", () => {
    expect(summarizeOptionFilterValues([{ label: "Michael", value: "usr_123" }], [])).toBe("empty")
    expect(summarizeOptionFilterValues([{ label: "Michael", value: "usr_123" }], ["usr_404"])).toBe(
      "usr_404",
    )
  })
})
