import { Effect } from "effect"

import {
  type ForbiddenError,
  InternalError,
  InvalidRequestError,
  NotFoundError,
} from "../../shared/errors"
import type { AuthenticatedContext } from "../auth/authenticate"
import { requireWorkspaceAdminAccess } from "../auth/workspace-access"
import type { OAuthScope } from "./service"

export type UserOAuthGrantDto = {
  actorId: string
  actorKind: string
  clientId: string
  clientName: string
  createdAt: Date
  id: string
  lastUsedAt: Date | null
  resource: string
  revokedAt: Date | null
  scope: OAuthScope[]
  status: string
  updatedAt: Date
  userId: string
  workspaceId: string
  workspaceSlug: string
}

export type OAuthGrantManagementStore = {
  findOAuthGrantForUser: (input: {
    grantId: string
    userId: string
  }) => Promise<UserOAuthGrantDto | null>
  findOAuthGrantForWorkspace: (input: {
    grantId: string
    workspaceId: string
  }) => Promise<UserOAuthGrantDto | null>
  listOAuthGrantsForUser: (input: { userId: string }) => Promise<UserOAuthGrantDto[]>
  listOAuthGrantsForWorkspace: (input: { workspaceId: string }) => Promise<UserOAuthGrantDto[]>
  revokeOAuthGrantForUser: (input: {
    grantId: string
    revokedAt: Date
    userId: string
  }) => Promise<boolean>
  revokeOAuthGrantForWorkspace: (input: {
    grantId: string
    revokedAt: Date
    workspaceId: string
  }) => Promise<boolean>
  updateOAuthGrantScopesForUser: (input: {
    grantId: string
    scope: OAuthScope[]
    userId: string
  }) => Promise<UserOAuthGrantDto | null>
  updateOAuthGrantScopesForWorkspace: (input: {
    grantId: string
    scope: OAuthScope[]
    workspaceId: string
  }) => Promise<UserOAuthGrantDto | null>
}

export function listOwnOAuthGrants(
  store: OAuthGrantManagementStore,
  context: AuthenticatedContext,
): Effect.Effect<UserOAuthGrantDto[], InternalError> {
  return Effect.tryPromise({
    try: async () => {
      const grants = await store.listOAuthGrantsForUser({ userId: context.principalId })
      return grants.filter(
        (grant) => grant.actorKind === "user" && grant.actorId === context.principalId,
      )
    },
    catch: toInternalError("Failed to list OAuth grants"),
  })
}

export function updateOwnOAuthGrantScopes(
  store: OAuthGrantManagementStore,
  context: AuthenticatedContext,
  input: { grantId: string; scope: OAuthScope[] },
): Effect.Effect<UserOAuthGrantDto, InternalError | InvalidRequestError | NotFoundError> {
  return Effect.tryPromise({
    try: async () => {
      const grant = await store.findOAuthGrantForUser({
        grantId: input.grantId,
        userId: context.principalId,
      })
      if (!grant) {
        throw new NotFoundError({
          code: "not_found",
          details: { grantId: input.grantId },
          message: "OAuth grant not found",
        })
      }

      const currentScopes = new Set(grant.scope)
      const requestedScopes = [...new Set(input.scope)]
      const expandsGrant = requestedScopes.some((scope) => !currentScopes.has(scope))
      if (expandsGrant) {
        throw new InvalidRequestError({
          code: "invalid_request",
          details: {
            currentScopes: grant.scope,
            requestedScopes,
          },
          message: "OAuth grant scopes can only be reduced in settings",
        })
      }

      const updated = await store.updateOAuthGrantScopesForUser({
        grantId: input.grantId,
        scope: requestedScopes,
        userId: context.principalId,
      })
      if (!updated) {
        throw new NotFoundError({
          code: "not_found",
          details: { grantId: input.grantId },
          message: "OAuth grant not found",
        })
      }

      return updated
    },
    catch: preserveExpectedError("Failed to update OAuth grant scopes"),
  })
}

export function listWorkspaceOAuthGrants(
  store: OAuthGrantManagementStore,
  context: AuthenticatedContext,
): Effect.Effect<UserOAuthGrantDto[], ForbiddenError | InternalError> {
  return requireWorkspaceAdmin(context).pipe(
    Effect.flatMap(() =>
      Effect.tryPromise({
        try: () => store.listOAuthGrantsForWorkspace({ workspaceId: context.workspaceId }),
        catch: toInternalError("Failed to list workspace OAuth grants"),
      }),
    ),
  )
}

