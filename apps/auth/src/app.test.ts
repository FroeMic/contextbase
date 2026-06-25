import { createHash } from "node:crypto"
import type {
  BrowserAuthStore,
  BrowserSessionContext,
} from "@contextbase/core/domains/auth/browser-session"
import { hashBrowserToken } from "@contextbase/core/domains/auth/browser-session"
import type {
  OAuthClientRecord,
  OAuthClientRegistrationRecordInput,
} from "@contextbase/core/domains/oauth/clients"
import type {
  CreateAccessTokenInput,
  CreateAuthorizationRequestInput,
  CreateGrantInput,
  CreateRefreshTokenInput,
  OAuthAuthorizationCodeRecord,
  OAuthRefreshTokenRecord,
  OAuthRepository,
} from "@contextbase/core/domains/oauth/repository"
import { hashOAuthToken } from "@contextbase/core/domains/oauth/service"
import { describe, expect, test } from "vitest"

import { createAuthApp } from "./app"

const authBaseUrl = "http://127.0.0.1:3317"
const apiResourceUrl = "http://127.0.0.1:3017/api/v1"
const mcpResourceUrl = "http://127.0.0.1:3217/mcp"
type TestLogEntry = {
  event: string
  [key: string]: unknown
}

function app() {
  return createAuthApp({
    apiResourceUrl,
    authBaseUrl,
    mcpResourceUrl,
    webBaseUrl: "http://127.0.0.1:4017",
  })
}

const now = new Date("2026-06-02T12:00:00.000Z")
const claudeCodeClientId = "https://claude.ai/oauth/claude-code-client-metadata"

function validAuthorizeUrl() {
  return authorizeUrl({
    clientId: claudeCodeClientId,
    redirectUri: "http://127.0.0.1:49152/callback",
    scope: "contextbase:read contextbase:files",
  })
}

function authorizeUrl(input: {
  clientId: string
  codeChallenge?: string
  redirectUri: string
  scope: string
  state?: string
}) {
  return [
    "/oauth/authorize?response_type=code",
    `client_id=${encodeURIComponent(input.clientId)}`,
    `redirect_uri=${encodeURIComponent(input.redirectUri)}`,
    `code_challenge=${encodeURIComponent(input.codeChallenge ?? "abc")}`,
    "code_challenge_method=S256",
    `scope=${encodeURIComponent(input.scope)}`,
    `state=${encodeURIComponent(input.state ?? "state_123")}`,
    `resource=${encodeURIComponent(mcpResourceUrl)}`,
  ].join("&")
}

