import { describe, expect, test } from "vitest"

import { createApiApp } from "../app"
import { createLogger, redactLogFields } from "./logger"

describe("operability logger", () => {
  test("redacts token-shaped fields recursively", () => {
    expect(
      redactLogFields({
        apiToken: "cbt_secret",
        authorization: "Bearer token",
        nested: {
          claimToken: "claim-secret",
          tokenHash: "hash-secret",
        },
        safeId: "tsk_123",
      }),
    ).toEqual({
      apiToken: "[redacted]",
      authorization: "[redacted]",
      nested: {
        claimToken: "[redacted]",
        tokenHash: "[redacted]",
      },
      safeId: "tsk_123",
    })
  })

  test("logs requests without query strings or secret headers", async () => {
    const entries: unknown[] = []
    const logger = createLogger({
      sink: (entry) => entries.push(entry),
    })

    const response = await createApiApp({ logger }).request("/healthz?api_token=secret", {
      headers: {
        authorization: "Bearer secret",
      },
    })

    expect(response.status).toBe(200)
    expect(entries).toMatchObject([
      {
        event: "http_request",
        level: "info",
        method: "GET",
        path: "/healthz",
        status: 200,
      },
    ])
    expect(JSON.stringify(entries)).not.toContain("secret")
  })
})
