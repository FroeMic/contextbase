import type { AuthSession } from "./auth-api"
import { isOAuthContinuationRedirect } from "./redirect"

export type AuthEntrySelectorMode = "workspace"

export function selectAuthEntrySelectorMode(
  _session: Pick<AuthSession, "workspaces">,
  redirectTo?: string | null,
): AuthEntrySelectorMode {
  if (redirectTo && isOAuthContinuationRedirect(redirectTo)) return "workspace"
  return "workspace"
}

export function selectLoginSingleWorkspaceRedirect(
  session: Pick<AuthSession, "activeWorkspaceId" | "workspaces">,
): string | null {
  const [workspace] = session.workspaces
  if (!workspace || session.workspaces.length !== 1) return null

  return `/app/${workspace.workspaceSlug}`
}
