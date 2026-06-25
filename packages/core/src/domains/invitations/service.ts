import { createHash, randomBytes } from "node:crypto"

import { Effect } from "effect"

import {
  AuthenticationError,
  ConflictError,
  ForbiddenError,
  InternalError,
  InvalidRequestError,
  NotFoundError,
} from "../../shared/errors"
import type { AuthenticatedContext } from "../auth/authenticate"
import { canAdministerWorkspace } from "../auth/authorization"

export type WorkspaceInvitationRole = "workspace_admin" | "workspace_member"

export type WorkspaceInvitationInput = {
  email: string
  emailNormalized: string
  expiresAt: Date
  invitedByUserId: string
  role: WorkspaceInvitationRole
  tokenHash: string
  workspaceId: string
  workspaceSlug: string
}

export type WorkspaceInvitationDto = WorkspaceInvitationInput & {
  acceptedAt?: Date | null
  id: string
  revokedAt?: Date | null
  status: string
}

export type InvitationStore = {
  listInvitations?: (context: AuthenticatedContext) => Promise<WorkspaceInvitationDto[]>
  createInvitation?: (
    context: AuthenticatedContext,
    input: WorkspaceInvitationInput,
  ) => Promise<WorkspaceInvitationDto>
  revokeInvitation?: (
    context: AuthenticatedContext,
    input: { invitationId: string; now: Date },
  ) => Promise<WorkspaceInvitationDto>
  acceptInvitationWithSession?: (input: {
    now: Date
    sessionExpiresAt: Date
    sessionTokenHash: string
    tokenHash: string
  }) => Promise<{
    session: {
      activeWorkspaceId: string
      activeWorkspaceSlug: string
      expiresAt: Date
      sessionId: string
      userId: string
    }
    userId: string
    workspaceId: string
    workspaceSlug: string
  }>
}

export function listWorkspaceInvitations(
  store: InvitationStore,
  context: AuthenticatedContext,
): Effect.Effect<WorkspaceInvitationDto[], ForbiddenError | InternalError> {
  return Effect.tryPromise({
    try: async () => {
      ensureWorkspaceAdmin(context)
      if (!store.listInvitations) {
        throw new Error("Invitation store cannot list invitations")
      }

      return store.listInvitations(context)
    },
    catch: preserveAdminError("Failed to list workspace invitations"),
  })
}

export function createWorkspaceInvitation(
  store: InvitationStore,
  context: AuthenticatedContext,
  input: {
    email: string
    role: WorkspaceInvitationRole
  },
  options: {
    now?: Date
    randomToken?: () => string
    ttlSeconds: number
  },
): Effect.Effect<
  {
    delivery: {
      email: string
      expiresAt: Date
      rawToken: string
    }
    invitation: WorkspaceInvitationDto
  },
  ForbiddenError | InternalError | InvalidRequestError
> {
  return Effect.tryPromise({
    try: async () => {
      ensureWorkspaceAdmin(context)
      if (!store.createInvitation) {
        throw new Error("Invitation store cannot create invitations")
      }

      const emailNormalized = normalizeInvitationEmail(input.email)
      if (!isValidInvitationEmail(emailNormalized)) {
        throw new InvalidRequestError({
          code: "invalid_request",
          details: {
            email: input.email,
          },
          message: "Workspace invitation email must be a valid email address.",
        })
      }
      if (!isWorkspaceInvitationRole(input.role)) {
        throw new InvalidRequestError({
          code: "invalid_request",
          details: {
            allowedRoles: ["workspace_admin", "workspace_member"],
            role: input.role,
          },
          message: "Workspace invitation role must be workspace_admin or workspace_member.",
        })
      }

      const now = options.now ?? new Date()
      const rawToken = (options.randomToken ?? createInvitationToken)()
      const invitationInput: WorkspaceInvitationInput = {
        email: emailNormalized,
        emailNormalized,
        expiresAt: new Date(now.getTime() + options.ttlSeconds * 1000),
        invitedByUserId: context.principalId,
        role: input.role,
        tokenHash: hashInvitationToken(rawToken),
        workspaceId: context.workspaceId,
        workspaceSlug: context.workspaceSlug,
      }

      const invitation = await store.createInvitation(context, invitationInput)
      return {
        delivery: {
          email: invitation.email,
          expiresAt: invitation.expiresAt,
          rawToken,
        },
        invitation,
      }
    },
    catch: preserveCreateAdminError("Failed to create workspace invitation"),
  })
}

