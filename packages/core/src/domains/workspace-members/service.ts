import { Effect } from "effect"

import {
  ForbiddenError,
  InternalError,
  InvariantViolationError,
  NotFoundError,
} from "../../shared/errors"
import type { AuthenticatedContext } from "../auth/authenticate"
import { canAdministerWorkspace } from "../auth/authorization"
import type {
  DisableWorkspaceMemberInput,
  ReactivateWorkspaceMemberInput,
  UpdateWorkspaceMemberInput,
  WorkspaceMemberDto,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
} from "./contracts"

export type WorkspaceMemberStore = {
  findWorkspaceMemberById?: (
    context: AuthenticatedContext,
    membershipId: string,
  ) => Promise<WorkspaceMemberDto | null>
  listWorkspaceMembers?: (context: AuthenticatedContext) => Promise<WorkspaceMemberDto[]>
  updateWorkspaceMember?: (
    context: AuthenticatedContext,
    input: {
      membershipId: string
      role?: WorkspaceMemberRole
      status?: WorkspaceMemberStatus
    },
  ) => Promise<WorkspaceMemberDto>
}

export function listWorkspaceMembers(
  store: WorkspaceMemberStore,
  context: AuthenticatedContext,
): Effect.Effect<WorkspaceMemberDto[], ForbiddenError | InternalError> {
  return Effect.tryPromise({
    try: async () => {
      ensureWorkspaceAdmin(context)
      if (!store.listWorkspaceMembers) {
        throw new Error("Workspace member store cannot list members")
      }
      return store.listWorkspaceMembers(context)
    },
    catch: preserveListError("Failed to list workspace members"),
  })
}

export function updateWorkspaceMember(
  store: WorkspaceMemberStore,
  context: AuthenticatedContext,
  input: UpdateWorkspaceMemberInput,
): Effect.Effect<
  WorkspaceMemberDto,
  ForbiddenError | InternalError | InvariantViolationError | NotFoundError
> {
  return updateMember(store, context, input, "workspace_member.updated")
}

export function disableWorkspaceMember(
  store: WorkspaceMemberStore,
  context: AuthenticatedContext,
  input: DisableWorkspaceMemberInput,
): Effect.Effect<
  WorkspaceMemberDto,
  ForbiddenError | InternalError | InvariantViolationError | NotFoundError
> {
  return updateMember(
    store,
    context,
    { membershipId: input.membershipId, status: "disabled" },
    "workspace_member.disabled",
  )
}

export function reactivateWorkspaceMember(
  store: WorkspaceMemberStore,
  context: AuthenticatedContext,
  input: ReactivateWorkspaceMemberInput,
): Effect.Effect<
  WorkspaceMemberDto,
  ForbiddenError | InternalError | InvariantViolationError | NotFoundError
> {
  return updateMember(
    store,
    context,
    { membershipId: input.membershipId, status: "active" },
    "workspace_member.reactivated",
  )
}

function updateMember(
  store: WorkspaceMemberStore,
  context: AuthenticatedContext,
  input: {
    membershipId: string
    role?: WorkspaceMemberRole
    status?: WorkspaceMemberStatus
  },
  _eventType:
    | "workspace_member.disabled"
    | "workspace_member.reactivated"
    | "workspace_member.updated",
): Effect.Effect<
  WorkspaceMemberDto,
  ForbiddenError | InternalError | InvariantViolationError | NotFoundError
> {
  return Effect.tryPromise({
    try: async () => {
      ensureWorkspaceAdmin(context)
      if (!store.findWorkspaceMemberById || !store.updateWorkspaceMember) {
        throw new Error("Workspace member store cannot update members")
      }
      const existing = await store.findWorkspaceMemberById(context, input.membershipId)
      if (!existing) {
        throw new NotFoundError({
          code: "not_found",
          details: {
            membershipId: input.membershipId,
            workspaceId: context.workspaceId,
          },
          message: "Workspace member not found",
        })
      }
      ensureNotRemovingOwnAccess(context, existing, input)

      return store.updateWorkspaceMember(context, input)
    },
    catch: preserveExpectedError("Failed to update workspace member"),
  })
}

function ensureNotRemovingOwnAccess(
  context: AuthenticatedContext,
  existing: WorkspaceMemberDto,
  input: {
    role?: WorkspaceMemberRole
    status?: WorkspaceMemberStatus
  },
) {
  const isCurrentPrincipal =
    existing.principalKind === context.principalKind && existing.principalId === context.principalId
  if (!isCurrentPrincipal) return
  if (input.role !== "workspace_member" && input.status !== "disabled") return

  throw new InvariantViolationError({
    code: "invariant_violation",
    details: {
      membershipId: existing.id,
      principalId: context.principalId,
      workspaceId: context.workspaceId,
    },
    message: "Workspace admins cannot remove their own admin access.",
  })
}

function ensureWorkspaceAdmin(context: AuthenticatedContext) {
  if (canAdministerWorkspace(context)) return
  throw new ForbiddenError({
    code: "forbidden",
    details: { workspaceId: context.workspaceId },
    message: "Workspace admin access is required.",
  })
}

function preserveExpectedError(message: string) {
  return (cause: unknown) => {
    if (
      cause instanceof ForbiddenError ||
      cause instanceof InvariantViolationError ||
      cause instanceof InternalError ||
      cause instanceof NotFoundError
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

function preserveListError(message: string) {
  return (cause: unknown) => {
    if (cause instanceof ForbiddenError || cause instanceof InternalError) {
      return cause
    }
    return new InternalError({
      code: "internal_error",
      details: { cause: String(cause) },
      message,
    })
  }
}
