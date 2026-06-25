import { describe, expect, test, vi } from "vitest"

import { readZeroFirstPaintQuery } from "./zero-first-paint-query"

describe("readZeroFirstPaintQuery", () => {
  test("preloads, reads the complete query result, returns ready, and cleans up the preload", async () => {
    const cleanup = vi.fn()
    const zero = {
      preload: vi.fn(() => ({ cleanup, complete: Promise.resolve() })),
      run: vi.fn(async () => ({ id: "row_123" })),
    }
    const query = { queryName: "detail" }

    await expect(readZeroFirstPaintQuery(zero, query as never)).resolves.toEqual({
      data: { id: "row_123" },
      status: "ready",
    })
    expect(zero.preload).toHaveBeenCalledWith(query, { ttl: "5m" })
    expect(zero.run).toHaveBeenCalledWith(query, { ttl: "5m", type: "complete" })
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  test("times out and cleans up when Zero preload never completes", async () => {
    vi.useFakeTimers()
    try {
      const cleanup = vi.fn()
      const zero = {
        preload: vi.fn(() => ({ cleanup, complete: new Promise<void>(() => undefined) })),
        run: vi.fn(async () => ({ id: "row_123" })),
      }
      const query = { queryName: "detail" }

      const result = readZeroFirstPaintQuery(zero, query as never, { timeoutMs: 25 })
      await vi.advanceTimersByTimeAsync(25)

      await expect(result).resolves.toEqual({ status: "timeout", timeoutMs: 25 })
      expect(zero.run).not.toHaveBeenCalled()
      expect(cleanup).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  test("times out and cleans up when Zero complete read never resolves", async () => {
    vi.useFakeTimers()
    try {
      const cleanup = vi.fn()
      const zero = {
        preload: vi.fn(() => ({ cleanup, complete: Promise.resolve() })),
        run: vi.fn(() => new Promise(() => undefined)),
      }
      const query = { queryName: "detail" }

      const result = readZeroFirstPaintQuery(zero, query as never, { timeoutMs: 25 })
      await vi.advanceTimersByTimeAsync(25)

      await expect(result).resolves.toEqual({ status: "timeout", timeoutMs: 25 })
      expect(cleanup).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
