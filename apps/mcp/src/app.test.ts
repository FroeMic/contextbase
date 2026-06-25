import type { AuthenticatedContext } from "@contextbase/core/domains/auth/authenticate"
import { afterEach, describe, expect, test, vi } from "vitest"

import { createMcpApp } from "./app"

const authBaseUrl = "http://127.0.0.1:3317"
const mcpResourceUrl = "http://127.0.0.1:3217/mcp"

type TestLogEntry = {
  event: string
  [key: string]: unknown
}

function app(authContext: AuthenticatedContext = validAuthContext()) {
  return createMcpApp({
    authBaseUrl,
    authenticateBearerToken: async (token) => {
      if (token !== "vca_mcp") throw new Error("invalid token")
      return authContext
    },
    mcpResourceUrl,
  })
}

describe("MCP app", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test("returns success envelope from health endpoint", async () => {
    const response = await app().request("/healthz")

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: {
        service: "mcp",
        status: "ok",
      },
      ok: true,
    })
  })

  test("returns MCP protected resource metadata", async () => {
    const response = await app().request("/.well-known/oauth-protected-resource/mcp")

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      authorization_servers: [authBaseUrl],
      resource: mcpResourceUrl,
      scopes_supported: [
        "contextbase:read",
        "contextbase:write",
        "contextbase:files",
        "contextbase:manage",
      ],
    })
  })

  test("challenges unauthenticated MCP requests before protocol handling", async () => {
    const response = await app().request("/mcp", {
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/list" }),
      method: "POST",
    })

    expect(response.status).toBe(401)
    expect(response.headers.get("www-authenticate")).toBe(
      'Bearer resource_metadata="http://127.0.0.1:3217/.well-known/oauth-protected-resource/mcp", scope="contextbase:read contextbase:write contextbase:files"',
    )
  })

  test("logs MCP discovery and authentication failures without credentials", async () => {
    const logs: TestLogEntry[] = []
    const mcpApp = createMcpApp({
      authBaseUrl,
      logger: {
        info: (entry) => logs.push(entry),
        warn: (entry) => logs.push(entry),
      },
      mcpResourceUrl,
    })

    await mcpApp.request("/.well-known/oauth-protected-resource/mcp")
    await mcpApp.request("/mcp", {
      headers: { authorization: "Bearer secret_token" },
      method: "POST",
    })

    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "mcp.oauth_protected_resource.request",
          resource: mcpResourceUrl,
        }),
        expect.objectContaining({
          event: "mcp.auth.failed",
          reason: "invalid_token",
        }),
        expect.objectContaining({
          event: "mcp.request.completed",
          path: "/mcp",
          status: 401,
        }),
      ]),
    )
    expect(JSON.stringify(logs)).not.toContain("secret_token")
  })

  test("opens authenticated Streamable HTTP server stream on GET /mcp", async () => {
    const response = await app().request("/mcp", {
      headers: { accept: "text/event-stream", authorization: "Bearer vca_mcp" },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/event-stream")
    expect(response.headers.get("cache-control")).toBe("no-store")
    await response.body?.cancel()
  })

  test("accepts JSON-RPC notifications without returning protocol errors", async () => {
    const response = await app().request("/mcp", {
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      headers: { authorization: "Bearer vca_mcp", "content-type": "application/json" },
      method: "POST",
    })

    expect(response.status).toBe(202)
    expect(await response.text()).toBe("")
  })

  test("returns parse errors for invalid JSON-RPC bodies", async () => {
    const response = await app().request("/mcp", {
      body: "{",
      headers: { authorization: "Bearer vca_mcp", "content-type": "application/json" },
      method: "POST",
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: -32700,
        message: "Parse error",
      },
      jsonrpc: "2.0",
    })
  })

  test("initializes as contextbase MCP server", async () => {
    const response = await app().request("/mcp", {
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "initialize" }),
      headers: { authorization: "Bearer vca_mcp", "content-type": "application/json" },
      method: "POST",
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      result: {
        serverInfo: { name: "contextbase", version: "0.1.0" },
      },
    })
  })

  test("lists only the Contextbase auth probe for read-scoped grants", async () => {
    const response = await app().request("/mcp", {
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/list" }),
      headers: { authorization: "Bearer vca_mcp", "content-type": "application/json" },
      method: "POST",
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as { result: { tools: Array<{ name: string }> } }
    expect(body.result.tools.map((tool) => tool.name)).toEqual(["contextbase_auth_probe"])
  })

  test("calls contextbase_auth_probe through read-scoped grants", async () => {
    const response = await app().request("/mcp", {
      body: JSON.stringify({
        id: 2,
        jsonrpc: "2.0",
        method: "tools/call",
        params: { arguments: {}, name: "contextbase_auth_probe" },
      }),
      headers: { authorization: "Bearer vca_mcp", "content-type": "application/json" },
      method: "POST",
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      result: { structuredContent: { principalId: string; workspaceId: string } }
    }
    expect(body.result.structuredContent).toMatchObject({
      principalId: "usr_123",
      workspaceId: "wrk_123",
    })
  })

  test("returns tool errors as MCP tool results", async () => {
    const response = await app().request("/mcp", {
      body: JSON.stringify({
        id: 3,
        jsonrpc: "2.0",
        method: "tools/call",
        params: { arguments: {}, name: "missing_tool" },
      }),
      headers: { authorization: "Bearer vca_mcp", "content-type": "application/json" },
      method: "POST",
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      result: { isError?: true; structuredContent: { error: { code: string } } }
    }
    expect(body.result.isError).toBe(true)
    expect(body.result.structuredContent.error.code).toBe("unknown_tool")
  })
})

function validAuthContext(): AuthenticatedContext {
  return {
    authKind: "oauth_access_token",
    grantId: "oag_123",
    principalId: "usr_123",
    principalKind: "user",
    resource: mcpResourceUrl,
    role: "workspace_member",
    scopes: contextbaseScopes("contextbase:read"),
    workspaceId: "wrk_123",
    workspaceSlug: "core",
  }
}

function contextbaseScopes(...scopes: string[]): NonNullable<AuthenticatedContext["scopes"]> {
  return scopes as unknown as NonNullable<AuthenticatedContext["scopes"]>
}
