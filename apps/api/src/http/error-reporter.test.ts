import { describe, expect, test, vi } from "vitest"

import {
  createNoopApiErrorReporter,
  createPostHogApiErrorReporter,
  type PostHogNodeClient,
  type PostHogNodeModule,
} from "./error-reporter"

const logger = () => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
})

describe("API error reporter", () => {
  test("disabled env returns a no-op reporter without loading PostHog", async () => {
    const loadPostHog = vi.fn()
    const reporter = await createPostHogApiErrorReporter(
      {
        POSTHOG_ENABLED: "false",
        POSTHOG_TOKEN: "ph_test",
      },
      logger(),
      { loadPostHog },
    )

    await reporter.captureException(new Error("boom"), {
      method: "GET",
      path: "/api/v1/things",
      routeKind: "route_500_response",
      serviceName: "contextbase-api",
      status: 500,
    })
    await reporter.flush()

    expect(loadPostHog).not.toHaveBeenCalled()
  })

  test("missing token returns a no-op reporter", async () => {
    const loadPostHog = vi.fn()
    const reporter = await createPostHogApiErrorReporter(
      {
        POSTHOG_ENABLED: "true",
        POSTHOG_TOKEN: "",
      },
      logger(),
      { loadPostHog },
    )

    await reporter.captureException("boom", {
      method: "GET",
      path: "/api/v1/things",
      routeKind: "route_500_response",
      serviceName: "contextbase-api",
      status: 500,
    })

    expect(loadPostHog).not.toHaveBeenCalled()
  })

  test("SDK load failure logs a warning and returns a no-op reporter", async () => {
    const testLogger = logger()
    const reporter = await createPostHogApiErrorReporter(
      {
        POSTHOG_ENABLED: "true",
        POSTHOG_TOKEN: "ph_test",
      },
      testLogger,
      {
        loadPostHog: vi.fn(async () => {
          throw new Error("posthog-node unavailable")
        }),
      },
    )

    await reporter.captureException(new Error("boom"), {
      method: "GET",
      path: "/api/v1/things",
      routeKind: "route_500_response",
      serviceName: "contextbase-api",
      status: 500,
    })

    expect(testLogger.warn).toHaveBeenCalledWith(
      "posthog_error_tracking_disabled",
      expect.objectContaining({ cause: "Error: posthog-node unavailable" }),
    )
  })

  test("enabled env captures exceptions with bounded safe properties", async () => {
    const client: PostHogNodeClient = {
      captureException: vi.fn(),
      flush: vi.fn(async () => undefined),
    }

    const reporter = await createPostHogApiErrorReporter(
      {
        NODE_ENV: "production",
        POSTHOG_ENABLED: "true",
        POSTHOG_ENVIRONMENT: "staging",
        POSTHOG_SERVER_HOST: "https://eu.i.posthog.com",
        POSTHOG_SERVICE_VERSION: "sha_123",
        POSTHOG_TOKEN: "ph_test",
      },
      logger(),
      {
        loadPostHog: vi.fn(async () => ({
          PostHog: class {
            captureException = client.captureException
            flush = client.flush

            constructor(token: string, options: { host: string }) {
              expect(token).toBe("ph_test")
              expect(options.host).toBe("https://eu.i.posthog.com")
            }
          } as PostHogNodeModule["PostHog"],
        })),
      },
    )

    await reporter.captureException("database exploded", {
      auth: {
        principalId: "usr_123",
        principalKind: "user",
        workspaceId: "wrk_123",
        workspaceSlug: "core",
      },
      errorCode: "internal_error",
      method: "POST",
      path: "/api/v1/workspaces?include=secret",
      requestId: "req_123",
      routeKind: "route_500_response",
      serviceName: "contextbase-api",
      status: 500,
    })

    expect(client.captureException).toHaveBeenCalledWith(expect.any(Error), "usr_123", {
      environment: "staging",
      error_code: "internal_error",
      method: "POST",
      path: "/api/v1/workspaces",
      principal_id: "usr_123",
      principal_kind: "user",
      request_id: "req_123",
      route_kind: "route_500_response",
      service_name: "contextbase-api",
      service_version: "sha_123",
      status: 500,
      workspace_id: "wrk_123",
      workspace_slug: "core",
    })
  })

  test("noop reporter methods are safe", async () => {
    const reporter = createNoopApiErrorReporter()

    await reporter.captureException(new Error("boom"), {
      method: "GET",
      path: "/api/v1/things",
      serviceName: "contextbase-api",
      status: 500,
    })
    await reporter.flush()
  })
})
