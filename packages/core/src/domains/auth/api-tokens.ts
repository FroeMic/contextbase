import { randomBytes } from "node:crypto"

import { Effect } from "effect"

import {
  ForbiddenError,
  InternalError,
  InvalidRequestError,
  NotFoundError,
} from "../../shared/errors"
import type { OAuthScope } from "../oauth/service"
import type { AuthenticatedContext } from "./authenticate"
import { canAdministerWorkspace } from "./authorization"
import { hashApiToken } from "./bootstrap"
import { requireWorkspaceAdminAccess } from "./workspace-access"

export type ApiTokenScope = Exclude<OAuthScope, "offline_access">

export type ApiTokenDto = {
  createdAt: Date
  createdByUserId: string | null
  expiresAt: Date | null
  id: string
  label: string
  lastUsedAt: Date | null
  principalId: string
  principalKind: string
  revokedAt: Date | null
  scope: ApiTokenScope[]
  status: string
  updatedAt: Date
  workspaceId: string
  workspaceSlug: string
}

export type ApiTokenManagementStore = {
  createApiToken: (input: {
    createdByUserId: string
    label: string
    principalId: string
    principalKind: "user"
    scope: ApiTokenScope[]
    tokenHash: string
    workspaceId: string
    workspaceSlug: string
  }) => Promise<ApiTokenDto>
  findApiTokenForUserPrincipal: (input: {
    tokenId: string
    userId: string
    workspaceId: string
  }) => Promise<ApiTokenDto | null>
  listApiTokensForUserPrincipal: (input: {
    userId: string
    workspaceId: string
  }) => Promise<ApiTokenDto[]>
  listApiTokensForWorkspaceMembers: (input: { workspaceId: string }) => Promise<ApiTokenDto[]>
  revokeApiTokenForUserPrincipal: (input: {
    revokedAt: Date
    tokenId: string
    userId: string
    workspaceId: string
  }) => Promise<boolean>
  revokeApiTokenForWorkspaceMember: (input: {
    revokedAt: Date
    tokenId: string
    workspaceId: string
  }) => Promise<boolean>
  updateApiTokenForUserPrincipal: (input: {
    label: string
    scope: ApiTokenScope[]
    tokenId: string
    userId: string
    workspaceId: string
  }) => Promise<ApiTokenDto | null>
  updateApiTokenForWorkspaceMember: (input: {
    label: string
    scope: ApiTokenScope[]
    tokenId: string
    workspaceId: string
  }) => Promise<ApiTokenDto | null>
}

type CreatePersonalApiTokenInput = {
  label: string
  randomToken?: () => string
  scope: ApiTokenScope[]
}

export function listPersonalApiTokens(
  store: ApiTokenManagementStore,
  context: AuthenticatedContext,
): Effect.Effect<ApiTokenDto[], InternalError> {
  return Effect.tryPromise({
    try: () =>
      store.listApiTokensForUserPrincipal({
        userId: context.principalId,
        workspaceId: context.workspaceId,
      }),
    catch: toInternalError("Failed to list API tokens"),
  })
}

export function createPersonalApiToken(
  store: ApiTokenManagementStore,
  context: AuthenticatedContext,
  input: CreatePersonalApiTokenInput,
): Effect.Effect<
  { rawToken: string; token: ApiTokenDto },
  ForbiddenError | InternalError | InvalidRequestError
> {
  return Effect.tryPromise({
    try: async () => {
      const scope = normalizeApiTokenScopes(input.scope)
      requireAdminGrantAuthority(context, scope)
      const rawToken = input.randomToken?.() ?? createApiTokenSecret()
      const token = await store.createApiToken({
        createdByUserId: context.principalId,
        label: normalizeLabel(input.label),
        principalId: context.principalId,
        principalKind: "user",
        scope,
        tokenHash: hashApiToken(rawToken),
        workspaceId: context.workspaceId,
        workspaceSlug: context.workspaceSlug,
      })
      return { rawToken, token }
    },
    catch: preserveInvalidOrInternal("Failed to create API token"),
  })
}

export function updatePersonalApiToken(
  store: ApiTokenManagementStore,
  context: AuthenticatedContext,
  input: { label: string; scope: ApiTokenScope[]; tokenId: string },
): Effect.Effect<
  ApiTokenDto,
  ForbiddenError | InternalError | InvalidRequestError | NotFoundError
> {
  return Effect.tryPromise({
    try: async () => {
      const scope = normalizeApiTokenScopes(input.scope)
      requireAdminGrantAuthority(context, scope)
      const updated = await store.updateApiTokenForUserPrincipal({
        label: normalizeLabel(input.label),
        scope,
        tokenId: input.tokenId,
        userId: context.principalId,
        workspaceId: context.workspaceId,
      })
      if (!updated) throw tokenNotFound(input.tokenId)
      return updated
    },
    catch: preserveInvalidNotFoundOrInternal("Failed to update API token"),
  })
}

export function revokePersonalApiToken(
  store: ApiTokenManagementStore,
  context: AuthenticatedContext,
  input: { revokedAt: Date; tokenId: string },
): Effect.Effect<{ revoked: true }, InternalError | NotFoundError> {
  return Effect.tryPromise({
    try: async () => {
      const revoked = await store.revokeApiTokenForUserPrincipal({
        revokedAt: input.revokedAt,
        tokenId: input.tokenId,
        userId: context.principalId,
        workspaceId: context.workspaceId,
      })
      if (!revoked) throw tokenNotFound(input.tokenId)
      return { revoked: true as const }
    },
    catch: preserveNotFoundOrInternal("Failed to revoke API token"),
  })
}

