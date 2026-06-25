import { and, eq } from "drizzle-orm"

import type { DbClient } from "../../db/client"
import { apiTokens } from "../../db/schema"
import type { ApiTokenDto, ApiTokenManagementStore, ApiTokenScope } from "./api-tokens"

export function createPostgresApiTokenManagementStore(client: DbClient): ApiTokenManagementStore {
  return {
    createApiToken: async (input) => {
      const [row] = await client.db
        .insert(apiTokens)
        .values({
          createdByUserId: input.createdByUserId,
          label: input.label,
          principalId: input.principalId,
          principalKind: input.principalKind,
          scopeJson: JSON.stringify(input.scope),
          tokenHash: input.tokenHash,
          workspaceId: input.workspaceId,
          workspaceSlug: input.workspaceSlug,
        })
        .returning()
      if (!row) throw new Error("API token insert failed")
      return mapApiToken(row)
    },
    findApiTokenForUserPrincipal: async (input) => {
      const row = await client.db.query.apiTokens.findFirst({
        where: and(
          eq(apiTokens.id, input.tokenId),
          eq(apiTokens.workspaceId, input.workspaceId),
          eq(apiTokens.principalKind, "user"),
          eq(apiTokens.principalId, input.userId),
          eq(apiTokens.status, "active"),
        ),
      })
      return row ? mapApiToken(row) : null
    },
    listApiTokensForUserPrincipal: async (input) => {
      const rows = await client.db.query.apiTokens.findMany({
        orderBy: (tokens, { desc }) => [desc(tokens.updatedAt)],
        where: and(
          eq(apiTokens.workspaceId, input.workspaceId),
          eq(apiTokens.principalKind, "user"),
          eq(apiTokens.principalId, input.userId),
          eq(apiTokens.status, "active"),
        ),
      })
      return rows.map(mapApiToken)
    },
    listApiTokensForWorkspaceMembers: async (input) => {
      const rows = await client.db.query.apiTokens.findMany({
        orderBy: (tokens, { desc }) => [desc(tokens.updatedAt)],
        where: and(
          eq(apiTokens.workspaceId, input.workspaceId),
          eq(apiTokens.principalKind, "user"),
          eq(apiTokens.status, "active"),
        ),
      })
      return rows.map(mapApiToken)
    },
    revokeApiTokenForUserPrincipal: async (input) => {
      const rows = await client.db
        .update(apiTokens)
        .set({
          revokedAt: input.revokedAt,
          status: "revoked",
          updatedAt: input.revokedAt,
        })
        .where(
          and(
            eq(apiTokens.id, input.tokenId),
            eq(apiTokens.workspaceId, input.workspaceId),
            eq(apiTokens.principalKind, "user"),
            eq(apiTokens.principalId, input.userId),
            eq(apiTokens.status, "active"),
          ),
        )
        .returning({ id: apiTokens.id })
      return rows.length > 0
    },
    revokeApiTokenForWorkspaceMember: async (input) => {
      const rows = await client.db
        .update(apiTokens)
        .set({
          revokedAt: input.revokedAt,
          status: "revoked",
          updatedAt: input.revokedAt,
        })
        .where(
          and(
            eq(apiTokens.id, input.tokenId),
            eq(apiTokens.workspaceId, input.workspaceId),
            eq(apiTokens.principalKind, "user"),
            eq(apiTokens.status, "active"),
          ),
        )
        .returning({ id: apiTokens.id })
      return rows.length > 0
    },
    updateApiTokenForUserPrincipal: async (input) => {
      const rows = await client.db
        .update(apiTokens)
        .set({
          label: input.label,
          scopeJson: JSON.stringify(input.scope),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(apiTokens.id, input.tokenId),
            eq(apiTokens.workspaceId, input.workspaceId),
            eq(apiTokens.principalKind, "user"),
            eq(apiTokens.principalId, input.userId),
            eq(apiTokens.status, "active"),
          ),
        )
        .returning()
      return rows[0] ? mapApiToken(rows[0]) : null
    },
    updateApiTokenForWorkspaceMember: async (input) => {
      const rows = await client.db
        .update(apiTokens)
        .set({
          label: input.label,
          scopeJson: JSON.stringify(input.scope),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(apiTokens.id, input.tokenId),
            eq(apiTokens.workspaceId, input.workspaceId),
            eq(apiTokens.principalKind, "user"),
            eq(apiTokens.status, "active"),
          ),
        )
        .returning()
      return rows[0] ? mapApiToken(rows[0]) : null
    },
  }
}

function mapApiToken(row: {
  createdAt: Date
  createdByUserId: string | null
  expiresAt: Date | null
  id: string
  label: string
  lastUsedAt: Date | null
  principalId: string
  principalKind: string
  revokedAt: Date | null
  scopeJson: string
  status: string
  updatedAt: Date
  workspaceId: string
  workspaceSlug: string
}): ApiTokenDto {
  return {
    createdAt: row.createdAt,
    createdByUserId: row.createdByUserId,
    expiresAt: row.expiresAt,
    id: row.id,
    label: row.label,
    lastUsedAt: row.lastUsedAt,
    principalId: row.principalId,
    principalKind: row.principalKind,
    revokedAt: row.revokedAt,
    scope: parseApiTokenScopes(row.scopeJson),
    status: row.status,
    updatedAt: row.updatedAt,
    workspaceId: row.workspaceId,
    workspaceSlug: row.workspaceSlug,
  }
}

function parseApiTokenScopes(scopeJson: string): ApiTokenScope[] {
  try {
    const scopes = JSON.parse(scopeJson) as unknown
    return Array.isArray(scopes)
      ? (scopes.filter((scope) => typeof scope === "string") as ApiTokenScope[])
      : []
  } catch {
    return []
  }
}
