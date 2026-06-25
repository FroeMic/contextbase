import { describe, expect, test } from "vitest"

import type { OnlineGroupingSummary } from "../../types/props.types"
import { createOnlineGroupingSummaryCountGetter } from "./grouping-summary-counts"

describe("createOnlineGroupingSummaryCountGetter", () => {
  test("reads primary and subgroup totals by renderable group id", () => {
    const summary: OnlineGroupingSummary = {
      groups: {
        "status:ready": {
          renderedRowCount: 8,
          subgroups: {
            "status:ready|priority:high": {
              renderedRowCount: 4,
              total: 3,
            },
          },
          total: 7,
        },
      },
    }

    const getCount = createOnlineGroupingSummaryCountGetter(summary)

    expect(getCount?.("status:ready")).toBe(7)
    expect(getCount?.("status:ready|priority:high")).toBe(3)
    expect(getCount?.("status:ready|priority:low")).toBeUndefined()
  })
})
