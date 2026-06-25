import { readFileSync } from "node:fs"
import type { IncomingMessage } from "node:http"
import { join } from "node:path"
import { Readable } from "node:stream"
import { describe, expect, test } from "vitest"

import { responseHeadersForNode, toFetchRequest } from "../vite.config"

describe("Vite API dev middleware", () => {
  test("converts POST requests with JSON bodies into fetch requests", async () => {
    const incoming = Readable.from([JSON.stringify({ email: "m@example.com" })]) as IncomingMessage
    incoming.headers = {
      "content-type": "application/json",
      host: "127.0.0.1:4017",
    }
    incoming.method = "POST"
    incoming.url = "/api/auth/magic-link/request"

    const request = await toFetchRequest(incoming)

    expect(request.url).toBe("http://127.0.0.1:4017/api/auth/magic-link/request")
    expect(request.method).toBe("POST")
    await expect(request.json()).resolves.toEqual({ email: "m@example.com" })
  })

  test("keeps repeated set-cookie headers when adapting fetch responses to Node", () => {
    const headers = new Headers()
    headers.append("set-cookie", "contextbase_session=raw_session; Path=/; HttpOnly")
    headers.append("set-cookie", "contextbase_auth_shell=1; Path=/")

    expect(responseHeadersForNode(headers)["set-cookie"]).toEqual([
      "contextbase_session=raw_session; Path=/; HttpOnly",
      "contextbase_auth_shell=1; Path=/",
    ])
  })

  test("routes local PostHog ingest requests through the same server entry as API requests", () => {
    const source = readFileSync(join(process.cwd(), "vite.config.ts"), "utf8")

    expect(source).toContain('pathname.startsWith("/api/") ||')
    expect(source).toContain('pathname.startsWith("/ingest/") ||')
    expect(source).toContain('pathname.startsWith("/public/avatars/")')
    expect(source).toContain("hmr: {")
    expect(source).toContain("host: configuredHmrHost()")
    expect(source).toContain("LOCAL_APP_HOST")
    expect(source).not.toContain('host: "startwithvertical-2.test"')
    expect(source).toContain('protocol: "wss"')
  })

  test("routes nested local MCP paths to the MCP service", () => {
    const caddyfile = readFileSync(join(process.cwd(), "../../infra/local/Caddyfile"), "utf8")

    expect(caddyfile).toContain("handle /mcp* {")
    expect(caddyfile).toContain("reverse_proxy mcp:3217")
  })
})