export function updateWorkspaceOAuthGrantScopes(
  store: OAuthGrantManagementStore,
  context: AuthenticatedContext,
  input: { grantId: string; scope: OAuthScope[] },
): Effect.Effect<
  UserOAuthGrantDto,
  ForbiddenError | InternalError | InvalidRequestError | NotFoundError
> {
  return requireWorkspaceAdmin(context).pipe(
    Effect.flatMap(() =>
      Effect.tryPromise({
        try: async () => {
          const grant = await store.findOAuthGrantForWorkspace({
            grantId: input.grantId,
            workspaceId: context.workspaceId,
          })
          if (!grant) throw grantNotFound(input.grantId)

          const currentScopes = new Set(grant.scope)
          const requestedScopes = [...new Set(input.scope)]
          const expandsGrant = requestedScopes.some((scope) => !currentScopes.has(scope))
          if (expandsGrant) {
            throw new InvalidRequestError({
              code: "invalid_request",
              details: {
                currentScopes: grant.scope,
                requestedScopes,
              },
              message: "OAuth grant scopes can only be reduced in settings",
            })
          }

          const updated = await store.updateOAuthGrantScopesForWorkspace({
            grantId: input.grantId,
            scope: requestedScopes,
            workspaceId: context.workspaceId,
          })
          if (!updated) throw grantNotFound(input.grantId)
          return updated
        },
        catch: preserveExpectedError("Failed to update workspace OAuth grant scopes"),
      }),
    ),
  )
}

export function revokeWorkspaceOAuthGrant(
  store: OAuthGrantManagementStore,
  context: AuthenticatedContext,
  input: { grantId: string; revokedAt: Date },
): Effect.Effect<{ revoked: true }, ForbiddenError | InternalError | NotFoundError> {
  return requireWorkspaceAdmin(context).pipe(
    Effect.flatMap(() =>
      Effect.tryPromise({
        try: async () => {
          const revoked = await store.revokeOAuthGrantForWorkspace({
            grantId: input.grantId,
            revokedAt: input.revokedAt,
            workspaceId: context.workspaceId,
          })

          if (!revoked) throw grantNotFound(input.grantId)
          return { revoked: true as const }
        },
        catch: preserveNotFoundOrInternal("Failed to revoke workspace OAuth grant"),
      }),
    ),
  )
}

export function revokeOwnOAuthGrant(
  store: OAuthGrantManagementStore,
  context: AuthenticatedContext,
  input: { grantId: string; revokedAt: Date },
): Effect.Effect<{ revoked: true }, InternalError | NotFoundError> {
  return Effect.tryPromise({
    try: async () => {
      const revoked = await store.revokeOAuthGrantForUser({
        grantId: input.grantId,
        revokedAt: input.revokedAt,
        userId: context.principalId,
      })

      if (!revoked) {
        throw grantNotFound(input.grantId)
      }

      return { revoked: true as const }
    },
    catch: preserveNotFoundOrInternal("Failed to revoke OAuth grant"),
  })
}

const requireWorkspaceAdmin = requireWorkspaceAdminAccess

function grantNotFound(grantId: string) {
  return new NotFoundError({
    code: "not_found",
    details: { grantId },
    message: "OAuth grant not found",
  })
}

function preserveExpectedError(message: string) {
  return (cause: unknown) => {
    if (
      cause instanceof InvalidRequestError ||
      cause instanceof NotFoundError ||
      cause instanceof InternalError
    ) {
      return cause
    }

    return new InternalError({
      code: "internal_error",
      details: { cause: String(cause) },
      message,
    })
  }
}

function toInternalError(message: string) {
  return (cause: unknown) =>
    new InternalError({
      code: "internal_error",
      details: { cause: String(cause) },
      message,
    })
}

function preserveNotFoundOrInternal(message: string) {
  return (cause: unknown) => {
    if (cause instanceof NotFoundError || cause instanceof InternalError) {
      return cause
    }

    return new InternalError({
      code: "internal_error",
      details: { cause: String(cause) },
      message,
    })
  }
}
