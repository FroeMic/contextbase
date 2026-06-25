import { describe, expect, test } from "vitest"

import { createPostgresOAuthRepository } from "./repository"

describe("OAuth repository", () => {
  test("persists pending authorization requests with raw and hashed state", async () => {
    const inserted: unknown[] = []
    const repository = createPostgresOAuthRepository(fakeClient(inserted))
    const expiresAt = new Date("2026-06-02T12:05:00.000Z")

    await repository.createAuthorizationRequest({
      clientId: "client",
      codeChallenge: "challenge",
      codeChallengeMethod: "S256",
      expiresAt,
      redirectUri: "http://127.0.0.1:49152/callback",
      resource: "http://127.0.0.1:3217/mcp",
      scope: ["contextbase:read"],
      state: "state_123",
      stateHash: "state_hash",
    })

    expect(inserted[0]).toMatchObject({
      clientId: "client",
      scopeJson: JSON.stringify(["contextbase:read"]),
      state: "state_123",
      stateHash: "state_hash",
    })
  })

  test("persists dynamically registered OAuth client metadata", async () => {
    const inserted: unknown[] = []
    const repository = createPostgresOAuthRepository(fakeClient(inserted))

    await repository.registerClient({
      clientId: "dcr_registered",
      clientName: "Cursor",
      clientUri: null,
      grantTypes: ["authorization_code", "refresh_token"],
      redirectUris: ["http://127.0.0.1:54321/callback"],
      responseTypes: ["code"],
      scopes: ["contextbase:read", "contextbase:files"],
      tokenEndpointAuthMethod: "none",
    })

    expect(inserted[0]).toMatchObject({
      clientId: "dcr_registered",
      clientName: "Cursor",
      grantTypesJson: JSON.stringify(["authorization_code", "refresh_token"]),
      redirectUrisJson: JSON.stringify(["http://127.0.0.1:54321/callback"]),
      responseTypesJson: JSON.stringify(["code"]),
      scopeJson: JSON.stringify(["contextbase:read", "contextbase:files"]),
      tokenEndpointAuthMethod: "none",
    })
  })

  test("finds active OAuth clients by client ID", async () => {
    const repository = createPostgresOAuthRepository(
      fakeClient([], {
        existingClientRow: {
          clientId: "dcr_registered",
          clientName: "Cursor",
          clientUri: null,
          grantTypesJson: JSON.stringify(["authorization_code", "refresh_token"]),
          redirectUrisJson: JSON.stringify(["http://127.0.0.1:54321/callback"]),
          responseTypesJson: JSON.stringify(["code"]),
          scopeJson: JSON.stringify(["contextbase:read", "contextbase:files"]),
          status: "active",
          tokenEndpointAuthMethod: "none",
        },
      }),
    )

    await expect(repository.findClientByClientId("dcr_registered")).resolves.toMatchObject({
      clientId: "dcr_registered",
      clientName: "Cursor",
      redirectUris: ["http://127.0.0.1:54321/callback"],
      scopes: ["contextbase:read", "contextbase:files"],
      status: "active",
    })
  })

  test("persists authorization codes with workspace actor context and serialized scopes", async () => {
    const inserted: unknown[] = []
    const repository = createPostgresOAuthRepository(fakeClient(inserted))
    const expiresAt = new Date("2026-06-02T12:05:00.000Z")

    await repository.createAuthorizationCode({
      clientId: "client",
      codeChallengeHash: "challenge_hash",
      codeHash: "code_hash",
      expiresAt,
      redirectUri: "http://127.0.0.1:49152/callback",
      resource: "http://127.0.0.1:3217/mcp",
      scope: ["contextbase:read", "contextbase:files"],
      userId: "usr_123",
      actorId: "agt_123",
      actorKind: "agent",
      workspaceId: "wrk_123",
      workspaceSlug: "core",
    })

    expect(inserted[0]).toMatchObject({
      actorId: "agt_123",
      actorKind: "agent",
      clientId: "client",
      codeChallengeHash: "challenge_hash",
      codeHash: "code_hash",
      expiresAt,
      resource: "http://127.0.0.1:3217/mcp",
      scopeJson: JSON.stringify(["contextbase:read", "contextbase:files"]),
      userId: "usr_123",
      workspaceId: "wrk_123",
      workspaceSlug: "core",
    })
  })

  test("persists OAuth grant and access token rows with denormalized workspace actor fields", async () => {
    const inserted: unknown[] = []
    const repository = createPostgresOAuthRepository(fakeClient(inserted))
    const expiresAt = new Date("2026-06-02T13:00:00.000Z")

    await repository.createGrant({
      actorId: "usr_123",
      actorKind: "user",
      clientId: "client",
      clientName: "Claude Code",
      resource: "http://127.0.0.1:3217/mcp",
      scope: ["contextbase:read"],
      userId: "usr_123",
      workspaceId: "wrk_123",
      workspaceSlug: "core",
    })
    await repository.createAccessToken({
      actorId: "usr_123",
      actorKind: "user",
      expiresAt,
      grantId: "oag_123",
      resource: "http://127.0.0.1:3217/mcp",
      scope: ["contextbase:read"],
      tokenHash: "access_hash",
      userId: "usr_123",
      workspaceId: "wrk_123",
      workspaceSlug: "core",
    })

    expect(inserted[0]).toMatchObject({
      actorId: "usr_123",
      actorKind: "user",
      clientName: "Claude Code",
      scopeJson: JSON.stringify(["contextbase:read"]),
      workspaceId: "wrk_123",
    })
    expect(inserted[1]).toMatchObject({
      actorId: "usr_123",
      actorKind: "user",
      grantId: "oag_123",
      resource: "http://127.0.0.1:3217/mcp",
      scopeJson: JSON.stringify(["contextbase:read"]),
      tokenHash: "access_hash",
      workspaceId: "wrk_123",
    })
  })

  test("reuses an existing OAuth grant for the same client resource and actor", async () => {
    const inserted: unknown[] = []
    const updated: unknown[] = []
    const repository = createPostgresOAuthRepository(
      fakeClient(inserted, { existingGrantId: "oag_existing", updated }),
    )

    const grant = await repository.createGrant({
      actorId: "usr_123",
      actorKind: "user",
      clientId: "client",
      clientName: "Claude Code updated",
      resource: "http://127.0.0.1:3217/mcp",
      scope: ["contextbase:read", "contextbase:files"],
      userId: "usr_123",
      workspaceId: "wrk_123",
      workspaceSlug: "core",
    })

    expect(grant).toEqual({ id: "oag_existing" })
    expect(inserted).toEqual([])
    expect(updated[0]).toMatchObject({
      clientName: "Claude Code updated",
      scopeJson: JSON.stringify(["contextbase:read", "contextbase:files"]),
      workspaceSlug: "core",
    })
  })

  test("looks up agent actor grants without the approving user in the active identity", async () => {
    const inserted: unknown[] = []
    let lookupWhere: unknown
    const repository = createPostgresOAuthRepository(
      fakeClient(inserted, {
        onFindGrant: (where) => {
          lookupWhere = where
          return null
        },
      }),
    )

    await repository.createGrant({
      actorId: "agt_builder",
      actorKind: "agent",
      clientId: "client",
      clientName: "Claude Code",
      resource: "http://127.0.0.1:3217/mcp",
      scope: ["contextbase:read"],
      userId: "usr_approver",
      workspaceId: "wrk_123",
      workspaceSlug: "core",
    })

    expect(collectColumnNames(lookupWhere)).toEqual([
      "client_id",
      "resource",
      "workspace_id",
      "status",
      "revoked_at",
      "actor_kind",
      "actor_id",
    ])
  })

  test("only reuses active non-revoked OAuth grants", async () => {
    const inserted: unknown[] = []
    let lookupWhere: unknown
    const repository = createPostgresOAuthRepository(
      fakeClient(inserted, {
        onFindGrant: (where) => {
          lookupWhere = where
          return null
        },
      }),
    )

    await repository.createGrant({
      actorId: "usr_123",
      actorKind: "user",
      clientId: "client",
      clientName: "Claude Code",
      resource: "http://127.0.0.1:3217/mcp",
      scope: ["contextbase:read"],
      userId: "usr_123",
      workspaceId: "wrk_123",
      workspaceSlug: "core",
    })

    expect(collectColumnNames(lookupWhere)).toEqual([
      "client_id",
      "resource",
      "workspace_id",
      "user_id",
      "status",
      "revoked_at",
      "actor_kind",
      "actor_id",
    ])
    expect(inserted).toHaveLength(1)
  })

  test("updates active access and refresh token scopes when reducing a user grant", async () => {
    const inserted: unknown[] = []
    const updated: unknown[] = []
    const repository = createPostgresOAuthRepository(
      fakeClient(inserted, {
        existingGrantRow: {
          actorId: "usr_123",
          actorKind: "user",
          clientId: "client",
          clientName: "Claude Code",
          createdAt: new Date("2026-06-02T12:00:00.000Z"),
          id: "oag_123",
          lastUsedAt: null,
          resource: "http://127.0.0.1:3217/mcp",
          revokedAt: null,
          scopeJson: JSON.stringify(["contextbase:read"]),
          status: "active",
          updatedAt: new Date("2026-06-02T12:00:00.000Z"),
          userId: "usr_123",
          workspaceId: "wrk_123",
          workspaceSlug: "core",
        },
        updated,
      }),
    )

    await repository.updateOAuthGrantScopesForUser({
      grantId: "oag_123",
      scope: ["contextbase:read"],
      userId: "usr_123",
    })

    expect(updated).toContainEqual({
      scopeJson: JSON.stringify(["contextbase:read"]),
      updatedAt: expect.any(Date),
    })
    expect(updated.filter((value) => hasScopeJson(value))).toHaveLength(2)
  })
})

