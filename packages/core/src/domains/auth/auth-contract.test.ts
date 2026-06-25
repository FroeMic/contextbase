import { Effect } from "effect"
import { describe, expect, test } from "vitest"

import { hashOAuthToken } from "../oauth/service"
import { authenticateApiToken } from "./authenticate"
import { canAdministerWorkspace } from "./authorization"
import { hashApiToken } from "./bootstrap"

describe("auth grant contract", () => {
  test("workspace_owner is not an admin role for the self-serve role model", () => {
    expect(
      canAdministerWorkspace({
        principalId: "usr_owner",
        principalKind: "user",
        role: "workspace_owner",
        scopes: ["contextbase:read", "contextbase:manage"],
        workspaceId: "wrk_123",
        workspaceSlug: "core",
      }),
    ).toBe(false)
  })

  test("user API token inherits user membership role and requires admin scope for admin authority", async () => {
    const adminContext = await Effect.runPromise(
      authenticateApiToken(
        fakeClient({
          apiToken: apiTokenRow({
            principalId: "usr_admin",
            scope: ["contextbase:read", "contextbase:manage"],
            token: "vct_admin",
          }),
          workspaceMembership: { role: "workspace_admin" },
        }),
        "vct_admin",
      ),
    )

    expect(adminContext).toMatchObject({
      principalId: "usr_admin",
      principalKind: "user",
      role: "workspace_admin",
      scopes: ["contextbase:read", "contextbase:manage"],
    })
    expect(canAdministerWorkspace(adminContext)).toBe(true)

    const memberContext = await Effect.runPromise(
      authenticateApiToken(
        fakeClient({
          apiToken: apiTokenRow({
            principalId: "usr_member",
            scope: ["contextbase:read", "contextbase:manage"],
            token: "vct_member",
          }),
          workspaceMembership: { role: "workspace_member" },
        }),
        "vct_member",
      ),
    )

    expect(memberContext).toMatchObject({
      principalId: "usr_member",
      principalKind: "user",
      role: "workspace_member",
      scopes: ["contextbase:read", "contextbase:manage"],
    })
    expect(canAdministerWorkspace(memberContext)).toBe(false)

    const unscopedAdminContext = await Effect.runPromise(
      authenticateApiToken(
        fakeClient({
          apiToken: apiTokenRow({
            principalId: "usr_unscoped_admin",
            scope: ["contextbase:read"],
            token: "vct_unscoped_admin",
          }),
          workspaceMembership: { role: "workspace_admin" },
        }),
        "vct_unscoped_admin",
      ),
    )

    expect(unscopedAdminContext).toMatchObject({
      principalId: "usr_unscoped_admin",
      principalKind: "user",
      role: "workspace_admin",
      scopes: ["contextbase:read"],
    })
    expect(canAdministerWorkspace(unscopedAdminContext)).toBe(false)
  })

  test("copied agent API tokens are rejected instead of inheriting workspace authority", async () => {
    await expect(
      Effect.runPromise(
        Effect.flip(
          authenticateApiToken(
            fakeClient({
              agent: { id: "agt_builder", status: "active" },
              apiToken: apiTokenRow({
                principalId: "agt_builder",
                principalKind: "agent",
                scope: ["contextbase:read", "contextbase:write", "contextbase:files"],
                token: "vct_agent",
              }),
            }),
            "vct_agent",
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "ForbiddenError",
      code: "forbidden",
    })
  })

  test("OAuth user token uses user membership role and OAuth scopes for admin authority", async () => {
    const adminContext = await Effect.runPromise(
      authenticateApiToken(
        fakeClient({
          oauthAccessToken: oauthAccessTokenRow({
            actorId: "usr_admin",
            scope: ["contextbase:read", "contextbase:manage"],
            token: "vca_admin",
          }),
          oauthGrant: oauthGrantRow({
            scope: ["contextbase:read", "contextbase:manage"],
          }),
          workspaceMembership: { role: "workspace_admin" },
        }),
        "vca_admin",
        {
          allowedOAuthResources: ["http://127.0.0.1:3017/api/v1"],
          now: now(),
        },
      ),
    )

    expect(adminContext).toMatchObject({
      authKind: "oauth_access_token",
      principalId: "usr_admin",
      principalKind: "user",
      role: "workspace_admin",
      scopes: ["contextbase:read", "contextbase:manage"],
    })
    expect(canAdministerWorkspace(adminContext)).toBe(true)

    const memberContext = await Effect.runPromise(
      authenticateApiToken(
        fakeClient({
          oauthAccessToken: oauthAccessTokenRow({
            actorId: "usr_member",
            scope: ["contextbase:read", "contextbase:manage"],
            token: "vca_member",
          }),
          oauthGrant: oauthGrantRow({
            scope: ["contextbase:read", "contextbase:manage"],
          }),
          workspaceMembership: { role: "workspace_member" },
        }),
        "vca_member",
        {
          allowedOAuthResources: ["http://127.0.0.1:3017/api/v1"],
          now: now(),
        },
      ),
    )

    expect(memberContext).toMatchObject({
      principalId: "usr_member",
      principalKind: "user",
      role: "workspace_member",
      scopes: ["contextbase:read", "contextbase:manage"],
    })
    expect(canAdministerWorkspace(memberContext)).toBe(false)
  })

  test("OAuth agent tokens are rejected instead of inheriting copied agent authority", async () => {
    await expect(
      Effect.runPromise(
        Effect.flip(
          authenticateApiToken(
            fakeClient({
              oauthAccessToken: oauthAccessTokenRow({
                actorId: "agt_builder",
                actorKind: "agent",
                scope: ["contextbase:read", "contextbase:manage"],
                token: "vca_agent_admin",
              }),
              oauthGrant: oauthGrantRow({
                actorId: "agt_builder",
                actorKind: "agent",
                scope: ["contextbase:read", "contextbase:manage"],
              }),
            }),
            "vca_agent_admin",
            {
              allowedOAuthResources: ["http://127.0.0.1:3017/api/v1"],
              now: now(),
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "ForbiddenError",
      code: "forbidden",
    })
  })

  test("OAuth access tokens are audience-bound", async () => {
    await expect(
      Effect.runPromise(
        Effect.flip(
          authenticateApiToken(
            fakeClient({
              oauthAccessToken: oauthAccessTokenRow({
                resource: "http://127.0.0.1:3217/mcp",
                token: "vca_mcp",
              }),
              oauthGrant: oauthGrantRow({
                resource: "http://127.0.0.1:3217/mcp",
              }),
              workspaceMembership: { role: "workspace_admin" },
            }),
            "vca_mcp",
            {
              allowedOAuthResources: ["http://127.0.0.1:3017/api/v1"],
              now: now(),
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "AuthenticationError",
      code: "unauthenticated",
    })
  })
})

function now() {
  return new Date("2026-06-03T12:00:00.000Z")
}

function apiTokenRow(input: {
  principalId: string
  principalKind?: "agent" | "user"
  scope: string[]
  token: string
}) {
  return {
    id: `tok_${input.token}`,
    principalId: input.principalId,
    principalKind: input.principalKind ?? "user",
    scopeJson: JSON.stringify(input.scope),
    status: "active",
    tokenHash: hashApiToken(input.token),
    workspaceId: "wrk_123",
    workspaceSlug: "core",
  }
}

function oauthAccessTokenRow(input: {
  actorId?: string
  actorKind?: "agent" | "user"
  resource?: string
  scope?: string[]
  token: string
}) {
  return {
    actorId: input.actorId ?? "usr_123",
    actorKind: input.actorKind ?? "user",
    expiresAt: new Date("2026-06-03T13:00:00.000Z"),
    grantId: "oag_123",
    id: `oat_${input.token}`,
    resource: input.resource ?? "http://127.0.0.1:3017/api/v1",
    revokedAt: null,
    scopeJson: JSON.stringify(input.scope ?? ["contextbase:read"]),
    tokenHash: hashOAuthToken(input.token),
    userId: "usr_authorizer",
    workspaceId: "wrk_123",
    workspaceSlug: "core",
  }
}

function oauthGrantRow(
  input: {
    actorId?: string
    actorKind?: "agent" | "user"
    resource?: string
    scope?: string[]
  } = {},
) {
  return {
    actorId: input.actorId ?? "usr_123",
    actorKind: input.actorKind ?? "user",
    id: "oag_123",
    resource: input.resource ?? "http://127.0.0.1:3017/api/v1",
    revokedAt: null,
    scopeJson: JSON.stringify(input.scope ?? ["contextbase:read"]),
    status: "active",
  }
}

function fakeClient(records: {
  agent?: unknown
  apiToken?: unknown
  oauthAccessToken?: unknown
  oauthGrant?: unknown
  workspaceMembership?: unknown
}) {
  return {
    db: {
      query: {
        agents: {
          findFirst: async () => records.agent ?? null,
        },
        apiTokens: {
          findFirst: async () => records.apiToken ?? null,
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
        set: () => ({
          where: async () => [],
        }),
      }),
    },
  } as never
}
