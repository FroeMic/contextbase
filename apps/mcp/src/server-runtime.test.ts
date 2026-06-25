import { readFileSync } from "node:fs"

import { describe, expect, test } from "vitest"

import { startMcpServer } from "./server-runtime"

describe("MCP server runtime", () => {
  test("uses runnable ESM relative imports in the production start graph", () => {
    expect(readSource("./server.ts")).toContain('from "./server-runtime.js"')
    expect(readSource("./server-runtime.ts")).toContain('from "./app.js"')
    expect(readSource("./app.ts")).toContain('from "./file-download-links.js"')
    expect(readSource("./app.ts")).toContain('from "./tools.js"')
    expect(readSource("./tools.ts")).not.toContain('from "./file-download-links.js"')
  })

  test("starts configured Hono app and closes db client on shutdown", async () => {
    const events: string[] = []
    const runtime = startMcpServer({
      createDbClient: () =>
        ({
          end: async () => {
            events.push("db:end")
          },
        }) as never,
      createMcpApp: (options) => {
        expect(options.authBaseUrl).toBe("http://auth.local")
        expect(options.mcpResourceUrl).toBe("http://mcp.local/mcp")
        return { fetch: async () => new Response("ok") }
      },
      env: {
        MCP_HOST: "127.0.0.1",
        MCP_PORT: "3218",
        MCP_PUBLIC_BASE_URL: "http://mcp.local",
        CONTEXTBASE_AUTH_BASE_URL: "http://auth.local",
      },
      process: {
        once: () => undefined,
      },
      serve: (options) => {
        events.push(`${options.hostname}:${options.port}`)
        return {
          close: (callback?: () => void) => {
            events.push("server:close")
            callback?.()
          },
        }
      },
    })

    expect(runtime).toMatchObject({
      hostname: "127.0.0.1",
      port: 3218,
    })

    await runtime.shutdown()

    expect(events).toEqual(["127.0.0.1:3218", "server:close", "db:end"])
  })
})

function readSource(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8")
}
