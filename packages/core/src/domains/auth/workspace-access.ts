import { Effect } from "effect"

import { ForbiddenError } from "../../shared/errors"
import type { AuthenticatedContext } from "./authenticate"
import { canAdministerWorkspace } from "./authorization"

export function hasWorkspaceAdminAccess(context: AuthenticatedContext) {
  return canAdministerWorkspace(context)
}

export function requireWorkspaceAdminAccess(
  context: AuthenticatedContext,
): Effect.Effect<void, ForbiddenError> {
  if (hasWorkspaceAdminAccess(context)) return Effect.void
  return Effect.fail(
    new ForbiddenError({
      code: "forbidden",
      message: "Workspace admin access is required",
    }),
  )
}
