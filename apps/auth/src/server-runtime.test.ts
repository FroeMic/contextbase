import { readFileSync } from "node:fs"

import { describe, expect, test, vi } from "vitest"

vi.mock("@contextbase/core", () => ({
  createDbClient: vi.fn(() => ({
    end: vi.fn(async () => undefined),
  })),
}))

vi.mock("@contextbase/core/domains/auth/browser-session-repository", () => ({
  createPostgresBrowserAuthStore: vi.fn(() => ({})),
}))

vi.mock("@contextbase/core/domains/oauth/repository", () => ({
  createPostgresOAuthRepository: vi.fn(() => ({})),
}))

describe("auth server runtime", () => {
  test("uses runnable ESM relative imports in the production start graph", () => {
    expect(readSource("./server.ts")).toContain('from "./server-runtime.js"')
    expect(readSource("./server-runtime.ts")).toContain('from "./app.js"')
  })

  test("starts auth service with env configured host and port and shuts down db", async () => {
    const { startAuthServer } = await import("./server-runtime")
    const close = vi.fn((callback?: () => void) => callback?.())
    const dbClient = {
      end: vi.fn(async () => undefined),
    }
    const runtime = startAuthServer({
      createDbClient: () => dbClient as never,
      env: {
        AUTH_HOST: "127.0.0.1",
        AUTH_PORT: "3317",
        AUTH_PUBLIC_BASE_URL: "http://127.0.0.1:3317",
        CONTEXTBASE_API_RESOURCE_URL: "http://127.0.0.1:3017/api/v1",
        CONTEXTBASE_MCP_RESOURCE_URL: "http://127.0.0.1:3217/mcp",
        CONTEXTBASE_WEB_BASE_URL: "http://127.0.0.1:4017",
      },
      process: {
        once: vi.fn(),
      },
      serve: vi.fn(() => ({ close })),
    })

    expect(runtime.hostname).toBe("127.0.0.1")
    expect(runtime.port).toBe(3317)

    await runtime.shutdown()

    expect(close).toHaveBeenCalledOnce()
    expect(dbClient.end).toHaveBeenCalledOnce()
  })
})

function readSource(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8")
}
