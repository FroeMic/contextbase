import { Effect } from "effect"
import { ConflictError, ForbiddenError, InternalError, NotFoundError } from "../../shared/errors"
import type { AuthenticatedContext } from "../auth/authenticate"
import { canAdministerWorkspace } from "../auth/authorization"
import type {
  ArchiveWorkspaceInput,
  CreateWorkspaceInput,
  ReactivateWorkspaceInput,
  RenameWorkspaceSlugInput,
  UpdateWorkspaceInput,
  WorkspaceDto,
  WorkspaceStatus,
} from "./contracts"

export type WorkspaceStore = {
  createWorkspace?: (input: CreateWorkspaceInput) => Promise<WorkspaceDto>
  findWorkspaceByIdOrSlug: (idOrSlug: string) => Promise<WorkspaceDto | null>
  listWorkspaces?: (context: AuthenticatedContext) => Promise<WorkspaceDto[]>
  renameWorkspaceSlug?: (input: {
    newSlug: string
    oldSlug: string
    workspaceId: string
  }) => Promise<WorkspaceDto>
  updateWorkspace?: (input: UpdateWorkspaceInput) => Promise<WorkspaceDto>
}

const workspaceStatuses = new Set<WorkspaceStatus>(["active", "archived", "suspended"])

export function listWorkspaces(
  store: WorkspaceStore,
  context: AuthenticatedContext,
): Effect.Effect<WorkspaceDto[], InternalError> {
  return Effect.tryPromise({
    try: async () => {
      if (!store.listWorkspaces) {
        return [
          {
            id: context.workspaceId,
            status: "active",
            workspaceName: context.workspaceSlug,
            workspaceSlug: context.workspaceSlug,
          },
        ]
      }

      return store.listWorkspaces(context)
    },
    catch: toInternalError("Failed to list workspaces"),
  })
}

export function getWorkspace(
  store: WorkspaceStore,
  context: AuthenticatedContext,
  input: { workspaceIdOrSlug: string },
): Effect.Effect<WorkspaceDto, ConflictError | ForbiddenError | InternalError | NotFoundError> {
  return Effect.tryPromise({
    try: async () => {
      const workspace = await store.findWorkspaceByIdOrSlug(input.workspaceIdOrSlug)

      if (!workspace) {
        throw new NotFoundError({
          code: "not_found",
          details: {
            workspaceIdOrSlug: input.workspaceIdOrSlug,
          },
          message: "Workspace not found",
        })
      }

      ensureWorkspaceScope(context, workspace)

      return workspace
    },
    catch: preserveExpectedError("Failed to get workspace"),
  })
}

export function createWorkspace(
  store: WorkspaceStore,
  context: AuthenticatedContext,
  input: CreateWorkspaceInput,
): Effect.Effect<WorkspaceDto, ConflictError | ForbiddenError | InternalError | NotFoundError> {
  return Effect.tryPromise({
    try: async () => {
      ensureWorkspaceAdmin(context)

      const existing = await store.findWorkspaceByIdOrSlug(input.workspaceSlug)

      if (existing) {
        throw new ConflictError({
          code: "conflict",
          details: {
            workspaceSlug: input.workspaceSlug,
          },
          message: "Workspace slug already exists",
        })
      }

      if (!store.createWorkspace) {
        throw new Error("Workspace store cannot create workspaces")
      }

      return store.createWorkspace(input)
    },
    catch: preserveExpectedError("Failed to create workspace"),
  })
}

export function updateWorkspace(
  store: WorkspaceStore,
  context: AuthenticatedContext,
  input: UpdateWorkspaceInput,
): Effect.Effect<WorkspaceDto, ConflictError | ForbiddenError | InternalError | NotFoundError> {
  return Effect.tryPromise({
    try: async () => {
      ensureWorkspaceAdmin(context)

      const existing = await store.findWorkspaceByIdOrSlug(input.workspaceIdOrSlug)

      if (!existing) {
        throw new NotFoundError({
          code: "not_found",
          details: {
            workspaceIdOrSlug: input.workspaceIdOrSlug,
          },
          message: "Workspace not found",
        })
      }

      ensureWorkspaceScope(context, existing)
      const resolved = resolveUpdateWorkspaceInput(input)

      if (!store.updateWorkspace) {
        throw new Error("Workspace store cannot update workspaces")
      }

      return store.updateWorkspace(resolved)
    },
    catch: preserveExpectedError("Failed to update workspace"),
  })
}

export function archiveWorkspace(
  store: WorkspaceStore,
  context: AuthenticatedContext,
  input: ArchiveWorkspaceInput,
): Effect.Effect<WorkspaceDto, ConflictError | ForbiddenError | InternalError | NotFoundError> {
  return updateWorkspaceLifecycle(store, context, {
    status: "archived",
    workspaceIdOrSlug: input.workspaceIdOrSlug,
  })
}

