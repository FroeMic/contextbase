import { describe, expect, test } from "vitest"

import { createIpRateLimiter, rejectOversizedRequest } from "./request-guards"

describe("request guards", () => {
  test("rejects requests with content-length above the configured limit", () => {
    const request = new Request("https://vertical.example.com/api/auth/session", {
      headers: { "content-length": "1025" },
      method: "POST",
    })

    const response = rejectOversizedRequest(request, 1024)

    expect(response?.status).toBe(413)
  })

  test("rate limiter rejects after the allowed window count", () => {
    const limiter = createIpRateLimiter({ maxRequests: 1, windowMs: 60_000 })
    const request = new Request("https://vertical.example.com/api/auth/magic-link/request", {
      headers: { "x-forwarded-for": "203.0.113.5" },
      method: "POST",
    })

    expect(limiter(request, 1_000)).toBeNull()
    expect(limiter(request, 1_001)?.status).toBe(429)
  })
})