function fakeClient(
  inserted: unknown[],
  options: {
    existingGrantId?: string
    existingGrantRow?: Record<string, unknown> & { id: string }
    existingClientRow?: Record<string, unknown>
    onFindGrant?: (where: unknown) => { id: string } | null
    updated?: unknown[]
  } = {},
) {
  return {
    db: {
      query: {
        oauthClients: {
          findFirst: async () => options.existingClientRow ?? null,
        },
        oauthGrants: {
          findFirst: async (query?: { where?: unknown }) =>
            options.onFindGrant?.(query?.where) ??
            options.existingGrantRow ??
            (options.existingGrantId ? { id: options.existingGrantId } : null),
        },
      },
      insert: () => ({
        values: (value: unknown) => {
          inserted.push(value)
          return {
            onConflictDoUpdate: () => ({
              returning: async () => [{ id: `row_${inserted.length}`, ...(value as object) }],
            }),
            returning: async () => [{ id: `row_${inserted.length}`, ...(value as object) }],
          }
        },
      }),
      update: () => ({
        set: (value: unknown) => {
          options.updated?.push(value)
          return {
            where: () => ({
              returning: async () => (options.existingGrantRow ? [options.existingGrantRow] : []),
            }),
          }
        },
      }),
    },
  } as never
}

function hasScopeJson(value: unknown) {
  return (
    typeof value === "object" &&
    value !== null &&
    "scopeJson" in value &&
    value.scopeJson === JSON.stringify(["contextbase:read"])
  )
}

function collectColumnNames(value: unknown): string[] {
  const columns: string[] = []
  collectColumnNamesInto(value, columns)
  return columns
}

function collectColumnNamesInto(value: unknown, columns: string[]) {
  if (!value || typeof value !== "object") return
  if ("name" in value && typeof value.name === "string" && "table" in value) {
    columns.push(value.name)
    return
  }
  if ("queryChunks" in value && Array.isArray(value.queryChunks)) {
    for (const chunk of value.queryChunks) {
      collectColumnNamesInto(chunk, columns)
    }
  }
}
