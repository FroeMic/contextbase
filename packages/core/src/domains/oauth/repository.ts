import { and, eq, isNull } from "drizzle-orm"

import type { DbClient } from "../../db/client"
import {
  oauthAccessTokens,
  oauthAuthorizationCodes,
  oauthAuthorizationRequests,
  oauthClients,
  oauthGrants,
  oauthRefreshTokens,
} from "../../db/schema"
import type { OAuthClientRecord, OAuthClientRegistrationRecordInput } from "./clients"
import type { OAuthGrantManagementStore, UserOAuthGrantDto } from "./grants"
import type { OAuthScope } from "./service"

type ActorContext = {
  actorId: string
  actorKind: string
  userId: string
  workspaceId: string
  workspaceSlug: string
}

export type CreateAuthorizationRequestInput = {
  clientId: string
  codeChallenge: string
  codeChallengeMethod: string
  expiresAt: Date
  redirectUri: string
  resource: string
  scope: OAuthScope[]
  state: string
  stateHash: string
}

export type CreateAuthorizationCodeInput = ActorContext & {
  clientId: string
  codeChallengeHash: string
  codeHash: string
  expiresAt: Date
  redirectUri: string
  resource: string
  scope: OAuthScope[]
}

export type CreateGrantInput = ActorContext & {
  clientId: string
  clientName: string
  resource: string
  scope: OAuthScope[]
}

export type CreateAccessTokenInput = ActorContext & {
  expiresAt: Date
  grantId: string
  resource: string
  scope: OAuthScope[]
  tokenHash: string
}

export type CreateRefreshTokenInput = ActorContext & {
  expiresAt: Date
  grantId: string
  parentTokenId?: string | null
  tokenFamilyId: string
  tokenHash: string
}

export type OAuthRepository = OAuthGrantManagementStore & {
  consumeAuthorizationCode: (input: { codeId: string; consumedAt: Date }) => Promise<boolean>
  consumeRefreshToken: (input: { consumedAt: Date; refreshTokenId: string }) => Promise<boolean>
  createAccessToken: (input: CreateAccessTokenInput) => Promise<{ id: string }>
  createAuthorizationCode: (input: CreateAuthorizationCodeInput) => Promise<{ id: string }>
  createAuthorizationRequest: (input: CreateAuthorizationRequestInput) => Promise<{ id: string }>
  createGrant: (input: CreateGrantInput) => Promise<{ id: string }>
  createRefreshToken: (input: CreateRefreshTokenInput) => Promise<{ id: string }>
  findAuthorizationCodeByHash: (codeHash: string) => Promise<OAuthAuthorizationCodeRecord | null>
  findAuthorizationRequestById: (id: string) => Promise<OAuthAuthorizationRequestRecord | null>
  findRefreshTokenByHash: (tokenHash: string) => Promise<OAuthRefreshTokenRecord | null>
  revokeGrantTokens: (input: { grantId: string; revokedAt: Date }) => Promise<void>
  revokeTokenByHash: (input: { revokedAt: Date; tokenHash: string }) => Promise<boolean>
  findClientByClientId: (clientId: string) => Promise<OAuthClientRecord | null>
  registerClient: (input: OAuthClientRegistrationRecordInput) => Promise<{ id: string }>
}

export type OAuthAuthorizationRequestRecord = {
  clientId: string
  codeChallenge: string
  codeChallengeMethod: string
  expiresAt: Date
  id: string
  redirectUri: string
  resource: string
  scope: OAuthScope[]
  state: string
  status: string
}

export type OAuthAuthorizationCodeRecord = ActorContext & {
  clientId: string
  codeChallengeHash: string
  consumedAt: Date | null
  expiresAt: Date
  id: string
  redirectUri: string
  resource: string
  scope: OAuthScope[]
}

export type OAuthRefreshTokenRecord = ActorContext & {
  clientId: string
  consumedAt: Date | null
  expiresAt: Date
  grantId: string
  id: string
  resource: string
  revokedAt: Date | null
  scope: OAuthScope[]
  tokenFamilyId: string
}

