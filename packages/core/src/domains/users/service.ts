import { Effect } from "effect"

import { ForbiddenError, InternalError, NotFoundError } from "../../shared/errors"
import type { AuthenticatedContext } from "../auth/authenticate"
import { canAdministerWorkspace } from "../auth/authorization"
import type {
  CreateUserInput,
  UpdateOwnUserProfileInput,
  UpdateUserInput,
  UserDto,
} from "./contracts"

export type UserStore = {
  createUserWithMembership?: (
    context: AuthenticatedContext,
    input: CreateUserInput,
  ) => Promise<UserDto>
  findUserByIdInWorkspace: (
    context: AuthenticatedContext,
    userId: string,
  ) => Promise<UserDto | null>
  listUsers?: (context: AuthenticatedContext) => Promise<UserDto[]>
  updateUser?: (context: AuthenticatedContext, input: UpdateUserInput) => Promise<UserDto>
}

export function listUsers(
  store: UserStore,
  context: AuthenticatedContext,
): Effect.Effect<UserDto[], InternalError> {
  return Effect.tryPromise({
    try: async () => store.listUsers?.(context) ?? [],
    catch: toInternalError("Failed to list users"),
  })
}

export function getUser(
  store: UserStore,
  context: AuthenticatedContext,
  input: { userId: string },
): Effect.Effect<UserDto, ForbiddenError | InternalError | NotFoundError> {
  return Effect.tryPromise({
    try: async () => findUserOrThrow(store, context, input.userId),
    catch: preserveExpectedError("Failed to get user"),
  })
}

export function createUser(
  store: UserStore,
  context: AuthenticatedContext,
  input: CreateUserInput,
): Effect.Effect<UserDto, ForbiddenError | InternalError | NotFoundError> {
  return Effect.tryPromise({
    try: async () => {
      ensureWorkspaceAdmin(context)

      if (!store.createUserWithMembership) {
        throw new Error("User store cannot create users")
      }

      return store.createUserWithMembership(context, input)
    },
    catch: preserveExpectedError("Failed to create user"),
  })
}

export function normalizeUserEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase()
  return normalized ? normalized : null
}

export function updateUser(
  store: UserStore,
  context: AuthenticatedContext,
  input: UpdateUserInput,
): Effect.Effect<UserDto, ForbiddenError | InternalError | NotFoundError> {
  return Effect.tryPromise({
    try: async () => {
      ensureWorkspaceAdmin(context)
      await findUserOrThrow(store, context, input.userId)

      if (!store.updateUser) {
        throw new Error("User store cannot update users")
      }

      return store.updateUser(context, input)
    },
    catch: preserveExpectedError("Failed to update user"),
  })
}

export function updateOwnUserProfile(
  store: UserStore,
  context: AuthenticatedContext,
  input: UpdateOwnUserProfileInput,
): Effect.Effect<UserDto, ForbiddenError | InternalError | NotFoundError> {
  return Effect.tryPromise({
    try: async () => {
      ensureUserPrincipal(context)
      await findUserOrThrow(store, context, context.principalId)

      const updateInput: UpdateUserInput = {
        displayName: input.displayName,
        userId: context.principalId,
      }

      if (!store.updateUser) {
        throw new Error("User store cannot update users")
      }

      return store.updateUser(context, updateInput)
    },
    catch: preserveExpectedError("Failed to update user profile"),
  })
}

async function findUserOrThrow(store: UserStore, context: AuthenticatedContext, userId: string) {
  const user = await store.findUserByIdInWorkspace(context, userId)

  if (!user) {
    throw new NotFoundError({
      code: "not_found",
      details: {
        userId,
        workspaceId: context.workspaceId,
      },
      message: "User not found in workspace",
    })
  }

  return user
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

function ensureUserPrincipal(context: AuthenticatedContext) {
  if (context.principalKind === "user") {
    return
  }

  throw new ForbiddenError({
    code: "forbidden",
    details: {
      principalKind: context.principalKind,
      workspaceId: context.workspaceId,
    },
    message: "User principal is required",
  })
}

function preserveExpectedError(message: string) {
  return (cause: unknown) => {
    if (
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