describe("auth app", () => {
  test("returns success envelope from health endpoint", async () => {
    const response = await app().request("/healthz")

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        service: "auth",
        status: "ok",
      },
    })
  })

  test("returns OAuth authorization server metadata", async () => {
    const response = await app().request("/.well-known/oauth-authorization-server")

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      issuer: authBaseUrl,
      authorization_endpoint: `${authBaseUrl}/oauth/authorize`,
      token_endpoint: `${authBaseUrl}/oauth/token`,
      revocation_endpoint: `${authBaseUrl}/oauth/revoke`,
      grant_types_supported: ["authorization_code", "refresh_token"],
      response_types_supported: ["code"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: [
        "contextbase:read",
        "contextbase:write",
        "contextbase:files",
        "contextbase:manage",
        "offline_access",
      ],
      client_id_metadata_document_supported: false,
      token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
      registration_endpoint: `${authBaseUrl}/oauth/register`,
    })
  })

  test("registers a public PKCE OAuth client dynamically", async () => {
    const repository = createMemoryOAuthRepository()
    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/register", {
      body: JSON.stringify({
        client_name: "Cursor",
        redirect_uris: ["http://127.0.0.1:54321/callback"],
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })

    expect(response.status).toBe(201)
    const registration = (await response.json()) as { client_secret: string }
    expect(registration).toMatchObject({
      client_id: expect.stringMatching(/^dcr_/),
      client_name: "Cursor",
      grant_types: ["authorization_code", "refresh_token"],
      redirect_uris: ["http://127.0.0.1:54321/callback"],
      response_types: ["code"],
      scope: "contextbase:read contextbase:write contextbase:files offline_access",
      token_endpoint_auth_method: "none",
    })
    expect(registration).not.toHaveProperty("client_secret")
    expect(repository.oauthClients[0]).toMatchObject({
      clientName: "Cursor",
      redirectUris: ["http://127.0.0.1:54321/callback"],
      scopes: ["contextbase:read", "contextbase:write", "contextbase:files", "offline_access"],
    })
  })

  test("registers a confidential DCR client with a one-time client secret", async () => {
    const repository = createMemoryOAuthRepository()
    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/register", {
      body: JSON.stringify({
        client_name: "Claude",
        grant_types: ["authorization_code", "refresh_token"],
        redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
        response_types: ["code"],
        scope: "contextbase:read contextbase:write contextbase:files offline_access",
        token_endpoint_auth_method: "client_secret_post",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })

    expect(response.status).toBe(201)
    const registration = (await response.json()) as { client_secret: string }
    expect(registration).toMatchObject({
      client_id: expect.stringMatching(/^dcr_/),
      client_name: "Claude",
      client_secret: expect.stringMatching(/^dcr_secret_/),
      client_secret_expires_at: 0,
      redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
      token_endpoint_auth_method: "client_secret_post",
    })
    expect(repository.oauthClients[0]).toMatchObject({
      clientName: "Claude",
      clientSecretExpiresAt: null,
      clientSecretHash: expect.any(String),
      tokenEndpointAuthMethod: "client_secret_post",
    })
    expect(repository.oauthClients[0]).not.toMatchObject({
      clientSecretHash: registration.client_secret,
    })
  })

  test("allows refresh-token DCR clients to request offline access after explicit scope registration", async () => {
    const repository = createMemoryOAuthRepository()
    const registrationResponse = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/register", {
      body: JSON.stringify({
        client_name: "Claude Code",
        grant_types: ["authorization_code", "refresh_token"],
        redirect_uris: ["http://127.0.0.1:54321/callback"],
        response_types: ["code"],
        scope: "contextbase:read contextbase:write contextbase:files",
        token_endpoint_auth_method: "none",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
    const registration = (await registrationResponse.json()) as { client_id: string; scope: string }

    const authorizeResponse = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request(
      authorizeUrl({
        clientId: registration.client_id,
        redirectUri: "http://127.0.0.1:54321/callback",
        scope: "contextbase:read contextbase:write contextbase:files offline_access",
      }),
    )

    expect(registrationResponse.status).toBe(201)
    expect(registration.scope).toBe(
      "contextbase:read contextbase:write contextbase:files offline_access",
    )
    expect(authorizeResponse.status).toBe(302)
    expect(repository.authorizationRequests[0]).toMatchObject({
      clientId: registration.client_id,
      scope: ["contextbase:read", "contextbase:write", "contextbase:files", "offline_access"],
    })
  })

  test("returns OAuth error JSON for invalid dynamic client redirect URIs", async () => {
    const repository = createMemoryOAuthRepository()
    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/register", {
      body: JSON.stringify({
        client_name: "Bad client",
        redirect_uris: ["http://example.com/callback"],
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "invalid_redirect_uri",
      error_description: "redirect_uris must contain allowed HTTPS or HTTP loopback URIs",
    })
    expect(repository.oauthClients).toHaveLength(0)
  })

  test("logs DCR failures and authorization scope failures without secrets", async () => {
    const repository = createMemoryOAuthRepository()
    const logs: TestLogEntry[] = []
    await repository.registerClient({
      clientId: "dcr_claude",
      clientName: "Claude Code",
      clientUri: null,
      grantTypes: ["authorization_code"],
      redirectUris: ["http://127.0.0.1:54321/callback"],
      responseTypes: ["code"],
      scopes: ["contextbase:read"],
      tokenEndpointAuthMethod: "none",
    })
    const authApp = createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      logger: {
        info: (entry) => logs.push(entry),
        warn: (entry) => logs.push(entry),
      },
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    })

    await authApp.request("/oauth/register", {
      body: JSON.stringify({
        client_name: "Bad client",
        redirect_uris: ["http://example.com/callback"],
        token_endpoint_auth_method: "client_secret_basic",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
    await authApp.request(
      authorizeUrl({
        clientId: "dcr_claude",
        codeChallenge: "secret_challenge",
        redirectUri: "http://127.0.0.1:54321/callback",
        scope: "contextbase:read contextbase:files",
        state: "secret_state",
      }),
    )

    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "oauth.dcr.failed",
          oauthError: "invalid_redirect_uri",
          oauthDescription: "redirect_uris must contain allowed HTTPS or HTTP loopback URIs",
          reason: "metadata_validation_failed",
        }),
        expect.objectContaining({
          clientId: "dcr_claude",
          event: "oauth.authorize.failed",
          oauthError: "invalid_scope",
        }),
      ]),
    )
    expect(JSON.stringify(logs)).not.toContain("secret_challenge")
    expect(JSON.stringify(logs)).not.toContain("secret_state")
  })

  test("registers Cursor clients with native and mediated callback redirects", async () => {
    const repository = createMemoryOAuthRepository()
    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/register", {
      body: JSON.stringify({
        client_name: "Cursor",
        redirect_uris: [
          "cursor://anysphere.cursor-mcp/oauth/callback",
          "https://www.cursor.com/agents/mcp/oauth/callback",
          "http://localhost:8787/callback",
        ],
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      client_name: "Cursor",
      redirect_uris: [
        "cursor://anysphere.cursor-mcp/oauth/callback",
        "https://www.cursor.com/agents/mcp/oauth/callback",
        "http://localhost:8787/callback",
      ],
    })
    expect(repository.oauthClients[0]?.redirectUris).toEqual([
      "cursor://anysphere.cursor-mcp/oauth/callback",
      "https://www.cursor.com/agents/mcp/oauth/callback",
      "http://localhost:8787/callback",
    ])
  })

  test("returns protected resource metadata for MCP and API resources", async () => {
    const mcpResponse = await app().request("/.well-known/oauth-protected-resource/mcp")
    const apiResponse = await app().request("/.well-known/oauth-protected-resource/api")

    expect(mcpResponse.status).toBe(200)
    await expect(mcpResponse.json()).resolves.toEqual({
      resource: mcpResourceUrl,
      authorization_servers: [authBaseUrl],
      scopes_supported: [
        "contextbase:read",
        "contextbase:write",
        "contextbase:files",
        "contextbase:manage",
      ],
    })

    expect(apiResponse.status).toBe(200)
    await expect(apiResponse.json()).resolves.toEqual({
      resource: apiResourceUrl,
      authorization_servers: [authBaseUrl],
      scopes_supported: [
        "contextbase:read",
        "contextbase:write",
        "contextbase:files",
        "contextbase:manage",
      ],
    })
  })

  test("rejects authorization requests without S256 PKCE", async () => {
    const response = await app().request(
      "/oauth/authorize?response_type=code&client_id=client&redirect_uri=http://127.0.0.1:49152/callback&code_challenge=abc&code_challenge_method=plain&scope=contextbase:read&state=state&resource=http://127.0.0.1:3217/mcp",
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: {
        code: "invalid_request",
      },
    })
  })

  test("stores a valid authorization request and redirects to browser login", async () => {
    const repository = createMemoryOAuthRepository()
    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      webBaseUrl: "http://127.0.0.1:4017",
      now: () => now,
      oauthRepository: repository,
    }).request(validAuthorizeUrl())

    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:4017/login?redirect_to=http%3A%2F%2F127.0.0.1%3A3317%2Foauth%2Fauthorize%2Fresume%3Frequest_id%3Doar_1",
    )
    expect(repository.authorizationRequests[0]).toMatchObject({
      clientId: claudeCodeClientId,
      codeChallenge: "abc",
      codeChallengeMethod: "S256",
      redirectUri: "http://127.0.0.1:49152/callback",
      resource: mcpResourceUrl,
      scope: ["contextbase:read", "contextbase:files"],
      state: "state_123",
      stateHash: hashOAuthToken("state_123"),
    })
  })

  test("stores authorization requests for registered dynamic clients", async () => {
    const repository = createMemoryOAuthRepository()
    await repository.registerClient({
      clientId: "dcr_cursor",
      clientName: "Cursor",
      clientUri: null,
      grantTypes: ["authorization_code", "refresh_token"],
      redirectUris: ["http://127.0.0.1:54321/callback"],
      responseTypes: ["code"],
      scopes: ["contextbase:read", "contextbase:write", "contextbase:files", "offline_access"],
      tokenEndpointAuthMethod: "none",
    })

    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request(
      authorizeUrl({
        clientId: "dcr_cursor",
        redirectUri: "http://127.0.0.1:54321/callback",
        scope: "contextbase:read contextbase:files",
      }),
    )

    expect(response.status).toBe(302)
    expect(repository.authorizationRequests[0]).toMatchObject({
      clientId: "dcr_cursor",
      redirectUri: "http://127.0.0.1:54321/callback",
      scope: ["contextbase:read", "contextbase:files"],
    })
  })

  test("rejects dynamic authorization with unregistered redirect URIs", async () => {
    const repository = createMemoryOAuthRepository()
    await repository.registerClient({
      clientId: "dcr_cursor",
      clientName: "Cursor",
      clientUri: null,
      grantTypes: ["authorization_code", "refresh_token"],
      redirectUris: ["http://127.0.0.1:54321/callback"],
      responseTypes: ["code"],
      scopes: ["contextbase:read", "contextbase:files"],
      tokenEndpointAuthMethod: "none",
    })

    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request(
      authorizeUrl({
        clientId: "dcr_cursor",
        redirectUri: "http://127.0.0.1:54322/callback",
        scope: "contextbase:read",
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "invalid_request",
        details: {
          oauth_error: "invalid_redirect_uri",
        },
      },
      ok: false,
    })
    expect(repository.authorizationRequests).toHaveLength(0)
  })

  test("rejects unknown URL-shaped client IDs instead of treating them as metadata documents", async () => {
    const repository = createMemoryOAuthRepository()

    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request(
      authorizeUrl({
        clientId: "https://client.example/.well-known/oauth-client",
        redirectUri: "http://127.0.0.1:54321/callback",
        scope: "contextbase:read",
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "invalid_request",
        message: "OAuth client is not registered",
      },
      ok: false,
    })
    expect(repository.authorizationRequests).toHaveLength(0)
  })

  test("renders styled consent after validating the browser session", async () => {
    const repository = createMemoryOAuthRepository()
    await repository.createAuthorizationRequest({
      ...validPendingRequest(),
      clientId: "https://claude.ai/oauth/claude-code-client-metadata",
      scope: ["contextbase:read", "contextbase:write", "contextbase:files", "offline_access"],
    })

    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      browserAuthStore: createBrowserAuthStore(),
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/authorize/resume?request_id=oar_1", {
      headers: { cookie: "contextbase_session=raw_session; vertical-ui-theme=dark" },
    })

    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain("<title>Authorize Claude Code | Contextbase</title>")
    expect(html).toContain("Connect Claude Code to Contextbase")
    expect(html).toContain("workspace <strong>core</strong>")
    expect(html).toContain('<html class="dark"')
    expect(html).toContain("@font-face")
    expect(html).toContain("/oauth/assets/inter-latin-wght-normal.woff2")
    expect(html).toContain('font-family: "Inter Variable", Arial, Helvetica, sans-serif;')
    expect(html).toContain('class="consent-card"')
    expect(html).toContain("Read Contextbase data")
    expect(html).toContain("Create and update data")
    expect(html).toContain("Use file links")
    expect(html).toContain("Stay connected without asking again")
    expect(html).toContain("Authorize as")
    expect(html).toContain('value="user:usr_123" selected')
    expect(html).toContain("You (test@example.com)")
    expect(html).not.toContain('value="agent:')
    expect(html).not.toContain("Agent:")
    expect(html).not.toContain("Create a new agent")
    expect(html).not.toContain('name="agent_display_name"')
    expect(html).not.toContain('value="create_agent"')
    expect(html).not.toContain("Workspace records available to your account.")
    expect(html).not.toContain("Records in this workspace.")
    expect(html).not.toContain("Short-lived links for files and attachments.")
    expect(html).not.toContain("Allow Claude Code to refresh this connection.")
    expect(html).not.toContain('class="brand-mark"')
    expect(html).not.toContain('class="scope-icon"')
    expect(html).not.toContain("Create file download links")
    expect(html).not.toContain(
      "<h1>Authorize https://claude.ai/oauth/claude-code-client-metadata</h1>",
    )
  })

  test("does not render copied consent agent creation or selection", async () => {
    const repository = createMemoryOAuthRepository()
    await repository.createAuthorizationRequest(validPendingRequest())

    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      browserAuthStore: createBrowserAuthStore(),
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/authorize/resume?request_id=oar_1", {
      headers: { cookie: "contextbase_session=raw_session" },
    })

    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).not.toContain("Create a new agent")
    expect(html).not.toContain('name="agent_display_name"')
    expect(html).not.toContain("Agent: Builder agent")
  })

  test("rejects copied OAuth consent agent creation actions", async () => {
    const repository = createMemoryOAuthRepository()
    await repository.createAuthorizationRequest(validPendingRequest())

    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      browserAuthStore: createBrowserAuthStore(),
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/consent", {
      body: new URLSearchParams({
        action: "create_agent",
        agent_display_name: "Research agent",
        request_id: "oar_1",
      }),
      headers: { cookie: "contextbase_session=raw_session" },
      method: "POST",
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "invalid_request",
      },
      ok: false,
    })
  })

  test("serves the consent page Inter font asset", async () => {
    const response = await app().request("/oauth/assets/inter-latin-wght-normal.woff2")

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("font/woff2")
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable")
  })

  test("approves consent and redirects with authorization code and original state", async () => {
    const repository = createMemoryOAuthRepository()
    await repository.createAuthorizationRequest(validPendingRequest())

    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      browserAuthStore: createBrowserAuthStore(),
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/consent", {
      body: new URLSearchParams({ action: "approve", request_id: "oar_1" }),
      headers: { cookie: "contextbase_session=raw_session" },
      method: "POST",
    })

    expect(response.status).toBe(302)
    const location = new URL(response.headers.get("location") ?? "")
    expect(location.origin + location.pathname).toBe("http://127.0.0.1:49152/callback")
    expect(location.searchParams.get("code")).toMatch(/^oa_code_/)
    expect(location.searchParams.get("state")).toBe("state_123")
    expect(repository.authorizationCodes[0]).toMatchObject({
      actorId: "usr_123",
      actorKind: "user",
      clientId: claudeCodeClientId,
      resource: mcpResourceUrl,
      workspaceId: "wrk_123",
      workspaceSlug: "core",
    })
  })

  test("rejects copied selected agent principals during consent", async () => {
    const repository = createMemoryOAuthRepository()
    await repository.createAuthorizationRequest(validPendingRequest())

    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      browserAuthStore: createBrowserAuthStore(),
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/consent", {
      body: new URLSearchParams({
        action: "approve",
        principal: "agent:agt_builder",
        request_id: "oar_1",
      }),
      headers: { cookie: "contextbase_session=raw_session" },
      method: "POST",
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "invalid_request",
      },
      ok: false,
    })
    expect(repository.authorizationCodes).toHaveLength(0)
  })

  test("rejects selected agent principals for non-admin workspace members", async () => {
    const repository = createMemoryOAuthRepository()
    await repository.createAuthorizationRequest(validPendingRequest())

    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      browserAuthStore: createBrowserAuthStore({ role: "workspace_member" }),
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/consent", {
      body: new URLSearchParams({
        action: "approve",
        principal: "agent:agt_builder",
        request_id: "oar_1",
      }),
      headers: { cookie: "contextbase_session=raw_session" },
      method: "POST",
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "invalid_request",
      },
      ok: false,
    })
    expect(repository.authorizationCodes).toHaveLength(0)
  })

  test("rejects admin OAuth consent for non-admin workspace members", async () => {
    const repository = createMemoryOAuthRepository()
    await repository.createAuthorizationRequest({
      ...validPendingRequest(),
      scope: ["contextbase:read", "contextbase:manage"],
    })

    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      browserAuthStore: createBrowserAuthStore({ role: "workspace_member" }),
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/consent", {
      body: new URLSearchParams({
        action: "approve",
        request_id: "oar_1",
      }),
      headers: { cookie: "contextbase_session=raw_session" },
      method: "POST",
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "forbidden",
      },
      ok: false,
    })
    expect(repository.authorizationCodes).toHaveLength(0)
  })

  test("exchanges authorization codes for access and refresh tokens", async () => {
    const repository = createMemoryOAuthRepository()
    await repository.createAuthorizationCode({
      ...validActorContext(),
      clientId: "client",
      codeChallengeHash: pkceChallenge("test-verifier"),
      codeHash: hashOAuthToken("oa_code_test"),
      expiresAt: new Date("2026-06-02T12:05:00.000Z"),
      redirectUri: "http://127.0.0.1:49152/callback",
      resource: mcpResourceUrl,
      scope: ["contextbase:read", "offline_access"],
    })

    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/token", {
      body: new URLSearchParams({
        client_id: "client",
        code: "oa_code_test",
        code_verifier: "test-verifier",
        grant_type: "authorization_code",
        redirect_uri: "http://127.0.0.1:49152/callback",
        resource: mcpResourceUrl,
      }),
      method: "POST",
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      access_token: expect.stringMatching(/^vca_/),
      expires_in: 3600,
      refresh_token: expect.stringMatching(/^vcr_/),
      scope: "contextbase:read offline_access",
      token_type: "Bearer",
    })
    expect(repository.authorizationCodes[0]?.consumedAt).toEqual(now)
    expect(repository.grants[0]).toMatchObject({
      clientId: "client",
      clientName: "OAuth client",
      resource: mcpResourceUrl,
      workspaceId: "wrk_123",
    })
    expect(repository.accessTokens).toHaveLength(1)
    expect(repository.refreshTokens).toHaveLength(1)
  })

  test("rejects confidential client authorization-code exchange without client secret", async () => {
    const repository = createMemoryOAuthRepository()
    await repository.registerClient({
      clientId: "dcr_confidential",
      clientName: "Claude",
      clientSecretExpiresAt: null,
      clientSecretHash: hashOAuthToken("dcr_secret_test"),
      clientUri: null,
      grantTypes: ["authorization_code", "refresh_token"],
      redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
      responseTypes: ["code"],
      scopes: ["contextbase:read", "offline_access"],
      tokenEndpointAuthMethod: "client_secret_post",
    })
    await repository.createAuthorizationCode({
      ...validActorContext(),
      clientId: "dcr_confidential",
      codeChallengeHash: pkceChallenge("test-verifier"),
      codeHash: hashOAuthToken("oa_code_confidential"),
      expiresAt: new Date("2026-06-02T12:05:00.000Z"),
      redirectUri: "https://claude.ai/api/mcp/auth_callback",
      resource: mcpResourceUrl,
      scope: ["contextbase:read", "offline_access"],
    })

    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/token", {
      body: new URLSearchParams({
        client_id: "dcr_confidential",
        code: "oa_code_confidential",
        code_verifier: "test-verifier",
        grant_type: "authorization_code",
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        resource: mcpResourceUrl,
      }),
      method: "POST",
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "invalid_client",
      error_description: "OAuth client authentication failed",
    })
    expect(repository.authorizationCodes[0]?.consumedAt).toBeNull()
    expect(repository.accessTokens).toHaveLength(0)
    expect(repository.refreshTokens).toHaveLength(0)
  })

  test("exchanges confidential client authorization codes with client secret", async () => {
    const repository = createMemoryOAuthRepository()
    await repository.registerClient({
      clientId: "dcr_confidential",
      clientName: "Claude",
      clientSecretExpiresAt: null,
      clientSecretHash: hashOAuthToken("dcr_secret_test"),
      clientUri: null,
      grantTypes: ["authorization_code", "refresh_token"],
      redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
      responseTypes: ["code"],
      scopes: ["contextbase:read", "offline_access"],
      tokenEndpointAuthMethod: "client_secret_post",
    })
    await repository.createAuthorizationCode({
      ...validActorContext(),
      clientId: "dcr_confidential",
      codeChallengeHash: pkceChallenge("test-verifier"),
      codeHash: hashOAuthToken("oa_code_confidential"),
      expiresAt: new Date("2026-06-02T12:05:00.000Z"),
      redirectUri: "https://claude.ai/api/mcp/auth_callback",
      resource: mcpResourceUrl,
      scope: ["contextbase:read", "offline_access"],
    })

    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/token", {
      body: new URLSearchParams({
        client_id: "dcr_confidential",
        client_secret: "dcr_secret_test",
        code: "oa_code_confidential",
        code_verifier: "test-verifier",
        grant_type: "authorization_code",
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        resource: mcpResourceUrl,
      }),
      method: "POST",
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      access_token: expect.stringMatching(/^vca_/),
      refresh_token: expect.stringMatching(/^vcr_/),
    })
    expect(repository.authorizationCodes[0]?.consumedAt).toEqual(now)
  })

  test("rejects authorization-code exchange when dynamic client is inactive", async () => {
    const repository = createMemoryOAuthRepository()
    await repository.registerClient({
      clientId: "dcr_confidential",
      clientName: "Claude",
      clientSecretExpiresAt: null,
      clientSecretHash: hashOAuthToken("dcr_secret_test"),
      clientUri: null,
      grantTypes: ["authorization_code", "refresh_token"],
      redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
      responseTypes: ["code"],
      scopes: ["contextbase:read", "offline_access"],
      tokenEndpointAuthMethod: "client_secret_post",
    })
    const registeredClient = repository.oauthClients[0]
    expect(registeredClient).toBeDefined()
    if (!registeredClient) return
    registeredClient.status = "inactive"
    await repository.createAuthorizationCode({
      ...validActorContext(),
      clientId: "dcr_confidential",
      codeChallengeHash: pkceChallenge("test-verifier"),
      codeHash: hashOAuthToken("oa_code_inactive_client"),
      expiresAt: new Date("2026-06-02T12:05:00.000Z"),
      redirectUri: "https://claude.ai/api/mcp/auth_callback",
      resource: mcpResourceUrl,
      scope: ["contextbase:read", "offline_access"],
    })

    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/token", {
      body: new URLSearchParams({
        client_id: "dcr_confidential",
        client_secret: "dcr_secret_test",
        code: "oa_code_inactive_client",
        code_verifier: "test-verifier",
        grant_type: "authorization_code",
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        resource: mcpResourceUrl,
      }),
      method: "POST",
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "invalid_client",
      error_description: "OAuth client authentication failed",
    })
    expect(repository.authorizationCodes[0]?.consumedAt).toBeNull()
    expect(repository.accessTokens).toHaveLength(0)
  })

  test("rejects confidential client refresh exchange without client secret", async () => {
    const repository = createMemoryOAuthRepository()
    await repository.registerClient({
      clientId: "dcr_confidential",
      clientName: "Claude",
      clientSecretExpiresAt: null,
      clientSecretHash: hashOAuthToken("dcr_secret_test"),
      clientUri: null,
      grantTypes: ["authorization_code", "refresh_token"],
      redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
      responseTypes: ["code"],
      scopes: ["contextbase:read", "offline_access"],
      tokenEndpointAuthMethod: "client_secret_post",
    })
    const grant = await repository.createGrant({
      ...validActorContext(),
      clientId: "dcr_confidential",
      clientName: "Claude",
      resource: mcpResourceUrl,
      scope: ["contextbase:read", "offline_access"],
    })
    await repository.createRefreshToken({
      ...validActorContext(),
      expiresAt: new Date("2026-07-02T12:00:00.000Z"),
      grantId: grant.id,
      tokenFamilyId: "ort_family",
      tokenHash: hashOAuthToken("vcr_confidential"),
    })

    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/token", {
      body: new URLSearchParams({
        client_id: "dcr_confidential",
        grant_type: "refresh_token",
        refresh_token: "vcr_confidential",
        resource: mcpResourceUrl,
      }),
      method: "POST",
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "invalid_client",
      error_description: "OAuth client authentication failed",
    })
    expect(repository.refreshTokens[0]?.consumedAt).toBeNull()
    expect(repository.accessTokens).toHaveLength(0)
    expect(repository.refreshTokens).toHaveLength(1)
  })

  test("rejects unauthenticated confidential refresh replay without revoking the grant", async () => {
    const repository = createMemoryOAuthRepository()
    await repository.registerClient({
      clientId: "dcr_confidential",
      clientName: "Claude",
      clientSecretExpiresAt: null,
      clientSecretHash: hashOAuthToken("dcr_secret_test"),
      clientUri: null,
      grantTypes: ["authorization_code", "refresh_token"],
      redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
      responseTypes: ["code"],
      scopes: ["contextbase:read", "offline_access"],
      tokenEndpointAuthMethod: "client_secret_post",
    })
    const grant = await repository.createGrant({
      ...validActorContext(),
      clientId: "dcr_confidential",
      clientName: "Claude",
      resource: mcpResourceUrl,
      scope: ["contextbase:read", "offline_access"],
    })
    await repository.createAccessToken({
      ...validActorContext(),
      expiresAt: new Date("2026-06-02T13:00:00.000Z"),
      grantId: grant.id,
      resource: mcpResourceUrl,
      scope: ["contextbase:read", "offline_access"],
      tokenHash: "old_access_hash",
    })
    await repository.createRefreshToken({
      ...validActorContext(),
      expiresAt: new Date("2026-07-02T12:00:00.000Z"),
      grantId: grant.id,
      tokenFamilyId: "ort_family",
      tokenHash: hashOAuthToken("vcr_consumed_confidential"),
    })
    const consumedRefreshToken = repository.refreshTokens[0]
    expect(consumedRefreshToken).toBeDefined()
    if (!consumedRefreshToken) return
    consumedRefreshToken.consumedAt = new Date("2026-06-02T12:01:00.000Z")

    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/token", {
      body: new URLSearchParams({
        client_id: "dcr_confidential",
        grant_type: "refresh_token",
        refresh_token: "vcr_consumed_confidential",
        resource: mcpResourceUrl,
      }),
      method: "POST",
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "invalid_client",
      error_description: "OAuth client authentication failed",
    })
    expect(repository.accessTokens[0]?.revokedAt).toBeNull()
    expect(repository.refreshTokens[0]?.revokedAt).toBeNull()
  })

  test("token exchange rejects copied agent authorization codes", async () => {
    const repository = createMemoryOAuthRepository()
    await repository.createAuthorizationCode({
      ...validActorContext(),
      actorId: "agt_builder",
      actorKind: "agent",
      clientId: "client",
      codeChallengeHash: pkceChallenge("test-verifier"),
      codeHash: hashOAuthToken("oa_code_test"),
      expiresAt: new Date("2026-06-02T12:05:00.000Z"),
      redirectUri: "http://127.0.0.1:49152/callback",
      resource: mcpResourceUrl,
      scope: ["contextbase:read"],
    })

    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/token", {
      body: new URLSearchParams({
        client_id: "client",
        code: "oa_code_test",
        code_verifier: "test-verifier",
        grant_type: "authorization_code",
        redirect_uri: "http://127.0.0.1:49152/callback",
        resource: mcpResourceUrl,
      }),
      method: "POST",
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_grant",
      error_description: "OAuth authorization code actor is not supported",
    })
  })

  test("returns a JSON OAuth error when token exchange storage fails", async () => {
    const repository = createMemoryOAuthRepository()
    await repository.createAuthorizationCode({
      ...validActorContext(),
      clientId: "client",
      codeChallengeHash: pkceChallenge("test-verifier"),
      codeHash: hashOAuthToken("oa_code_test"),
      expiresAt: new Date("2026-06-02T12:05:00.000Z"),
      redirectUri: "http://127.0.0.1:49152/callback",
      resource: mcpResourceUrl,
      scope: ["contextbase:read"],
    })

    const failingRepository: OAuthRepository = {
      ...repository,
      createGrant: async () => {
        throw new Error("storage unavailable")
      },
    }

    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      now: () => now,
      oauthRepository: failingRepository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/token", {
      body: new URLSearchParams({
        client_id: "client",
        code: "oa_code_test",
        code_verifier: "test-verifier",
        grant_type: "authorization_code",
        redirect_uri: "http://127.0.0.1:49152/callback",
        resource: mcpResourceUrl,
      }),
      method: "POST",
    })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: "server_error",
      error_description: "OAuth token exchange failed",
    })
  })

  test("rotates refresh tokens and revokes reused refresh token families", async () => {
    const repository = createMemoryOAuthRepository()
    const grant = await repository.createGrant({
      ...validActorContext(),
      clientId: "client",
      clientName: "Claude Code",
      resource: mcpResourceUrl,
      scope: ["contextbase:read", "offline_access"],
    })
    await repository.createAccessToken({
      ...validActorContext(),
      expiresAt: new Date("2026-06-02T13:00:00.000Z"),
      grantId: grant.id,
      resource: mcpResourceUrl,
      scope: ["contextbase:read", "offline_access"],
      tokenHash: "old_access_hash",
    })
    await repository.createRefreshToken({
      ...validActorContext(),
      expiresAt: new Date("2026-07-02T12:00:00.000Z"),
      grantId: grant.id,
      tokenFamilyId: "ort_family",
      tokenHash: hashOAuthToken("vcr_old"),
    })

    const authApp = createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    })
    const firstResponse = await authApp.request("/oauth/token", {
      body: new URLSearchParams({
        client_id: "client",
        grant_type: "refresh_token",
        refresh_token: "vcr_old",
        resource: mcpResourceUrl,
      }),
      method: "POST",
    })

    expect(firstResponse.status).toBe(200)
    await expect(firstResponse.json()).resolves.toMatchObject({
      access_token: expect.stringMatching(/^vca_/),
      refresh_token: expect.stringMatching(/^vcr_/),
    })
    expect(repository.refreshTokens[0]?.consumedAt).toEqual(now)
    expect(repository.refreshTokens).toHaveLength(2)

    const reuseResponse = await authApp.request("/oauth/token", {
      body: new URLSearchParams({
        client_id: "client",
        grant_type: "refresh_token",
        refresh_token: "vcr_old",
        resource: mcpResourceUrl,
      }),
      method: "POST",
    })

    expect(reuseResponse.status).toBe(400)
    await expect(reuseResponse.json()).resolves.toEqual({
      error: "invalid_grant",
      error_description: "OAuth refresh token was already consumed",
    })
    expect(repository.accessTokens.every((token) => token.revokedAt)).toBe(true)
    expect(repository.refreshTokens.every((token) => token.revokedAt)).toBe(true)
  })

  test("rejects refresh tokens submitted by a different OAuth client", async () => {
    const repository = createMemoryOAuthRepository()
    const grant = await repository.createGrant({
      ...validActorContext(),
      clientId: "client-a",
      clientName: "Claude Code",
      resource: mcpResourceUrl,
      scope: ["contextbase:read", "offline_access"],
    })
    await repository.createRefreshToken({
      ...validActorContext(),
      expiresAt: new Date("2026-07-02T12:00:00.000Z"),
      grantId: grant.id,
      tokenFamilyId: "ort_family",
      tokenHash: hashOAuthToken("vcr_client_bound"),
    })

    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/token", {
      body: new URLSearchParams({
        client_id: "client-b",
        grant_type: "refresh_token",
        refresh_token: "vcr_client_bound",
        resource: mcpResourceUrl,
      }),
      method: "POST",
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "invalid_grant",
      error_description: "OAuth refresh token is invalid",
    })
    expect(repository.refreshTokens[0]?.consumedAt).toBeNull()
    expect(repository.accessTokens).toHaveLength(0)
    expect(repository.refreshTokens).toHaveLength(1)
  })

  test("does not mint replacement tokens when refresh token consumption loses a race", async () => {
    const repository = createMemoryOAuthRepository()
    const grant = await repository.createGrant({
      ...validActorContext(),
      clientId: "client",
      clientName: "Claude Code",
      resource: mcpResourceUrl,
      scope: ["contextbase:read", "offline_access"],
    })
    await repository.createRefreshToken({
      ...validActorContext(),
      expiresAt: new Date("2026-07-02T12:00:00.000Z"),
      grantId: grant.id,
      tokenFamilyId: "ort_family",
      tokenHash: hashOAuthToken("vcr_racing"),
    })

    let createdAccessToken = false
    let createdRefreshToken = false
    const racingRepository: OAuthRepository = {
      ...repository,
      consumeRefreshToken: async () => false,
      createAccessToken: async (input: CreateAccessTokenInput) => {
        createdAccessToken = true
        return repository.createAccessToken(input)
      },
      createRefreshToken: async (input: CreateRefreshTokenInput) => {
        createdRefreshToken = true
        return repository.createRefreshToken(input)
      },
    }

    const response = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      now: () => now,
      oauthRepository: racingRepository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/token", {
      body: new URLSearchParams({
        client_id: "client",
        grant_type: "refresh_token",
        refresh_token: "vcr_racing",
        resource: mcpResourceUrl,
      }),
      method: "POST",
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "invalid_grant",
      error_description: "OAuth refresh token was already consumed",
    })
    expect(createdAccessToken).toBe(false)
    expect(createdRefreshToken).toBe(false)
  })

  test("rejects unsupported token grants and persists revocation", async () => {
    const repository = createMemoryOAuthRepository()
    const tokenResponse = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/token", {
      body: new URLSearchParams({ grant_type: "client_credentials" }),
      method: "POST",
    })
    await repository.createGrant({
      ...validActorContext(),
      clientId: "client",
      clientName: "Claude Code",
      resource: mcpResourceUrl,
      scope: ["contextbase:read"],
    })
    await repository.createAccessToken({
      ...validActorContext(),
      expiresAt: new Date("2026-06-02T13:00:00.000Z"),
      grantId: "oag_1",
      resource: mcpResourceUrl,
      scope: ["contextbase:read"],
      tokenHash: hashOAuthToken("vca_test"),
    })
    const revokeResponse = await createAuthApp({
      apiResourceUrl,
      authBaseUrl,
      mcpResourceUrl,
      now: () => now,
      oauthRepository: repository,
      webBaseUrl: "http://127.0.0.1:4017",
    }).request("/oauth/revoke", {
      body: new URLSearchParams({ token: "vca_test" }),
      method: "POST",
    })

    expect(tokenResponse.status).toBe(400)
    await expect(tokenResponse.json()).resolves.toEqual({
      error: "unsupported_grant_type",
      error_description: "Unsupported OAuth grant_type",
    })
    expect(revokeResponse.status).toBe(200)
    await expect(revokeResponse.json()).resolves.toEqual({
      ok: true,
      data: {
        revoked: true,
      },
    })
    expect(repository.accessTokens[0]?.revokedAt).toEqual(now)
  })
})

