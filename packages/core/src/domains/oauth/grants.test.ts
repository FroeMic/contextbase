import { Effect } from "effect"
import { describe, expect, test } from "vitest"

import type { AuthenticatedContext } from "../auth/authenticate"
import {
  listOwnOAuthGrants,
  listWorkspaceOAuthGrants,
  type OAuthGrantManagementStore,
  revokeOwnOAuthGrant,
  revokeWorkspaceOAuthGrant,
  type UserOAuthGrantDto,
  updateOwnOAuthGrantScopes,
  updateWorkspaceOAuthGrantScopes,
} from "./grants"

const auth: AuthenticatedContext = {
  principalId: "usr_123",
  principalKind: "user",
  role: "workspace_admin",
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

const grant: UserOAuthGrantDto = {
  actorId: "usr_123",
  actorKind: "user",
  clientId: "https://claude.ai/oauth/claude-code-client-metadata",
  clientName: "Claude Code",
  createdAt: new Date("2026-06-02T12:00:00.000Z"),
  id: "oag_123",
  lastUsedAt: null,
  resource: "https://startwithvertical.test/mcp",
  revokedAt: null,
  scope: ["contextbase:read", "contextbase:write", "contextbase:files", "offline_access"],
  status: "active",
  updatedAt: new Date("2026-06-02T12:00:00.000Z"),
  userId: "usr_123",
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

const agentGrant: UserOAuthGrantDto = {
  ...grant,
  actorId: "agt_builder",
  actorKind: "agent",
  id: "oag_agent",
}

describe("OAuth grant management", () => {
  test("lists OAuth grants owned by the current user", async () => {
    const store = memoryStore([grant])

    await expect(Effect.runPromise(listOwnOAuthGrants(store, auth))).resolves.toEqual([grant])
  })

  test("does not list agent actor grants as account-owned grants", async () => {
    const store = memoryStore([grant, agentGrant])

    await expect(Effect.runPromise(listOwnOAuthGrants(store, auth))).resolves.toEqual([grant])
  })

  test("allows reducing grant scopes in settings", async () => {
    const store = memoryStore([grant])

    await expect(
      Effect.runPromise(
        updateOwnOAuthGrantScopes(store, auth, {
          grantId: "oag_123",
          scope: ["contextbase:read", "contextbase:files"],
        }),
      ),
    ).resolves.toMatchObject({
      id: "oag_123",
      scope: ["contextbase:read", "contextbase:files"],
    })
  })

  test("rejects expanding grant scopes in settings", async () => {
    const store = memoryStore([{ ...grant, scope: ["contextbase:read"] }])

    await expect(
      Effect.runPromise(
        Effect.flip(
          updateOwnOAuthGrantScopes(store, auth, {
            grantId: "oag_123",
            scope: ["contextbase:read", "contextbase:write"],
          }),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "InvalidRequestError",
      code: "invalid_request",
    })
  })

  test("revokes an owned OAuth grant and its tokens", async () => {
    const revokedAt = new Date("2026-06-02T13:00:00.000Z")
    const store = memoryStore([grant])

    await expect(
      Effect.runPromise(revokeOwnOAuthGrant(store, auth, { grantId: "oag_123", revokedAt })),
    ).resolves.toEqual({ revoked: true })
    await expect(Effect.runPromise(listOwnOAuthGrants(store, auth))).resolves.toEqual([])
  })

  test("does not revoke an agent actor grant through account management", async () => {
    const revokedAt = new Date("2026-06-02T13:00:00.000Z")
    const store = memoryStore([agentGrant])

    await expect(
      Effect.runPromise(
        Effect.flip(revokeOwnOAuthGrant(store, auth, { grantId: "oag_agent", revokedAt })),
      ),
    ).resolves.toMatchObject({
      _tag: "NotFoundError",
      code: "not_found",
    })
  })

  test("workspace admins list all active grants in their workspace", async () => {
    const otherWorkspaceGrant: UserOAuthGrantDto = {
      ...grant,
      id: "oag_other",
      workspaceId: "wrk_other",
    }
    const store = memoryStore([grant, agentGrant, otherWorkspaceGrant])

    await expect(Effect.runPromise(listWorkspaceOAuthGrants(store, auth))).resolves.toEqual([
      grant,
      agentGrant,
    ])
  })

  test("workspace owners do not manage workspace grants in the self-serve role model", async () => {
    const store = memoryStore([grant, agentGrant])

    await expect(
      Effect.runPromise(
        Effect.flip(
          listWorkspaceOAuthGrants(store, {
            ...auth,
            role: "workspace_owner",
          }),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "ForbiddenError",
      code: "forbidden",
    })
  })

  test("rejects workspace grant management for non-admins", async () => {
    const store = memoryStore([grant])

    await expect(
      Effect.runPromise(
        Effect.flip(
          listWorkspaceOAuthGrants(store, {
            ...auth,
            role: "workspace_member",
          }),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "ForbiddenError",
      code: "forbidden",
    })
  })

  test("workspace admins reduce grant scopes", async () => {
    const store = memoryStore([agentGrant])

    await expect(
      Effect.runPromise(
        updateWorkspaceOAuthGrantScopes(store, auth, {
          grantId: "oag_agent",
          scope: ["contextbase:read", "contextbase:files"],
        }),
      ),
    ).resolves.toMatchObject({
      id: "oag_agent",
      scope: ["contextbase:read", "contextbase:files"],
    })
  })

  test("workspace admins revoke workspace grants", async () => {
    const revokedAt = new Date("2026-06-02T13:00:00.000Z")
    const store = memoryStore([agentGrant])

    await expect(
      Effect.runPromise(
        revokeWorkspaceOAuthGrant(store, auth, { grantId: "oag_agent", revokedAt }),
      ),
    ).resolves.toEqual({ revoked: true })
    await expect(Effect.runPromise(listWorkspaceOAuthGrants(store, auth))).resolves.toEqual([])
  })
})

function memoryStore(initialGrants: UserOAuthGrantDto[]): OAuthGrantManagementStore {
  const grants = initialGrants.map((item) => ({ ...item }))

  return {
    findOAuthGrantForUser: async ({ grantId, userId }) =>
      grants.find(
        (item) =>
          item.id === grantId &&
          item.userId === userId &&
          item.actorKind === "user" &&
          item.actorId === userId,
      ) ?? null,
    findOAuthGrantForWorkspace: async ({ grantId, workspaceId }) =>
      grants.find((item) => item.id === grantId && item.workspaceId === workspaceId) ?? null,
    listOAuthGrantsForUser: async ({ userId }) =>
      grants.filter((item) => item.userId === userId && item.status === "active"),
    listOAuthGrantsForWorkspace: async ({ workspaceId }) =>
      grants.filter((item) => item.workspaceId === workspaceId && item.status === "active"),
    revokeOAuthGrantForUser: async ({ grantId, revokedAt, userId }) => {
      const grant = grants.find(
        (item) =>
          item.id === grantId &&
          item.userId === userId &&
          item.actorKind === "user" &&
          item.actorId === userId,
      )
      if (!grant) return false
      grant.status = "revoked"
      grant.revokedAt = revokedAt
      return true
    },
    revokeOAuthGrantForWorkspace: async ({ grantId, revokedAt, workspaceId }) => {
      const grant = grants.find((item) => item.id === grantId && item.workspaceId === workspaceId)
      if (!grant) return false
      grant.status = "revoked"
      grant.revokedAt = revokedAt
      return true
    },
    updateOAuthGrantScopesForUser: async ({ grantId, scope, userId }) => {
      const grant = grants.find(
        (item) =>
          item.id === grantId &&
          item.userId === userId &&
          item.actorKind === "user" &&
          item.actorId === userId,
      )
      if (!grant) return null
      grant.scope = scope
      grant.updatedAt = new Date("2026-06-02T13:00:00.000Z")
      return grant
    },
    updateOAuthGrantScopesForWorkspace: async ({ grantId, scope, workspaceId }) => {
      const grant = grants.find((item) => item.id === grantId && item.workspaceId === workspaceId)
      if (!grant) return null
      grant.scope = scope
      grant.updatedAt = new Date("2026-06-02T13:00:00.000Z")
      return grant
    },
  }
}
