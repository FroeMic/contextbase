import type { DbClient } from "@contextbase/core"
import { describe, expect, test, vi } from "vitest"
import type { ApiErrorReporter } from "./http/error-reporter"
import { startApiServer } from "./server-runtime"

describe("api server runtime", () => {
  test("creates one app-owned db client and closes it during shutdown", async () => {
    const dbClient = {
      db: {},
      end: vi.fn(async () => undefined),
    } as unknown as DbClient
    const close = vi.fn((callback?: () => void) => callback?.())
    const appOptions: unknown[] = []
    const servedOptions: unknown[] = []
    const listeners: Record<string, () => void> = {}

    const runtime = startApiServer({
      createApiApp: (options) => {
        appOptions.push(options)
        return {
          fetch: vi.fn(),
        }
      },
      createDbClient: () => dbClient,
      env: {
        API_HOST: "127.0.0.1",
        API_PORT: "4017",
      },
      logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
      process: {
        once: (signal, listener) => {
          listeners[signal] = listener
        },
      },
      serve: (options) => {
        servedOptions.push(options)
        return { close }
      },
    })

    expect(runtime.hostname).toBe("127.0.0.1")
    expect(runtime.port).toBe(4017)
    expect(appOptions).toEqual([
      expect.objectContaining({
        dbClient,
      }),
    ])
    expect(servedOptions).toEqual([
      expect.objectContaining({
        hostname: "127.0.0.1",
        port: 4017,
      }),
    ])
    expect(Object.keys(listeners).sort()).toEqual(["SIGINT", "SIGTERM"])

    await runtime.shutdown("SIGTERM")

    expect(dbClient.end).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
  })

  test("passes an API error reporter into the app and flushes it during shutdown", async () => {
    const dbClient = {
      db: {},
      end: vi.fn(async () => undefined),
    } as unknown as DbClient
    const errorReporter: ApiErrorReporter = {
      captureException: vi.fn(async () => undefined),
      flush: vi.fn(async () => undefined),
    }
    const appOptions: unknown[] = []

    const runtime = startApiServer({
      createApiApp: (options) => {
        appOptions.push(options)
        return { fetch: vi.fn() }
      },
      createApiErrorReporter: vi.fn(async () => errorReporter),
      createDbClient: () => dbClient,
      logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
      process: {
        once: vi.fn(),
      },
      serve: () => ({ close: vi.fn((callback?: () => void) => callback?.()) }),
    })

    const appErrorReporter = (appOptions[0] as { errorReporter?: ApiErrorReporter }).errorReporter
    expect(appErrorReporter).toBeDefined()
    await appErrorReporter?.captureException(new Error("boom"), {
      method: "GET",
      path: "/api/v1/things",
      serviceName: "contextbase-api",
      status: 500,
    })

    expect(errorReporter.captureException).toHaveBeenCalledTimes(1)

    await runtime.shutdown()

    expect(errorReporter.flush).toHaveBeenCalledTimes(1)
    expect(dbClient.end).toHaveBeenCalledTimes(1)
  })
})