function validPendingRequest(): CreateAuthorizationRequestInput {
  return {
    clientId: claudeCodeClientId,
    codeChallenge: pkceChallenge("test-verifier"),
    codeChallengeMethod: "S256",
    expiresAt: new Date("2026-06-02T12:05:00.000Z"),
    redirectUri: "http://127.0.0.1:49152/callback",
    resource: mcpResourceUrl,
    scope: ["contextbase:read", "offline_access"],
    state: "state_123",
    stateHash: hashOAuthToken("state_123"),
  }
}

function validActorContext() {
  return {
    actorId: "usr_123",
    actorKind: "user",
    userId: "usr_123",
    workspaceId: "wrk_123",
    workspaceSlug: "core",
  }
}

function createBrowserAuthStore(input: { role?: string } = {}): BrowserAuthStore {
  const role = input.role ?? "workspace_admin"
  const session: BrowserSessionContext = {
    activeWorkspaceId: "wrk_123",
    activeWorkspaceRole: role,
    activeWorkspaceSlug: "core",
    email: "test@example.com",
    expiresAt: new Date("2026-06-02T13:00:00.000Z"),
    sessionId: "ses_123",
    userId: "usr_123",
    workspaces: [{ role, workspaceId: "wrk_123", workspaceSlug: "core" }],
  }

  return {
    findSessionByTokenHash: async (tokenHash) =>
      tokenHash === hashBrowserToken("raw_session") ? session : null,
  }
}

