import type { AuthenticatedContext } from "@contextbase/core/domains/auth/authenticate"
import { describe, expect, test } from "vitest"

import { createMcpApp } from "./app"

const authBaseUrl = "http://127.0.0.1:3317"
const mcpResourceUrl = "http://127.0.0.1:3217/mcp"

describe("Contextbase MCP product surface", () => {
  test("protected resource metadata uses Contextbase scopes", async () => {
    const response = await app().request("/.well-known/oauth-protected-resource/mcp")

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      scopes_supported: [
        "contextbase:read",
        "contextbase:write",
        "contextbase:files",
        "contextbase:manage",
      ],
    })
  })

  test("lists only Contextbase MCP tools for read-scoped grants", async () => {
    const response = await app().request("/mcp", {
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/list" }),
      headers: { authorization: "Bearer vca_mcp", "content-type": "application/json" },
      method: "POST",
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as { result: { tools: Array<{ name: string }> } }
    const toolNames = body.result.tools.map((tool) => tool.name)

    expect(toolNames).toEqual(["contextbase_auth_probe"])
    expect(toolNames.every((toolName) => !toolName.startsWith("vertical_"))).toBe(true)
    expect(toolNames).not.toEqual(expect.arrayContaining(["vertical_auth_probe"]))
  })

  test("auth probe requires read scope", async () => {
    const response = await app({ ...validAuthContext(), scopes: [] }).request("/mcp", {
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
      result: { isError?: true; structuredContent: { error?: { code: string } } }
    }

    expect(body.result.isError).toBe(true)
    expect(body.result.structuredContent.error?.code).toBe("forbidden")
  })
})

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
