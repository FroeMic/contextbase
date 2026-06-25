import { and, eq } from "drizzle-orm"
import { Effect } from "effect"

import type { DbClient } from "../../db/client"
import { apiTokens, oauthAccessTokens, oauthGrants, workspaceMemberships } from "../../db/schema"
import { AuthenticationError, ForbiddenError } from "../../shared/errors"
import type { OAuthScope } from "../oauth/service"
import { hashOAuthToken } from "../oauth/service"
import { hashApiToken } from "./bootstrap"

export type AuthenticatedContext = {
  authKind?: "api_token" | "oauth_access_token"
  grantId?: string
  principalId: string
  principalKind: string
  resource?: string
  role: string
  scopes?: OAuthScope[]
  workspaceId: string
  workspaceSlug: string
}

export type AuthenticateBearerTokenOptions = {
  allowedOAuthResources?: string[]
  now?: Date
}

/** @deprecated Use AuthenticateBearerTokenOptions. */
export type AuthenticateApiTokenOptions = AuthenticateBearerTokenOptions

export function requireAuthenticatedScope(
  context: AuthenticatedContext,
  requiredScope: OAuthScope,
): ForbiddenError | null {
  if (!context.scopes || context.scopes.includes(requiredScope)) return null
  return new ForbiddenError({
    code: "forbidden",
    details: {
      requiredScope,
      scopes: context.scopes,
    },
    message: `Bearer token is missing required scope ${requiredScope}`,
  })
}

export function extractBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")

  if (!authorization?.startsWith("Bearer ")) {
    return null
  }

  const token = authorization.slice("Bearer ".length).trim()

  return token.length > 0 ? token : null
}

export function authenticateBearerToken(
  client: DbClient,
  token: string,
  options: AuthenticateBearerTokenOptions = {},
): Effect.Effect<AuthenticatedContext, AuthenticationError | ForbiddenError> {
  return Effect.tryPromise({
    try: async () => {
      if (token.startsWith("vca_")) {
        return await authenticateOAuthAccessToken(client, token, options)
      }

      const tokenHash = hashApiToken(token)
      const apiToken = await client.db.query.apiTokens.findFirst({
        where: and(eq(apiTokens.tokenHash, tokenHash), eq(apiTokens.status, "active")),
      })

      if (!apiToken) {
        throw new AuthenticationError({
          code: "unauthenticated",
          message: "Invalid API token",
        })
      }

      const actorAccess = await resolveApiTokenActorAccess(client, apiToken)

      if (!actorAccess) {
        throw new ForbiddenError({
          code: "forbidden",
          details: {
            workspaceId: apiToken.workspaceId,
          },
          message: "API token principal does not have active workspace access",
        })
      }

      await client.db
        .update(apiTokens)
        .set({ lastUsedAt: options.now ?? new Date() })
        .where(eq(apiTokens.id, apiToken.id))

      return {
        authKind: "api_token",
        principalId: apiToken.principalId,
        principalKind: apiToken.principalKind,
        role: actorAccess.role,
        scopes: parseScopes(apiToken.scopeJson),
        workspaceId: apiToken.workspaceId,
        workspaceSlug: apiToken.workspaceSlug,
      }
    },
    catch: (cause) => {
      if (cause instanceof AuthenticationError || cause instanceof ForbiddenError) {
        return cause
      }

      return new AuthenticationError({
        code: "unauthenticated",
        details: {
          cause: String(cause),
        },
        message: "Invalid API token",
      })
    },
  })
}

/** @deprecated Use authenticateBearerToken. */
export const authenticateApiToken = authenticateBearerToken

async function resolveApiTokenActorAccess(
  client: DbClient,
  apiToken: {
    principalId: string
    principalKind: string
    workspaceId: string
  },
) {
  if (apiToken.principalKind === "agent") {
    return null
  }

  const membership = await client.db.query.workspaceMemberships.findFirst({
    where: and(
      eq(workspaceMemberships.workspaceId, apiToken.workspaceId),
      eq(workspaceMemberships.principalKind, apiToken.principalKind),
      eq(workspaceMemberships.principalId, apiToken.principalId),
      eq(workspaceMemberships.status, "active"),
    ),
  })

  return membership ? { role: membership.role } : null
}

async function authenticateOAuthAccessToken(
  client: DbClient,
  token: string,
  options: AuthenticateBearerTokenOptions,
): Promise<AuthenticatedContext> {
  const now = options.now ?? new Date()
  const tokenHash = hashOAuthToken(token)
  const accessToken = await client.db.query.oauthAccessTokens.findFirst({
    where: and(eq(oauthAccessTokens.tokenHash, tokenHash)),
  })

  if (
    !accessToken ||
    accessToken.revokedAt ||
    accessToken.expiresAt.getTime() <= now.getTime() ||
    !allowedOAuthResources(options).includes(accessToken.resource)
  ) {
    throw new AuthenticationError({
      code: "unauthenticated",
      message: "Invalid OAuth access token",
    })
  }

  const grant = await client.db.query.oauthGrants.findFirst({
    where: and(eq(oauthGrants.id, accessToken.grantId), eq(oauthGrants.status, "active")),
  })
  if (!grant || grant.revokedAt || grant.resource !== accessToken.resource) {
    throw new AuthenticationError({
      code: "unauthenticated",
      message: "Invalid OAuth grant",
    })
  }

  const actorAccess = await resolveOAuthActorAccess(client, accessToken)
  if (!actorAccess) {
    throw new ForbiddenError({
      code: "forbidden",
      details: {
        workspaceId: accessToken.workspaceId,
      },
      message: "OAuth token principal does not have active workspace access",
    })
  }

  await client.db
    .update(oauthAccessTokens)
    .set({ lastUsedAt: now })
    .where(eq(oauthAccessTokens.id, accessToken.id))
  await client.db.update(oauthGrants).set({ lastUsedAt: now }).where(eq(oauthGrants.id, grant.id))

  return {
    authKind: "oauth_access_token",
    grantId: accessToken.grantId,
    principalId: accessToken.actorId,
    principalKind: accessToken.actorKind,
    resource: accessToken.resource,
    role: actorAccess.role,
    scopes: parseScopes(accessToken.scopeJson),
    workspaceId: accessToken.workspaceId,
    workspaceSlug: accessToken.workspaceSlug,
  }
}

async function resolveOAuthActorAccess(
  client: DbClient,
  accessToken: {
    actorId: string
    actorKind: string
    workspaceId: string
  },
) {
  if (accessToken.actorKind === "agent") {
    return null
  }

  const membership = await client.db.query.workspaceMemberships.findFirst({
    where: and(
      eq(workspaceMemberships.workspaceId, accessToken.workspaceId),
      eq(workspaceMemberships.principalKind, accessToken.actorKind),
      eq(workspaceMemberships.principalId, accessToken.actorId),
      eq(workspaceMemberships.status, "active"),
    ),
  })

  return membership ? { role: membership.role } : null
}

function allowedOAuthResources(options: AuthenticateBearerTokenOptions) {
  return (
    options.allowedOAuthResources ?? [
      process.env.CONTEXTBASE_API_RESOURCE_URL ?? "http://127.0.0.1:3017/api/v1",
    ]
  )
}

function parseScopes(scopeJson: string): OAuthScope[] {
  try {
    const scopes = JSON.parse(scopeJson) as unknown
    return Array.isArray(scopes)
      ? (scopes.filter((scope) => typeof scope === "string") as OAuthScope[])
      : []
  } catch {
    return []
  }
}