export function listWorkspaceMemberApiTokens(
  store: ApiTokenManagementStore,
  context: AuthenticatedContext,
): Effect.Effect<ApiTokenDto[], ForbiddenError | InternalError> {
  return requireWorkspaceAdmin(context).pipe(
    Effect.flatMap(() =>
      Effect.tryPromise({
        try: () => store.listApiTokensForWorkspaceMembers({ workspaceId: context.workspaceId }),
        catch: toInternalError("Failed to list workspace member API tokens"),
      }),
    ),
  )
}

export function updateWorkspaceMemberApiToken(
  store: ApiTokenManagementStore,
  context: AuthenticatedContext,
  input: { label: string; scope: ApiTokenScope[]; tokenId: string },
): Effect.Effect<
  ApiTokenDto,
  ForbiddenError | InternalError | InvalidRequestError | NotFoundError
> {
  return requireWorkspaceAdmin(context).pipe(
    Effect.flatMap(() =>
      Effect.tryPromise({
        try: async () => {
          const scope = normalizeApiTokenScopes(input.scope)
          const updated = await store.updateApiTokenForWorkspaceMember({
            label: normalizeLabel(input.label),
            scope,
            tokenId: input.tokenId,
            workspaceId: context.workspaceId,
          })
          if (!updated) throw tokenNotFound(input.tokenId)
          return updated
        },
        catch: preserveExpected("Failed to update workspace member API token"),
      }),
    ),
  )
}

export function revokeWorkspaceMemberApiToken(
  store: ApiTokenManagementStore,
  context: AuthenticatedContext,
  input: { revokedAt: Date; tokenId: string },
): Effect.Effect<{ revoked: true }, ForbiddenError | InternalError | NotFoundError> {
  return requireWorkspaceAdmin(context).pipe(
    Effect.flatMap(() =>
      Effect.tryPromise({
        try: async () => {
          const revoked = await store.revokeApiTokenForWorkspaceMember({
            revokedAt: input.revokedAt,
            tokenId: input.tokenId,
            workspaceId: context.workspaceId,
          })
          if (!revoked) throw tokenNotFound(input.tokenId)
          return { revoked: true as const }
        },
        catch: preserveNotFoundOrInternal("Failed to revoke workspace member API token"),
      }),
    ),
  )
}

export function createApiTokenSecret() {
  return `cbt_${randomBytes(32).toString("base64url")}`
}

export function normalizeApiTokenScopes(scopes: ApiTokenScope[]): ApiTokenScope[] {
  const allowed = new Set<ApiTokenScope>([
    "contextbase:read",
    "contextbase:write",
    "contextbase:files",
    "contextbase:manage",
  ])
  const normalized = [...new Set(scopes)]
  const invalid = normalized.find((scope) => !allowed.has(scope))
  if (invalid) {
    throw new InvalidRequestError({
      code: "invalid_request",
      details: { scope: invalid },
      message: "Invalid API token scope",
    })
  }
  return normalized
}

function normalizeLabel(label: string) {
  const normalized = label.trim()
  if (!normalized) {
    throw new InvalidRequestError({
      code: "invalid_request",
      message: "API token name is required",
    })
  }
  return normalized
}

const requireWorkspaceAdmin = requireWorkspaceAdminAccess

function requireAdminGrantAuthority(context: AuthenticatedContext, scope: ApiTokenScope[]) {
  if (!scope.includes("contextbase:manage")) return
  if (canAdministerWorkspace(context)) return

  throw new ForbiddenError({
    code: "forbidden",
    details: { workspaceId: context.workspaceId },
    message: "Workspace admin access is required to issue admin-scoped API tokens.",
  })
}

function tokenNotFound(tokenId: string) {
  return new NotFoundError({
    code: "not_found",
    details: { tokenId },
    message: "API token not found",
  })
}

function preserveExpected(message: string) {
  return (cause: unknown) => {
    if (
      cause instanceof ForbiddenError ||
      cause instanceof InternalError ||
      cause instanceof InvalidRequestError ||
      cause instanceof NotFoundError
    ) {
      return cause
    }
    return new InternalError({ code: "internal_error", details: { cause: String(cause) }, message })
  }
}

function preserveInvalidOrInternal(message: string) {
  return (cause: unknown) => {
    if (
      cause instanceof ForbiddenError ||
      cause instanceof InvalidRequestError ||
      cause instanceof InternalError
    ) {
      return cause
    }
    return new InternalError({ code: "internal_error", details: { cause: String(cause) }, message })
  }
}

function preserveInvalidNotFoundOrInternal(message: string) {
  return (cause: unknown) => {
    if (
      cause instanceof ForbiddenError ||
      cause instanceof InternalError ||
      cause instanceof InvalidRequestError ||
      cause instanceof NotFoundError
    ) {
      return cause
    }
    return new InternalError({ code: "internal_error", details: { cause: String(cause) }, message })
  }
}

function preserveNotFoundOrInternal(message: string) {
  return (cause: unknown) => {
    if (cause instanceof InternalError || cause instanceof NotFoundError) return cause
    return new InternalError({ code: "internal_error", details: { cause: String(cause) }, message })
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