export function reactivateWorkspace(
  store: WorkspaceStore,
  context: AuthenticatedContext,
  input: ReactivateWorkspaceInput,
): Effect.Effect<WorkspaceDto, ConflictError | ForbiddenError | InternalError | NotFoundError> {
  return updateWorkspaceLifecycle(store, context, {
    status: "active",
    workspaceIdOrSlug: input.workspaceIdOrSlug,
  })
}

export function renameWorkspaceSlug(
  store: WorkspaceStore,
  context: AuthenticatedContext,
  input: RenameWorkspaceSlugInput,
): Effect.Effect<WorkspaceDto, ConflictError | ForbiddenError | InternalError | NotFoundError> {
  return Effect.tryPromise({
    try: async () => {
      ensureWorkspaceAdmin(context)

      const workspace = await store.findWorkspaceByIdOrSlug(input.workspaceIdOrSlug)

      if (!workspace) {
        throw new NotFoundError({
          code: "not_found",
          details: {
            workspaceIdOrSlug: input.workspaceIdOrSlug,
          },
          message: "Workspace not found",
        })
      }

      ensureWorkspaceScope(context, workspace)

      const slugOwner = await store.findWorkspaceByIdOrSlug(input.newSlug)

      if (slugOwner && slugOwner.id !== workspace.id) {
        throw new ConflictError({
          code: "conflict",
          details: {
            workspaceSlug: input.newSlug,
          },
          message: "Workspace slug already exists",
        })
      }

      const renameInput = {
        newSlug: input.newSlug,
        oldSlug: workspace.workspaceSlug,
        workspaceId: workspace.id,
      }

      if (!store.renameWorkspaceSlug) {
        throw new Error("Workspace store cannot rename workspace slugs")
      }

      return store.renameWorkspaceSlug(renameInput)
    },
    catch: preserveExpectedError("Failed to rename workspace slug"),
  })
}

function updateWorkspaceLifecycle(
  store: WorkspaceStore,
  context: AuthenticatedContext,
  input: UpdateWorkspaceInput & { status: "active" | "archived" },
): Effect.Effect<WorkspaceDto, ConflictError | ForbiddenError | InternalError | NotFoundError> {
  return Effect.tryPromise({
    try: async () => {
      ensureWorkspaceAdmin(context)

      const existing = await store.findWorkspaceByIdOrSlug(input.workspaceIdOrSlug)

      if (!existing) {
        throw new NotFoundError({
          code: "not_found",
          details: {
            workspaceIdOrSlug: input.workspaceIdOrSlug,
          },
          message: "Workspace not found",
        })
      }

      ensureWorkspaceScope(context, existing)
      const resolved = resolveUpdateWorkspaceInput(input)

      if (!store.updateWorkspace) {
        throw new Error("Workspace store cannot update workspaces")
      }

      return store.updateWorkspace(resolved)
    },
    catch: preserveExpectedError("Failed to update workspace lifecycle"),
  })
}

function resolveUpdateWorkspaceInput(input: UpdateWorkspaceInput): UpdateWorkspaceInput {
  const workspaceName = input.workspaceName?.trim()

  if (input.status && !workspaceStatuses.has(input.status)) {
    throw new ConflictError({
      code: "conflict",
      details: {
        status: input.status,
      },
      message: "Unsupported workspace status",
    })
  }

  return {
    workspaceIdOrSlug: input.workspaceIdOrSlug,
    ...(workspaceName ? { workspaceName } : {}),
    ...(input.status ? { status: input.status } : {}),
  }
}

function preserveExpectedError(message: string) {
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

function ensureWorkspaceScope(context: AuthenticatedContext, workspace: WorkspaceDto) {
  if (workspace.id === context.workspaceId) {
    return
  }

  throw new ForbiddenError({
    code: "forbidden",
    details: {
      requestedWorkspaceId: workspace.id,
      workspaceId: context.workspaceId,
    },
    message: "Workspace is outside the authenticated scope",
  })
}

function ensureWorkspaceAdmin(context: AuthenticatedContext) {
  if (canAdministerWorkspace(context)) {
    return
  }

  throw new ForbiddenError({
    code: "forbidden",
    details: {
      role: context.role,
      workspaceId: context.workspaceId,
    },
    message: "Workspace admin role is required",
  })
}

function toInternalError(message: string) {
  return (cause: unknown) =>
    new InternalError({
      code: "internal_error",
      details: {
        cause: String(cause),
      },
      message,
    })
}
