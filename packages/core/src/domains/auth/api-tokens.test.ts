import { Effect } from "effect"
import { describe, expect, test } from "vitest"
import {
  type ApiTokenDto,
  type ApiTokenManagementStore,
  createPersonalApiToken,
  listPersonalApiTokens,
  listWorkspaceMemberApiTokens,
  revokePersonalApiToken,
  revokeWorkspaceMemberApiToken,
  updatePersonalApiToken,
  updateWorkspaceMemberApiToken,
} from "./api-tokens"
import type { AuthenticatedContext } from "./authenticate"

const userAuth: AuthenticatedContext = {
  principalId: "usr_123",
  principalKind: "user",
  role: "workspace_admin",
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

const tokenRow: ApiTokenDto = {
  createdAt: new Date("2026-06-02T12:00:00.000Z"),
  createdByUserId: "usr_123",
  expiresAt: null,
  id: "tok_123",
  label: "CLI",
  lastUsedAt: null,
  principalId: "usr_123",
  principalKind: "user",
  revokedAt: null,
  scope: ["contextbase:read", "contextbase:write", "contextbase:files"] as const,
  status: "active",
  updatedAt: new Date("2026-06-02T12:00:00.000Z"),
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

describe("API token management", () => {
  test("creates a personal API token and returns the raw token once", async () => {
    const store = memoryStore()

    const result = await Effect.runPromise(
      createPersonalApiToken(store, userAuth, {
        label: "Claude CLI",
        randomToken: () => "cbt_raw",
        scope: ["contextbase:read", "contextbase:files", "contextbase:manage"],
      }),
    )

    expect(result.rawToken).toBe("cbt_raw")
    expect(result.token).toMatchObject({
      createdByUserId: "usr_123",
      label: "Claude CLI",
      principalId: "usr_123",
      principalKind: "user",
      scope: ["contextbase:read", "contextbase:files", "contextbase:manage"],
      workspaceId: "wrk_123",
    })
  })

  test("rejects personal admin API tokens for non-admin workspace members", async () => {
    const store = memoryStore()

    await expect(
      Effect.runPromise(
        Effect.flip(
          createPersonalApiToken(
            store,
            {
              ...userAuth,
              role: "workspace_member",
            },
            {
              label: "Member admin",
              randomToken: () => "cbt_member_admin",
              scope: ["contextbase:read", "contextbase:manage"],
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({ _tag: "ForbiddenError" })
  })

  test("lists only current-user personal API tokens", async () => {
    const store = memoryStore([
      tokenRow,
      { ...tokenRow, id: "tok_agent", principalId: "agt_123", principalKind: "agent" },
      { ...tokenRow, id: "tok_other", principalId: "usr_other" },
    ])

    await expect(Effect.runPromise(listPersonalApiTokens(store, userAuth))).resolves.toEqual([
      tokenRow,
    ])
  })

  test("updates personal token label and reduces scopes", async () => {
    const store = memoryStore([tokenRow])

    const updated = await Effect.runPromise(
      updatePersonalApiToken(store, userAuth, {
        label: "Reduced",
        scope: ["contextbase:read"],
        tokenId: "tok_123",
      }),
    )

    expect(updated).toMatchObject({ label: "Reduced", scope: ["contextbase:read"] })
  })

  test("rejects invalid API token scopes", async () => {
    const store = memoryStore()

    await expect(
      Effect.runPromise(
        Effect.flip(
          createPersonalApiToken(store, userAuth, {
            label: "Invalid",
            scope: ["offline_access" as "contextbase:read"],
          }),
        ),
      ),
    ).resolves.toMatchObject({ _tag: "InvalidRequestError" })
  })

  test("revokes personal tokens owned by the current user", async () => {
    const store = memoryStore([tokenRow])

    await expect(
      Effect.runPromise(
        revokePersonalApiToken(store, userAuth, {
          revokedAt: new Date("2026-06-02T13:00:00.000Z"),
          tokenId: "tok_123",
        }),
      ),
    ).resolves.toEqual({ revoked: true })
    await expect(Effect.runPromise(listPersonalApiTokens(store, userAuth))).resolves.toEqual([])
  })

  test("lists workspace member tokens for workspace admins", async () => {
    const otherUserToken = { ...tokenRow, id: "tok_other", principalId: "usr_other" }
    const agentToken = {
      ...tokenRow,
      id: "tok_agent",
      principalId: "agt_123",
      principalKind: "agent",
    }
    const store = memoryStore([tokenRow, otherUserToken, agentToken])

    await expect(Effect.runPromise(listWorkspaceMemberApiTokens(store, userAuth))).resolves.toEqual(
      [tokenRow, otherUserToken],
    )
  })

  test("updates and revokes workspace member tokens for workspace admins", async () => {
    const otherUserToken = { ...tokenRow, id: "tok_other", principalId: "usr_other" }
    const store = memoryStore([otherUserToken])

    await expect(
      Effect.runPromise(
        updateWorkspaceMemberApiToken(store, userAuth, {
          label: "Reduced member",
          scope: ["contextbase:read"],
          tokenId: "tok_other",
        }),
      ),
    ).resolves.toMatchObject({ label: "Reduced member", scope: ["contextbase:read"] })

    await expect(
      Effect.runPromise(
        revokeWorkspaceMemberApiToken(store, userAuth, {
          revokedAt: new Date("2026-06-02T13:00:00.000Z"),
          tokenId: "tok_other",
        }),
      ),
    ).resolves.toEqual({ revoked: true })
    await expect(Effect.runPromise(listWorkspaceMemberApiTokens(store, userAuth))).resolves.toEqual(
      [],
    )
  })
})

function memoryStore(initialTokens: Array<typeof tokenRow> = []): ApiTokenManagementStore {
  const rows = initialTokens.map((row) => ({ ...row, scope: [...row.scope] }))
  return {
    createApiToken: async (input) => {
      const row = {
        createdAt: new Date("2026-06-02T12:00:00.000Z"),
        createdByUserId: input.createdByUserId,
        expiresAt: null,
        id: `tok_${rows.length + 1}`,
        label: input.label,
        lastUsedAt: null,
        principalId: input.principalId,
        principalKind: input.principalKind,
        revokedAt: null,
        scope: input.scope,
        status: "active",
        updatedAt: new Date("2026-06-02T12:00:00.000Z"),
        workspaceId: input.workspaceId,
        workspaceSlug: input.workspaceSlug,
      }
      rows.push(row)
      return row
    },
    findApiTokenForUserPrincipal: async (input) =>
      rows.find(
        (row) =>
          row.id === input.tokenId &&
          row.principalKind === "user" &&
          row.principalId === input.userId &&
          row.workspaceId === input.workspaceId &&
          row.status === "active",
      ) ?? null,
    listApiTokensForUserPrincipal: async (input) =>
      rows.filter(
        (row) =>
          row.principalKind === "user" &&
          row.principalId === input.userId &&
          row.workspaceId === input.workspaceId &&
          row.status === "active",
      ),
    listApiTokensForWorkspaceMembers: async (input) =>
      rows.filter(
        (row) =>
          row.principalKind === "user" &&
          row.workspaceId === input.workspaceId &&
          row.status === "active",
      ),
    revokeApiTokenForUserPrincipal: async (input) => {
      const row = rows.find(
        (candidate) =>
          candidate.id === input.tokenId &&
          candidate.principalKind === "user" &&
          candidate.principalId === input.userId &&
          candidate.workspaceId === input.workspaceId &&
          candidate.status === "active",
      )
      if (!row) return false
      row.status = "revoked"
      row.revokedAt = input.revokedAt
      return true
    },
    revokeApiTokenForWorkspaceMember: async (input) => {
      const row = rows.find(
        (candidate) =>
          candidate.id === input.tokenId &&
          candidate.principalKind === "user" &&
          candidate.workspaceId === input.workspaceId &&
          candidate.status === "active",
      )
      if (!row) return false
      row.status = "revoked"
      row.revokedAt = input.revokedAt
      return true
    },
    updateApiTokenForUserPrincipal: async (input) => {
      const row = rows.find(
        (candidate) =>
          candidate.id === input.tokenId &&
          candidate.principalKind === "user" &&
          candidate.principalId === input.userId &&
          candidate.workspaceId === input.workspaceId &&
          candidate.status === "active",
      )
      if (!row) return null
      row.label = input.label
      row.scope = input.scope
      return row
    },
    updateApiTokenForWorkspaceMember: async (input) => {
      const row = rows.find(
        (candidate) =>
          candidate.id === input.tokenId &&
          candidate.principalKind === "user" &&
          candidate.workspaceId === input.workspaceId &&
          candidate.status === "active",
      )
      if (!row) return null
      row.label = input.label
      row.scope = input.scope
      return row
    },
  }
}
