import { describe, expect, test } from "vitest"

import {
  findStaticOAuthClient,
  normalizeOAuthClientRegistration,
  validateOAuthClientAuthorization,
} from "./clients"

describe("OAuth client registration", () => {
  test("normalizes Cursor-style public client registration", () => {
    const result = normalizeOAuthClientRegistration(
      {
        client_name: "Cursor",
        redirect_uris: ["http://127.0.0.1:54321/callback"],
      },
      { clientId: "dcr_test", issuedAt: new Date("2026-06-03T12:00:00.000Z") },
    )

    expect(result._tag).toBe("Right")
    if (result._tag !== "Right") return

    expect(result.right.response).toEqual({
      client_id: "dcr_test",
      client_id_issued_at: 1780488000,
      client_name: "Cursor",
      grant_types: ["authorization_code", "refresh_token"],
      redirect_uris: ["http://127.0.0.1:54321/callback"],
      response_types: ["code"],
      scope: "contextbase:read contextbase:write contextbase:files offline_access",
      token_endpoint_auth_method: "none",
    })
  })

  test("adds offline access when registering a refresh-token client with explicit scopes", () => {
    const result = normalizeOAuthClientRegistration(
      {
        client_name: "Claude Code",
        grant_types: ["authorization_code", "refresh_token"],
        redirect_uris: ["http://127.0.0.1:54321/callback"],
        scope: "contextbase:read contextbase:write contextbase:files",
      },
      { clientId: "dcr_test", issuedAt: new Date("2026-06-03T12:00:00.000Z") },
    )

    expect(result._tag).toBe("Right")
    if (result._tag !== "Right") return

    expect(result.right.response.scope).toBe(
      "contextbase:read contextbase:write contextbase:files offline_access",
    )
    expect(result.right.record.scopes).toEqual([
      "contextbase:read",
      "contextbase:write",
      "contextbase:files",
      "offline_access",
    ])
  })

  test("normalizes Cursor dynamic registration with its native and mediated callbacks", () => {
    const result = normalizeOAuthClientRegistration(
      {
        client_name: "Cursor",
        redirect_uris: [
          "cursor://anysphere.cursor-mcp/oauth/callback",
          "https://www.cursor.com/agents/mcp/oauth/callback",
          "http://localhost:8787/callback",
        ],
      },
      { clientId: "dcr_cursor", issuedAt: new Date("2026-06-03T12:00:00.000Z") },
    )

    expect(result._tag).toBe("Right")
    if (result._tag !== "Right") return
    expect(result.right.response.redirect_uris).toEqual([
      "cursor://anysphere.cursor-mcp/oauth/callback",
      "https://www.cursor.com/agents/mcp/oauth/callback",
      "http://localhost:8787/callback",
    ])
  })

  test("normalizes Claude Desktop confidential client registration", () => {
    const result = normalizeOAuthClientRegistration(
      {
        client_name: "Claude",
        grant_types: ["authorization_code", "refresh_token"],
        redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
        response_types: ["code"],
        scope: "contextbase:read contextbase:write contextbase:files offline_access",
        token_endpoint_auth_method: "client_secret_post",
      },
      { clientId: "dcr_claude", issuedAt: new Date("2026-06-03T12:00:00.000Z") },
    )

    expect(result._tag).toBe("Right")
    if (result._tag !== "Right") return

    expect(result.right.record.tokenEndpointAuthMethod).toBe("client_secret_post")
    expect(result.right.response).toMatchObject({
      client_id: "dcr_claude",
      client_name: "Claude",
      redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
      scope: "contextbase:read contextbase:write contextbase:files offline_access",
      token_endpoint_auth_method: "client_secret_post",
    })
  })

  test("rejects non-loopback plain HTTP redirect URIs", () => {
    const result = normalizeOAuthClientRegistration(
      {
        client_name: "Bad client",
        redirect_uris: ["http://example.com/callback"],
      },
      { clientId: "dcr_test", issuedAt: new Date("2026-06-03T12:00:00.000Z") },
    )

    expect(result._tag).toBe("Left")
    if (result._tag !== "Left") return
    expect(result.left.error).toBe("invalid_redirect_uri")
  })

  test("validates dynamic client authorization against registered metadata", () => {
    const result = validateOAuthClientAuthorization({
      client: {
        clientId: "dcr_test",
        clientName: "Cursor",
        clientUri: null,
        grantTypes: ["authorization_code", "refresh_token"],
        redirectUris: ["http://127.0.0.1:54321/callback"],
        responseTypes: ["code"],
        scopes: ["contextbase:read", "contextbase:files", "offline_access"],
        status: "active",
        tokenEndpointAuthMethod: "none",
      },
      redirectUri: "http://127.0.0.1:54321/callback",
      responseType: "code",
      scopes: ["contextbase:read", "contextbase:files"],
    })

    expect(result._tag).toBe("Right")
  })

  test("allows offline access for existing refresh-token clients registered without it", () => {
    const result = validateOAuthClientAuthorization({
      client: {
        clientId: "dcr_test",
        clientName: "Claude Code",
        clientUri: null,
        grantTypes: ["authorization_code", "refresh_token"],
        redirectUris: ["http://127.0.0.1:54321/callback"],
        responseTypes: ["code"],
        scopes: ["contextbase:read", "contextbase:write", "contextbase:files"],
        status: "active",
        tokenEndpointAuthMethod: "none",
      },
      redirectUri: "http://127.0.0.1:54321/callback",
      responseType: "code",
      scopes: ["contextbase:read", "contextbase:write", "contextbase:files", "offline_access"],
    })

    expect(result._tag).toBe("Right")
  })

  test("rejects dynamic authorization scopes outside registered scopes", () => {
    const result = validateOAuthClientAuthorization({
      client: {
        clientId: "dcr_test",
        clientName: "Cursor",
        clientUri: null,
        grantTypes: ["authorization_code", "refresh_token"],
        redirectUris: ["http://127.0.0.1:54321/callback"],
        responseTypes: ["code"],
        scopes: ["contextbase:read"],
        status: "active",
        tokenEndpointAuthMethod: "none",
      },
      redirectUri: "http://127.0.0.1:54321/callback",
      responseType: "code",
      scopes: ["contextbase:read", "contextbase:files"],
    })

    expect(result._tag).toBe("Left")
    if (result._tag !== "Left") return
    expect(result.left.error).toBe("invalid_scope")
  })

  test("allows static Claude Code clients to request admin scope for consent policy", () => {
    const client = findStaticOAuthClient("https://claude.ai/oauth/claude-code-client-metadata")
    expect(client).not.toBeNull()
    if (!client) return

    const result = validateOAuthClientAuthorization({
      client,
      redirectUri: "http://127.0.0.1:54321/callback",
      responseType: "code",
      scopes: ["contextbase:read", "contextbase:manage"],
    })

    expect(result._tag).toBe("Right")
  })
})