export function createPostgresOAuthRepository(client: DbClient): OAuthRepository {
  const revokeGrantTokens = async (input: { grantId: string; revokedAt: Date }) => {
    await client.db
      .update(oauthAccessTokens)
      .set({ revokedAt: input.revokedAt })
      .where(eq(oauthAccessTokens.grantId, input.grantId))
    await client.db
      .update(oauthRefreshTokens)
      .set({ revokedAt: input.revokedAt })
      .where(eq(oauthRefreshTokens.grantId, input.grantId))
  }
  const updateGrantTokenScopes = async (input: { grantId: string; scope: OAuthScope[] }) => {
    const scopeJson = JSON.stringify(input.scope)
    await client.db
      .update(oauthAccessTokens)
      .set({ scopeJson })
      .where(and(eq(oauthAccessTokens.grantId, input.grantId), isNull(oauthAccessTokens.revokedAt)))
  }

  return {
    consumeAuthorizationCode: async (input) => {
      const rows = await client.db
        .update(oauthAuthorizationCodes)
        .set({ consumedAt: input.consumedAt })
        .where(
          and(
            eq(oauthAuthorizationCodes.id, input.codeId),
            isNull(oauthAuthorizationCodes.consumedAt),
          ),
        )
        .returning({ id: oauthAuthorizationCodes.id })
      return rows.length > 0
    },
    consumeRefreshToken: async (input) => {
      const rows = await client.db
        .update(oauthRefreshTokens)
        .set({
          consumedAt: input.consumedAt,
        })
        .where(
          and(
            eq(oauthRefreshTokens.id, input.refreshTokenId),
            isNull(oauthRefreshTokens.consumedAt),
          ),
        )
        .returning({ id: oauthRefreshTokens.id })
      return rows.length > 0
    },
    createAccessToken: async (input) =>
      insertOne(client, oauthAccessTokens, {
        actorId: input.actorId,
        actorKind: input.actorKind,
        expiresAt: input.expiresAt,
        grantId: input.grantId,
        resource: input.resource,
        scopeJson: JSON.stringify(input.scope),
        tokenHash: input.tokenHash,
        userId: input.userId,
        workspaceId: input.workspaceId,
        workspaceSlug: input.workspaceSlug,
      }),
    createAuthorizationCode: async (input) =>
      insertOne(client, oauthAuthorizationCodes, {
        actorId: input.actorId,
        actorKind: input.actorKind,
        clientId: input.clientId,
        codeChallengeHash: input.codeChallengeHash,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
        redirectUri: input.redirectUri,
        resource: input.resource,
        scopeJson: JSON.stringify(input.scope),
        userId: input.userId,
        workspaceId: input.workspaceId,
        workspaceSlug: input.workspaceSlug,
      }),
    createAuthorizationRequest: async (input) =>
      insertOne(client, oauthAuthorizationRequests, {
        clientId: input.clientId,
        codeChallenge: input.codeChallenge,
        codeChallengeMethod: input.codeChallengeMethod,
        expiresAt: input.expiresAt,
        redirectUri: input.redirectUri,
        resource: input.resource,
        scopeJson: JSON.stringify(input.scope),
        state: input.state,
        stateHash: input.stateHash,
      }),
    createGrant: async (input) => {
      const identityConditions = [
        eq(oauthGrants.clientId, input.clientId),
        eq(oauthGrants.resource, input.resource),
        eq(oauthGrants.workspaceId, input.workspaceId),
        eq(oauthGrants.status, "active"),
        isNull(oauthGrants.revokedAt),
        eq(oauthGrants.actorKind, input.actorKind),
        eq(oauthGrants.actorId, input.actorId),
      ]
      if (input.actorKind === "user") {
        identityConditions.splice(3, 0, eq(oauthGrants.userId, input.userId))
      }

      const existingGrant = await client.db.query.oauthGrants.findFirst({
        where: and(...identityConditions),
      })
      if (existingGrant) {
        await client.db
          .update(oauthGrants)
          .set({
            clientName: input.clientName,
            scopeJson: JSON.stringify(input.scope),
            workspaceSlug: input.workspaceSlug,
            updatedAt: new Date(),
          })
          .where(eq(oauthGrants.id, existingGrant.id))
        return { id: existingGrant.id }
      }

      return insertOne(client, oauthGrants, {
        actorId: input.actorId,
        actorKind: input.actorKind,
        clientId: input.clientId,
        clientName: input.clientName,
        resource: input.resource,
        scopeJson: JSON.stringify(input.scope),
        userId: input.userId,
        workspaceId: input.workspaceId,
        workspaceSlug: input.workspaceSlug,
      })
    },
    createRefreshToken: async (input) =>
      insertOne(client, oauthRefreshTokens, {
        actorId: input.actorId,
        actorKind: input.actorKind,
        expiresAt: input.expiresAt,
        grantId: input.grantId,
        parentTokenId: input.parentTokenId ?? null,
        tokenFamilyId: input.tokenFamilyId,
        tokenHash: input.tokenHash,
        userId: input.userId,
        workspaceId: input.workspaceId,
        workspaceSlug: input.workspaceSlug,
      }),
    findClientByClientId: async (clientId) => {
      const row = await client.db.query.oauthClients.findFirst({
        where: and(eq(oauthClients.clientId, clientId), eq(oauthClients.status, "active")),
      })
      return row ? mapOAuthClient(row) : null
    },
    findAuthorizationCodeByHash: async (codeHash) => {
      const row = await client.db.query.oauthAuthorizationCodes.findFirst({
        where: eq(oauthAuthorizationCodes.codeHash, codeHash),
      })
      return row ? mapAuthorizationCode(row) : null
    },
    findAuthorizationRequestById: async (id) => {
      const row = await client.db.query.oauthAuthorizationRequests.findFirst({
        where: eq(oauthAuthorizationRequests.id, id),
      })
      return row ? mapAuthorizationRequest(row) : null
    },
    findOAuthGrantForUser: async (input) => {
      const row = await client.db.query.oauthGrants.findFirst({
        where: and(
          eq(oauthGrants.id, input.grantId),
          eq(oauthGrants.userId, input.userId),
          eq(oauthGrants.actorKind, "user"),
          eq(oauthGrants.actorId, input.userId),
          eq(oauthGrants.status, "active"),
        ),
      })
      return row ? mapOAuthGrant(row) : null
    },
    findOAuthGrantForWorkspace: async (input) => {
      const row = await client.db.query.oauthGrants.findFirst({
        where: and(
          eq(oauthGrants.id, input.grantId),
          eq(oauthGrants.workspaceId, input.workspaceId),
          eq(oauthGrants.status, "active"),
        ),
      })
      return row ? mapOAuthGrant(row) : null
    },
    findRefreshTokenByHash: async (tokenHash) => {
      const row = await client.db.query.oauthRefreshTokens.findFirst({
        where: eq(oauthRefreshTokens.tokenHash, tokenHash),
      })
      if (!row) return null
      const grant = await client.db.query.oauthGrants.findFirst({
        where: eq(oauthGrants.id, row.grantId),
      })
      return mapRefreshToken(row, grant)
    },
    listOAuthGrantsForUser: async (input) => {
      const rows = await client.db.query.oauthGrants.findMany({
        orderBy: (grants, { desc }) => [desc(grants.updatedAt)],
        where: and(
          eq(oauthGrants.userId, input.userId),
          eq(oauthGrants.actorKind, "user"),
          eq(oauthGrants.actorId, input.userId),
          eq(oauthGrants.status, "active"),
        ),
      })
      return rows.map(mapOAuthGrant)
    },
    listOAuthGrantsForWorkspace: async (input) => {
      const rows = await client.db.query.oauthGrants.findMany({
        orderBy: (grants, { desc }) => [desc(grants.updatedAt)],
        where: and(
          eq(oauthGrants.workspaceId, input.workspaceId),
          eq(oauthGrants.status, "active"),
        ),
      })
      return rows.map(mapOAuthGrant)
    },
    revokeOAuthGrantForUser: async (input) => {
      const rows = await client.db
        .update(oauthGrants)
        .set({
          revokedAt: input.revokedAt,
          status: "revoked",
          updatedAt: input.revokedAt,
        })
        .where(
          and(
            eq(oauthGrants.id, input.grantId),
            eq(oauthGrants.userId, input.userId),
            eq(oauthGrants.actorKind, "user"),
            eq(oauthGrants.actorId, input.userId),
            eq(oauthGrants.status, "active"),
          ),
        )
        .returning({ id: oauthGrants.id })
      const grantId = rows[0]?.id
      if (!grantId) return false
      await revokeGrantTokens({ grantId, revokedAt: input.revokedAt })
      return true
    },
    revokeOAuthGrantForWorkspace: async (input) => {
      const rows = await client.db
        .update(oauthGrants)
        .set({
          revokedAt: input.revokedAt,
          status: "revoked",
          updatedAt: input.revokedAt,
        })
        .where(
          and(
            eq(oauthGrants.id, input.grantId),
            eq(oauthGrants.workspaceId, input.workspaceId),
            eq(oauthGrants.status, "active"),
          ),
        )
        .returning({ id: oauthGrants.id })
      const grantId = rows[0]?.id
      if (!grantId) return false
      await revokeGrantTokens({ grantId, revokedAt: input.revokedAt })
      return true
    },
    revokeGrantTokens,
    revokeTokenByHash: async (input) => {
      const accessRows = await client.db
        .update(oauthAccessTokens)
        .set({ revokedAt: input.revokedAt })
        .where(eq(oauthAccessTokens.tokenHash, input.tokenHash))
        .returning({ grantId: oauthAccessTokens.grantId })
      const refreshRows = await client.db
        .update(oauthRefreshTokens)
        .set({ revokedAt: input.revokedAt })
        .where(eq(oauthRefreshTokens.tokenHash, input.tokenHash))
        .returning({ grantId: oauthRefreshTokens.grantId })
      const grantId = accessRows[0]?.grantId ?? refreshRows[0]?.grantId
      if (grantId) await revokeGrantTokens({ grantId, revokedAt: input.revokedAt })
      return Boolean(grantId)
    },
    registerClient: async (input) =>
      insertOne(client, oauthClients, {
        clientId: input.clientId,
        clientName: input.clientName,
        clientSecretExpiresAt: input.clientSecretExpiresAt ?? null,
        clientSecretHash: input.clientSecretHash ?? null,
        clientUri: input.clientUri,
        grantTypesJson: JSON.stringify(input.grantTypes),
        redirectUrisJson: JSON.stringify(input.redirectUris),
        responseTypesJson: JSON.stringify(input.responseTypes),
        scopeJson: JSON.stringify(input.scopes),
        tokenEndpointAuthMethod: input.tokenEndpointAuthMethod,
      }),
    updateOAuthGrantScopesForUser: async (input) => {
      const rows = await client.db
        .update(oauthGrants)
        .set({
          scopeJson: JSON.stringify(input.scope),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(oauthGrants.id, input.grantId),
            eq(oauthGrants.userId, input.userId),
            eq(oauthGrants.actorKind, "user"),
            eq(oauthGrants.actorId, input.userId),
            eq(oauthGrants.status, "active"),
          ),
        )
        .returning()
      const row = rows[0]
      if (row) await updateGrantTokenScopes({ grantId: row.id, scope: input.scope })
      return row ? mapOAuthGrant(row) : null
    },
    updateOAuthGrantScopesForWorkspace: async (input) => {
      const rows = await client.db
        .update(oauthGrants)
        .set({
          scopeJson: JSON.stringify(input.scope),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(oauthGrants.id, input.grantId),
            eq(oauthGrants.workspaceId, input.workspaceId),
            eq(oauthGrants.status, "active"),
          ),
        )
        .returning()
      const row = rows[0]
      if (row) await updateGrantTokenScopes({ grantId: row.id, scope: input.scope })
      return row ? mapOAuthGrant(row) : null
    },
  }
}

