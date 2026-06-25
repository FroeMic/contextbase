import { describe, expect, test, vi } from "vitest"

import { createInfrastructureRequestHandler } from "./server-infrastructure"

describe("server infrastructure routing", () => {
  test("routes PostHog ingest requests outside the API router", async () => {
    const fetch = vi.fn(async (_request: Request) => Response.json({ ok: true }, { status: 202 }))
    const handler = createInfrastructureRequestHandler({
      fetch,
      env: {
        POSTHOG_ASSET_PROXY_TARGET: "https://eu-assets.i.posthog.com",
        POSTHOG_PROXY_TARGET: "https://eu.i.posthog.com",
      },
    })

    const response = await handler(
      new Request("https://console.example.com/ingest/e/?ip=1", {
        body: "{}",
        method: "POST",
      }),
    )

    expect(response?.status).toBe(202)
    expect(fetch).toHaveBeenCalledTimes(1)
    const request = fetch.mock.calls[0]?.[0]
    if (!request) throw new Error("Expected proxied request")
    expect(request.url).toBe("https://eu.i.posthog.com/e/?ip=1")
  })

  test("returns null when PostHog proxy targets are not configured", async () => {
    const fetch = vi.fn()
    const handler = createInfrastructureRequestHandler({
      env: {},
      fetch,
    })

    await expect(handler(new Request("https://console.example.com/ingest/e/"))).resolves.toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
})
