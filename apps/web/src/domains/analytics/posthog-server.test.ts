import { describe, expect, test, vi } from "vitest"

import {
  createPostHogProxyRequestHandler,
  getBrowserPostHogConfig,
  serializeBrowserPostHogConfig,
} from "./posthog-server"

describe("PostHog server integration", () => {
  test("proxies ingest requests to the configured ingest target without browser cookies", async () => {
    const fetch = vi.fn(async (_request: Request) => new Response("ok", { status: 202 }))
    const handler = createPostHogProxyRequestHandler({
      assetTarget: "https://eu-assets.i.posthog.com",
      fetch,
      ingestTarget: "https://eu.i.posthog.com",
    })

    const response = await handler(
      new Request("https://console.example.com/ingest/e/?ip=1", {
        body: "payload",
        headers: {
          cookie: "contextbase_session=secret",
          host: "console.example.com",
        },
        method: "POST",
      }),
    )

    expect(response?.status).toBe(202)
    expect(fetch).toHaveBeenCalledTimes(1)
    const [request] = fetch.mock.calls[0] ?? []
    if (!request) throw new Error("Expected proxied request")
    expect(request.url).toBe("https://eu.i.posthog.com/e/?ip=1")
    expect(request.method).toBe("POST")
    expect(request.headers.get("cookie")).toBeNull()
    expect(request.headers.get("host")).toBeNull()
    await expect(request.text()).resolves.toBe("payload")
  })

  test("proxies PostHog remote config and static asset requests to the asset target", async () => {
    const fetch = vi.fn(async (_request: Request) => new Response("asset", { status: 200 }))
    const handler = createPostHogProxyRequestHandler({
      assetTarget: "https://eu-assets.i.posthog.com",
      fetch,
      ingestTarget: "https://eu.i.posthog.com",
    })

    await handler(new Request("https://console.example.com/ingest/array/phc_123/config?ip=0"))
    await handler(new Request("https://console.example.com/ingest/static/recorder.js"))

    const firstRequest = fetch.mock.calls[0]?.[0]
    const secondRequest = fetch.mock.calls[1]?.[0]
    if (!firstRequest || !secondRequest) throw new Error("Expected proxied asset requests")
    expect(firstRequest.url).toBe("https://eu-assets.i.posthog.com/array/phc_123/config?ip=0")
    expect(secondRequest.url).toBe("https://eu-assets.i.posthog.com/static/recorder.js")
  })

  test("returns null for non-ingest paths", async () => {
    const fetch = vi.fn()
    const handler = createPostHogProxyRequestHandler({
      assetTarget: "https://eu-assets.i.posthog.com",
      fetch,
      ingestTarget: "https://eu.i.posthog.com",
    })

    await expect(handler(new Request("https://console.example.com/tasks"))).resolves.toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  test("creates browser runtime config only when production analytics is enabled", () => {
    expect(
      getBrowserPostHogConfig({
        NODE_ENV: "production",
        POSTHOG_ENABLED: "true",
        POSTHOG_HOST: "/ingest",
        POSTHOG_TOKEN: "phc_test",
      }),
    ).toEqual({
      apiHost: "/ingest",
      enabled: true,
      environment: "production",
      token: "phc_test",
      uiHost: "https://eu.posthog.com",
    })

    expect(
      getBrowserPostHogConfig({
        NODE_ENV: "development",
        POSTHOG_ENABLED: "true",
        POSTHOG_TOKEN: "phc_test",
      }),
    ).toBeNull()
  })

  test("prefers POSTHOG_BROWSER_HOST over the legacy POSTHOG_HOST", () => {
    expect(
      getBrowserPostHogConfig({
        NODE_ENV: "production",
        POSTHOG_BROWSER_HOST: "/browser-ingest",
        POSTHOG_ENABLED: "true",
        POSTHOG_HOST: "/legacy-ingest",
        POSTHOG_TOKEN: "phc_test",
      }),
    ).toMatchObject({
      apiHost: "/browser-ingest",
    })
  })

  test("includes browser exception metadata in runtime config", () => {
    expect(
      getBrowserPostHogConfig({
        NODE_ENV: "production",
        POSTHOG_ENABLED: "true",
        POSTHOG_ENVIRONMENT: "staging",
        POSTHOG_SERVICE_VERSION: "sha_123",
        POSTHOG_TOKEN: "phc_test",
      }),
    ).toMatchObject({
      environment: "staging",
      serviceVersion: "sha_123",
    })
  })

  test("serializes browser config safely for script injection", () => {
    expect(
      serializeBrowserPostHogConfig({
        apiHost: "/ingest",
        enabled: true,
        environment: "production",
        token: "phc_<script>",
        uiHost: "https://eu.posthog.com",
      }),
    ).toContain("phc_\\u003cscript>")
  })
})