function mapOAuthClient(row: {
  clientId: string
  clientName: string
  clientSecretExpiresAt?: Date | null
  clientSecretHash?: string | null
  clientUri: string | null
  grantTypesJson: string
  redirectUrisJson: string
  responseTypesJson: string
  scopeJson: string
  status: string
  tokenEndpointAuthMethod: string
}): OAuthClientRecord {
  return {
    clientId: row.clientId,
    clientName: row.clientName,
    clientSecretExpiresAt: row.clientSecretExpiresAt ?? null,
    clientSecretHash: row.clientSecretHash ?? null,
    clientUri: row.clientUri,
    grantTypes: parseStringArray(row.grantTypesJson),
    redirectUris: parseStringArray(row.redirectUrisJson),
    responseTypes: parseStringArray(row.responseTypesJson),
    scopes: parseScopes(row.scopeJson),
    status: row.status,
    tokenEndpointAuthMethod:
      row.tokenEndpointAuthMethod === "client_secret_post" ? "client_secret_post" : "none",
  }
}

async function insertOne(client: DbClient, table: unknown, value: Record<string, unknown>) {
  const db = client.db as {
    insert: (table: unknown) => {
      values: (value: Record<string, unknown>) => {
        returning: () => Promise<Array<{ id: string }>>
      }
    }
  }
  const [row] = await db.insert(table).values(value).returning()

  if (!row) throw new Error("OAuth repository insert failed")
  return { id: row.id }
}