function createMemoryOAuthRepository(): OAuthRepository & {
  accessTokens: Array<CreateAccessTokenInput & { id: string; revokedAt: Date | null }>
  authorizationCodes: Array<
    OAuthAuthorizationCodeRecord & { codeHash: string; revokedAt?: Date | null }
  >
  authorizationRequests: Array<CreateAuthorizationRequestInput & { id: string; status: string }>
  grants: Array<CreateGrantInput & { id: string; revokedAt: Date | null; status: string }>
  oauthClients: OAuthClientRecord[]
  refreshTokens: Array<
    CreateRefreshTokenInput & { consumedAt: Date | null; id: string; revokedAt: Date | null }
  >
} {
  const authorizationRequests: Array<
    CreateAuthorizationRequestInput & { id: string; status: string }
  > = []
  const authorizationCodes: Array<OAuthAuthorizationCodeRecord & { codeHash: string }> = []
  const grants: Array<CreateGrantInput & { id: string; revokedAt: Date | null; status: string }> =
    []
  const oauthClients: OAuthClientRecord[] = []
  const accessTokens: Array<CreateAccessTokenInput & { id: string; revokedAt: Date | null }> = []
  const refreshTokens: Array<
    CreateRefreshTokenInput & { consumedAt: Date | null; id: string; revokedAt: Date | null }
  > = []
  return {
    accessTokens,
    authorizationCodes,
    authorizationRequests,
    consumeAuthorizationCode: async ({ codeId, consumedAt }) => {
      const code = authorizationCodes.find((item) => item.id === codeId && item.consumedAt === null)
      if (!code) return false
      code.consumedAt = consumedAt
      return true
    },
    consumeRefreshToken: async ({ consumedAt, refreshTokenId }) => {
      const token = refreshTokens.find(
        (item) => item.id === refreshTokenId && item.consumedAt === null,
      )
      if (!token) return false
      token.consumedAt = consumedAt
      return true
    },
    createAccessToken: async (input) => {
      const row = { ...input, id: `oat_${accessTokens.length + 1}`, revokedAt: null }
      accessTokens.push(row)
      return { id: row.id }
    },
    createAuthorizationCode: async (input) => {
      const row = {
        ...input,
        consumedAt: null,
        id: `ocd_${authorizationCodes.length + 1}`,
      }
      authorizationCodes.push(row)
      return { id: row.id }
    },
    createAuthorizationRequest: async (input) => {
      const row = { ...input, id: `oar_${authorizationRequests.length + 1}`, status: "pending" }
      authorizationRequests.push(row)
      return { id: row.id }
    },
    createGrant: async (input) => {
      const row = { ...input, id: `oag_${grants.length + 1}`, revokedAt: null, status: "active" }
      grants.push(row)
      return { id: row.id }
    },
    createRefreshToken: async (input) => {
      const row = {
        ...input,
        consumedAt: null,
        id: `ort_${refreshTokens.length + 1}`,
        revokedAt: null,
      }
      refreshTokens.push(row)
      return { id: row.id }
    },
    findClientByClientId: async (clientId) =>
      oauthClients.find((client) => client.clientId === clientId && client.status === "active") ??
      null,
    findAuthorizationCodeByHash: async (codeHash) =>
      authorizationCodes.find((code) => code.codeHash === codeHash) ?? null,
    findAuthorizationRequestById: async (id) =>
      authorizationRequests.find((request) => request.id === id) ?? null,
    findOAuthGrantForUser: async ({ grantId, userId }) =>
      mapMemoryGrant(grants.find((grant) => grant.id === grantId && grant.userId === userId)),
    findOAuthGrantForWorkspace: async ({ grantId, workspaceId }) =>
      mapMemoryGrant(
        grants.find((grant) => grant.id === grantId && grant.workspaceId === workspaceId),
      ),
    findRefreshTokenByHash: async (tokenHash): Promise<OAuthRefreshTokenRecord | null> => {
      const token = refreshTokens.find((item) => item.tokenHash === tokenHash)
      if (!token) return null
      const grant = grants.find((item) => item.id === token.grantId)
      return {
        actorId: token.actorId,
        actorKind: token.actorKind,
        clientId: grant?.clientId ?? "",
        consumedAt: token.consumedAt,
        expiresAt: token.expiresAt,
        grantId: token.grantId,
        id: token.id,
        resource: grant?.resource ?? "",
        revokedAt: token.revokedAt,
        scope: grant?.scope ?? [],
        tokenFamilyId: token.tokenFamilyId,
        userId: token.userId,
        workspaceId: token.workspaceId,
        workspaceSlug: token.workspaceSlug,
      }
    },
    grants,
    listOAuthGrantsForUser: async ({ userId }) =>
      grants
        .filter((grant) => grant.userId === userId)
        .map((grant) => mapMemoryGrant(grant))
        .filter((grant) => grant !== null),
    listOAuthGrantsForWorkspace: async ({ workspaceId }) =>
      grants
        .filter((grant) => grant.workspaceId === workspaceId)
        .map((grant) => mapMemoryGrant(grant))
        .filter((grant) => grant !== null),
    oauthClients,
    registerClient: async (input: OAuthClientRegistrationRecordInput) => {
      const row = { ...input, status: "active" }
      oauthClients.push(row)
      return { id: `oac_${oauthClients.length}` }
    },
    refreshTokens,
    revokeGrantTokens: async ({ grantId, revokedAt }) => {
      for (const token of accessTokens) {
        if (token.grantId === grantId) token.revokedAt = revokedAt
      }
      for (const token of refreshTokens) {
        if (token.grantId === grantId) token.revokedAt = revokedAt
      }
    },
    revokeTokenByHash: async ({ revokedAt, tokenHash }) => {
      const accessToken = accessTokens.find((token) => token.tokenHash === tokenHash)
      const refreshToken = refreshTokens.find((token) => token.tokenHash === tokenHash)
      const grantId = accessToken?.grantId ?? refreshToken?.grantId
      if (!grantId) return false
      for (const token of accessTokens) {
        if (token.grantId === grantId) token.revokedAt = revokedAt
      }
      for (const token of refreshTokens) {
        if (token.grantId === grantId) token.revokedAt = revokedAt
      }
      return true
    },
    revokeOAuthGrantForUser: async ({ grantId, revokedAt, userId }) => {
      const grant = grants.find((item) => item.id === grantId && item.userId === userId)
      if (!grant) return false
      grant.revokedAt = revokedAt
      grant.status = "revoked"
      return true
    },
    revokeOAuthGrantForWorkspace: async ({ grantId, revokedAt, workspaceId }) => {
      const grant = grants.find((item) => item.id === grantId && item.workspaceId === workspaceId)
      if (!grant) return false
      grant.revokedAt = revokedAt
      grant.status = "revoked"
      return true
    },
    updateOAuthGrantScopesForUser: async ({ grantId, scope, userId }) => {
      const grant = grants.find((item) => item.id === grantId && item.userId === userId)
      if (!grant) return null
      grant.scope = scope
      return mapMemoryGrant(grant)
    },
    updateOAuthGrantScopesForWorkspace: async ({ grantId, scope, workspaceId }) => {
      const grant = grants.find((item) => item.id === grantId && item.workspaceId === workspaceId)
      if (!grant) return null
      grant.scope = scope
      return mapMemoryGrant(grant)
    },
  }
}

function mapMemoryGrant(
  grant: (CreateGrantInput & { id: string; revokedAt: Date | null; status: string }) | undefined,
) {
  if (!grant) return null
  return {
    actorId: grant.actorId,
    actorKind: grant.actorKind,
    clientId: grant.clientId,
    clientName: grant.clientName,
    createdAt: now,
    id: grant.id,
    lastUsedAt: null,
    resource: grant.resource,
    revokedAt: grant.revokedAt,
    scope: grant.scope,
    status: grant.status,
    updatedAt: now,
    userId: grant.userId,
    workspaceId: grant.workspaceId,
    workspaceSlug: grant.workspaceSlug,
  }
}

function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url")
}
