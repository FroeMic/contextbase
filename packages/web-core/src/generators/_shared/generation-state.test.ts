import { describe, expect, test } from "vitest"

import {
  createMockGenerationItems,
  markGenerationItemCompleted,
  summarizeGenerationItems,
} from "./generation-state"

describe("generation state helpers", () => {
  test("creates exactly 10 queued generation items", () => {
    const items = createMockGenerationItems({ jobId: "job_123", count: 10 })

    expect(items).toHaveLength(10)
    expect(items[0]).toMatchObject({ jobId: "job_123", position: 1, status: "queued" })
    expect(items[9]).toMatchObject({ jobId: "job_123", position: 10, status: "queued" })
  })

  test("marks an item completed with an output asset id", () => {
    const [item] = createMockGenerationItems({ jobId: "job_123", count: 1 })

    const completed = markGenerationItemCompleted(item, "asset_123")

    expect(completed.status).toBe("completed")
    expect(completed.outputAssetId).toBe("asset_123")
  })

  test("summarizes queued, generating, completed, and failed items", () => {
    const items = [
      { id: "item_1", jobId: "job_123", position: 1, status: "queued" },
      { id: "item_2", jobId: "job_123", position: 2, status: "generating" },
      {
        id: "item_3",
        jobId: "job_123",
        position: 3,
        status: "completed",
        outputAssetId: "asset_123",
      },
      { id: "item_4", jobId: "job_123", position: 4, status: "failed" },
    ] as const

    expect(summarizeGenerationItems(items)).toEqual({
      total: 4,
      queued: 1,
      generating: 1,
      completed: 1,
      failed: 1,
    })
  })
})