function mapAuthorizationRequest(row: {
  clientId: string
  codeChallenge: string
  codeChallengeMethod: string
  expiresAt: Date
  id: string
  redirectUri: string
  resource: string
  scopeJson: string
  state: string
  status: string
}): OAuthAuthorizationRequestRecord {
  return {
    clientId: row.clientId,
    codeChallenge: row.codeChallenge,
    codeChallengeMethod: row.codeChallengeMethod,
    expiresAt: row.expiresAt,
    id: row.id,
    redirectUri: row.redirectUri,
    resource: row.resource,
    scope: parseScopes(row.scopeJson),
    state: row.state,
    status: row.status,
  }
}

function mapAuthorizationCode(row: {
  actorId: string
  actorKind: string
  clientId: string
  codeChallengeHash: string
  consumedAt: Date | null
  expiresAt: Date
  id: string
  redirectUri: string
  resource: string
  scopeJson: string
  userId: string
  workspaceId: string
  workspaceSlug: string
}): OAuthAuthorizationCodeRecord {
  return {
    actorId: row.actorId,
    actorKind: row.actorKind,
    clientId: row.clientId,
    codeChallengeHash: row.codeChallengeHash,
    consumedAt: row.consumedAt,
    expiresAt: row.expiresAt,
    id: row.id,
    redirectUri: row.redirectUri,
    resource: row.resource,
    scope: parseScopes(row.scopeJson),
    userId: row.userId,
    workspaceId: row.workspaceId,
    workspaceSlug: row.workspaceSlug,
  }
}

