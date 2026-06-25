import { ForbiddenError } from "../../shared/errors"
import type { BrowserSessionContext } from "./browser-session"

export function canAdminBrowserWorkspace(session: BrowserSessionContext) {
  return session.activeWorkspaceRole === "workspace_admin"
}

export function requireBrowserWorkspaceAdminAccess(session: BrowserSessionContext): void {
  if (canAdminBrowserWorkspace(session)) return

  throw new ForbiddenError({
    code: "forbidden",
    details: { workspaceId: session.activeWorkspaceId },
    message: "Workspace admin access is required.",
  })
}