export function revokeWorkspaceInvitation(
  store: InvitationStore,
  context: AuthenticatedContext,
  input: {
    invitationId: string
    now?: Date
  },
): Effect.Effect<
  WorkspaceInvitationDto,
  ConflictError | ForbiddenError | InternalError | NotFoundError
> {
  return Effect.tryPromise({
    try: async () => {
      ensureWorkspaceAdmin(context)
      if (!store.revokeInvitation) {
        throw new Error("Invitation store cannot revoke invitations")
      }

      return store.revokeInvitation(context, {
        invitationId: input.invitationId,
        now: input.now ?? new Date(),
      })
    },
    catch: preserveRevokeAdminError("Failed to revoke workspace invitation"),
  })
}

export function acceptWorkspaceInvitation(
  store: InvitationStore,
  input: {
    now?: Date
    randomToken?: () => string
    rawToken: string
    sessionTtlSeconds: number
  },
): Effect.Effect<
  {
    rawSessionToken: string
    session: {
      activeWorkspaceId: string
      activeWorkspaceSlug: string
      expiresAt: Date
      sessionId: string
      userId: string
    }
  },
  AuthenticationError | ConflictError | InternalError
> {
  return Effect.tryPromise({
    try: async () => {
      if (!store.acceptInvitationWithSession) {
        throw new Error("Invitation store cannot accept invitations")
      }

      const now = input.now ?? new Date()
      const rawSessionToken = (input.randomToken ?? createInvitationToken)()
      const result = await store.acceptInvitationWithSession({
        now,
        sessionExpiresAt: new Date(now.getTime() + input.sessionTtlSeconds * 1000),
        sessionTokenHash: hashInvitationToken(rawSessionToken),
        tokenHash: hashInvitationToken(input.rawToken),
      })

      return {
        rawSessionToken,
        session: result.session,
      }
    },
    catch: preserveAuthError("Failed to accept workspace invitation"),
  })
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

export function createInvitationToken() {
  return randomBytes(32).toString("base64url")
}

function ensureWorkspaceAdmin(context: AuthenticatedContext) {
  if (canAdministerWorkspace(context)) {
    return
  }

  throw new ForbiddenError({
    code: "forbidden",
    details: {
      workspaceId: context.workspaceId,
    },
    message: "Workspace admin access is required.",
  })
}

function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase()
}

function isValidInvitationEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isWorkspaceInvitationRole(role: unknown): role is WorkspaceInvitationRole {
  return role === "workspace_admin" || role === "workspace_member"
}

function preserveAdminError(message: string) {
  return (cause: unknown) => {
    if (cause instanceof ForbiddenError || cause instanceof InternalError) {
      return cause
    }

    return new InternalError({
      code: "internal_error",
      details: {
        cause: String(cause),
      },
      message,
    })
  }
}

function preserveCreateAdminError(message: string) {
  return (cause: unknown) => {
    if (
      cause instanceof ForbiddenError ||
      cause instanceof InternalError ||
      cause instanceof InvalidRequestError
    ) {
      return cause
    }

    return new InternalError({
      code: "internal_error",
      details: {
        cause: String(cause),
      },
      message,
    })
  }
}

function preserveRevokeAdminError(message: string) {
  return (cause: unknown) => {
    if (
      cause instanceof ConflictError ||
      cause instanceof ForbiddenError ||
      cause instanceof InternalError ||
      cause instanceof NotFoundError
    ) {
      return cause
    }

    return new InternalError({
      code: "internal_error",
      details: {
        cause: String(cause),
      },
      message,
    })
  }
}

function preserveAuthError(message: string) {
  return (cause: unknown) => {
    if (
      cause instanceof AuthenticationError ||
      cause instanceof ConflictError ||
      cause instanceof InternalError
    ) {
      return cause
    }

    return new InternalError({
      code: "internal_error",
      details: {
        cause: String(cause),
      },
      message,
    })
  }
}