function mapRefreshToken(
  row: {
    actorId: string
    actorKind: string
    consumedAt: Date | null
    expiresAt: Date
    grantId: string
    id: string
    revokedAt: Date | null
    tokenFamilyId: string
    userId: string
    workspaceId: string
    workspaceSlug: string
  },
  grant: { clientId: string; resource: string; scopeJson: string } | undefined,
): OAuthRefreshTokenRecord {
  return {
    actorId: row.actorId,
    actorKind: row.actorKind,
    clientId: grant?.clientId ?? "",
    consumedAt: row.consumedAt,
    expiresAt: row.expiresAt,
    grantId: row.grantId,
    id: row.id,
    resource: grant?.resource ?? "",
    revokedAt: row.revokedAt,
    scope: parseScopes(grant?.scopeJson ?? "[]"),
    tokenFamilyId: row.tokenFamilyId,
    userId: row.userId,
    workspaceId: row.workspaceId,
    workspaceSlug: row.workspaceSlug,
  }
}

function mapOAuthGrant(row: {
  actorId: string
  actorKind: string
  clientId: string
  clientName: string
  createdAt: Date
  id: string
  lastUsedAt: Date | null
  resource: string
  revokedAt: Date | null
  scopeJson: string
  status: string
  updatedAt: Date
  userId: string
  workspaceId: string
  workspaceSlug: string
}): UserOAuthGrantDto {
  return {
    actorId: row.actorId,
    actorKind: row.actorKind,
    clientId: row.clientId,
    clientName: row.clientName,
    createdAt: row.createdAt,
    id: row.id,
    lastUsedAt: row.lastUsedAt,
    resource: row.resource,
    revokedAt: row.revokedAt,
    scope: parseScopes(row.scopeJson),
    status: row.status,
    updatedAt: row.updatedAt,
    userId: row.userId,
    workspaceId: row.workspaceId,
    workspaceSlug: row.workspaceSlug,
  }
}

function parseScopes(scopeJson: string): OAuthScope[] {
  return parseStringArray(scopeJson) as OAuthScope[]
}

function parseStringArray(json: string): string[] {
  try {
    const values = JSON.parse(json) as unknown
    return Array.isArray(values)
      ? values.filter((value): value is string => typeof value === "string")
      : []
  } catch {
    return []
  }
}
