import { Effect } from "effect"
import { describe, expect, test } from "vitest"

import { hashOAuthToken } from "../oauth/service"
import { authenticateApiToken, authenticateBearerToken, extractBearerToken } from "./authenticate"
import { hashApiToken } from "./bootstrap"

describe("extractBearerToken", () => {
  test("returns bearer token from authorization header", () => {
    const request = new Request("http://local.test", {
      headers: {
        authorization: "Bearer vct_123",
      },
    })

    expect(extractBearerToken(request)).toBe("vct_123")
  })

  test("returns null when authorization header is missing", () => {
    expect(extractBearerToken(new Request("http://local.test"))).toBeNull()
  })
})

describe("authenticateApiToken", () => {
  test("keeps the deprecated API-token resolver alias compatible with bearer authentication", async () => {
    const now = new Date("2026-06-02T12:00:00.000Z")
    const client = fakeClient({
      apiToken: {
        id: "tok_123",
        principalId: "usr_123",
        principalKind: "user",
        scopeJson: JSON.stringify(["contextbase:read"]),
        status: "active",
        tokenHash: hashApiToken("vct_test"),
        workspaceId: "wrk_123",
        workspaceSlug: "core",
      },
      workspaceMembership: {
        role: "workspace_member",
      },
    })

    await expect(
      Effect.runPromise(authenticateBearerToken(client, "vct_test", { now })),
    ).resolves.toMatchObject({
      authKind: "api_token",
      principalId: "usr_123",
      role: "workspace_member",
      scopes: ["contextbase:read"],
    })

    await expect(
      Effect.runPromise(authenticateApiToken(client, "vct_test", { now })),
    ).resolves.toMatchObject({
      authKind: "api_token",
      principalId: "usr_123",
      role: "workspace_member",
      scopes: ["contextbase:read"],
    })
  })

  test("accepts API tokens with scopes and records last use", async () => {
    const updated: unknown[] = []
    const now = new Date("2026-06-02T12:00:00.000Z")
    const client = fakeClient({
      apiToken: {
        id: "tok_123",
        principalId: "usr_123",
        principalKind: "user",
        scopeJson: JSON.stringify(["contextbase:read", "contextbase:files"]),
        status: "active",
        tokenHash: hashApiToken("vct_test"),
        workspaceId: "wrk_123",
        workspaceSlug: "core",
      },
      updated,
      workspaceMembership: {
        role: "workspace_admin",
      },
    })

    await expect(
      Effect.runPromise(authenticateApiToken(client, "vct_test", { now })),
    ).resolves.toEqual({
      authKind: "api_token",
      principalId: "usr_123",
      principalKind: "user",
      role: "workspace_admin",
      scopes: ["contextbase:read", "contextbase:files"],
      workspaceId: "wrk_123",
      workspaceSlug: "core",
    })
    expect(updated).toEqual([{ lastUsedAt: now }])
  })

  test("rejects copied agent API tokens even when a legacy agent row would be active", async () => {
    const updated: unknown[] = []
    const now = new Date("2026-06-02T12:00:00.000Z")
    const client = fakeClient({
      agent: {
        id: "agt_builder",
        status: "active",
      },
      apiToken: {
        id: "tok_agent",
        principalId: "agt_builder",
        principalKind: "agent",
        scopeJson: JSON.stringify(["contextbase:read", "contextbase:files"]),
        status: "active",
        tokenHash: hashApiToken("vct_agent"),
        workspaceId: "wrk_123",
        workspaceSlug: "core",
      },
      updated,
    })

    await expect(
      Effect.runPromise(Effect.flip(authenticateApiToken(client, "vct_agent", { now }))),
    ).resolves.toMatchObject({
      _tag: "ForbiddenError",
      code: "forbidden",
    })
    expect(updated).toEqual([])
  })

  test("rejects agent API tokens when the agent is not active in the workspace", async () => {
    const client = fakeClient({
      apiToken: {
        id: "tok_agent",
        principalId: "agt_builder",
        principalKind: "agent",
        scopeJson: JSON.stringify(["contextbase:read"]),
        status: "active",
        tokenHash: hashApiToken("vct_agent"),
        workspaceId: "wrk_123",
        workspaceSlug: "core",
      },
    })

    await expect(
      Effect.runPromise(Effect.flip(authenticateApiToken(client, "vct_agent"))),
    ).resolves.toMatchObject({
      _tag: "ForbiddenError",
      code: "forbidden",
    })
  })

  test("accepts API-audience OAuth access tokens", async () => {
    const tokenHash = hashOAuthToken("vca_test")
    const client = fakeClient({
      oauthAccessToken: {
        actorId: "usr_123",
        actorKind: "user",
        expiresAt: new Date("2026-06-02T13:00:00.000Z"),
        grantId: "oag_123",
        id: "oat_123",
        resource: "http://127.0.0.1:3017/api/v1",
        revokedAt: null,
        scopeJson: JSON.stringify(["contextbase:read"]),
        tokenHash,
        userId: "usr_123",
        workspaceId: "wrk_123",
        workspaceSlug: "core",
      },
      oauthGrant: {
        id: "oag_123",
        resource: "http://127.0.0.1:3017/api/v1",
        scopeJson: JSON.stringify(["contextbase:read"]),
        status: "active",
      },
      workspaceMembership: {
        role: "workspace_admin",
      },
    })

    await expect(
      Effect.runPromise(
        authenticateApiToken(client, "vca_test", {
          allowedOAuthResources: ["http://127.0.0.1:3017/api/v1"],
          now: new Date("2026-06-02T12:00:00.000Z"),
        }),
      ),
    ).resolves.toEqual({
      authKind: "oauth_access_token",
      grantId: "oag_123",
      principalId: "usr_123",
      principalKind: "user",
      resource: "http://127.0.0.1:3017/api/v1",
      role: "workspace_admin",
      scopes: ["contextbase:read"],
      workspaceId: "wrk_123",
      workspaceSlug: "core",
    })
  })

  test("rejects OAuth access tokens for copied workspace agent actors", async () => {
    const tokenHash = hashOAuthToken("vca_agent")
    const client = fakeClient({
      oauthAccessToken: {
        actorId: "agt_builder",
        actorKind: "agent",
        expiresAt: new Date("2026-06-02T13:00:00.000Z"),
        grantId: "oag_123",
        id: "oat_123",
        resource: "http://127.0.0.1:3217/mcp",
        revokedAt: null,
        scopeJson: JSON.stringify(["contextbase:read", "contextbase:files"]),
        tokenHash,
        userId: "usr_approver",
        workspaceId: "wrk_123",
        workspaceSlug: "core",
      },
      oauthGrant: {
        id: "oag_123",
        resource: "http://127.0.0.1:3217/mcp",
        scopeJson: JSON.stringify(["contextbase:read", "contextbase:files"]),
        status: "active",
      },
    })

    await expect(
      Effect.runPromise(
        Effect.flip(
          authenticateApiToken(client, "vca_agent", {
            allowedOAuthResources: ["http://127.0.0.1:3217/mcp"],
            now: new Date("2026-06-02T12:00:00.000Z"),
          }),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "ForbiddenError",
      code: "forbidden",
    })
  })

  test("rejects OAuth access tokens with the wrong audience", async () => {
    const client = fakeClient({
      oauthAccessToken: {
        actorId: "usr_123",
        actorKind: "user",
        expiresAt: new Date("2026-06-02T13:00:00.000Z"),
        grantId: "oag_123",
        id: "oat_123",
        resource: "http://127.0.0.1:3217/mcp",
        revokedAt: null,
        scopeJson: JSON.stringify(["contextbase:read"]),
        tokenHash: hashOAuthToken("vca_mcp"),
        userId: "usr_123",
        workspaceId: "wrk_123",
        workspaceSlug: "core",
      },
      oauthGrant: {
        id: "oag_123",
        resource: "http://127.0.0.1:3217/mcp",
        scopeJson: JSON.stringify(["contextbase:read"]),
        status: "active",
      },
      workspaceMembership: {
        role: "workspace_admin",
      },
    })

    await expect(
      Effect.runPromise(
        Effect.flip(
          authenticateApiToken(client, "vca_mcp", {
            allowedOAuthResources: ["http://127.0.0.1:3017/api/v1"],
            now: new Date("2026-06-02T12:00:00.000Z"),
          }),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "AuthenticationError",
      code: "unauthenticated",
    })
  })
})

function fakeClient(records: {
  agent?: unknown
  apiToken?: unknown
  oauthAccessToken?: unknown
  oauthGrant?: unknown
  updated?: unknown[]
  workspaceMembership?: unknown
}) {
  return {
    db: {
      query: {
        apiTokens: {
          findFirst: async () => records.apiToken ?? null,
        },
        agents: {
          findFirst: async () => records.agent ?? null,
        },
        oauthAccessTokens: {
          findFirst: async () => records.oauthAccessToken ?? null,
        },
        oauthGrants: {
          findFirst: async () => records.oauthGrant ?? null,
        },
        workspaceMemberships: {
          findFirst: async () => records.workspaceMembership ?? null,
        },
      },
      update: () => ({
        set: (value: unknown) => {
          records.updated?.push(value)
          return {
            where: async () => [],
          }
        },
      }),
    },
  } as never
}
