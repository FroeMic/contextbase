import type { QueryClient } from "@tanstack/react-query"

import type { AuthSession } from "../../domains/auth/client/auth-api"
import { sessionQueryOptions } from "../../domains/auth/client/use-session"

export type SessionWorkspace = AuthSession["workspaces"][number]

export type WorkspaceAuthSession = AuthSession

export type WorkspaceBootstrap = {
  activeWorkspace: SessionWorkspace
  session: WorkspaceAuthSession
  zero: {
    activeWorkspaceId: string
    activeWorkspaceRole: string
    activeWorkspaceSlug: string
    sessionId: string
    storageKey: string
    userId: string
  }
}

export type WorkspaceBootstrapResolution =
  | ({ kind: "active" } & WorkspaceBootstrap)
  | { kind: "switch"; target: SessionWorkspace }
  | { kind: "unavailable" }

export class WorkspaceBootstrapError extends Error {
  reason: Exclude<WorkspaceBootstrapResolution["kind"], "active">
  target?: SessionWorkspace

  constructor(input: {
    reason: Exclude<WorkspaceBootstrapResolution["kind"], "active">
    target?: SessionWorkspace
  }) {
    super(
      input.reason === "switch"
        ? "Workspace route requires a workspace switch."
        : "Workspace route is unavailable.",
    )
    this.name = "WorkspaceBootstrapError"
    this.reason = input.reason
    this.target = input.target
  }
}

export function resolveWorkspaceBootstrap(
  session: AuthSession,
  workspaceSlug: string,
): WorkspaceBootstrapResolution {
  const target =
    session.workspaces.find((workspace) => workspace.workspaceSlug === workspaceSlug) ?? null

  if (!target) {
    return { kind: "unavailable" }
  }

  if (target.workspaceId !== session.activeWorkspaceId) {
    return { kind: "switch", target }
  }

  return {
    activeWorkspace: target,
    kind: "active",
    session: toWorkspaceAuthSession(session),
    zero: {
      activeWorkspaceId: session.activeWorkspaceId,
      activeWorkspaceRole: session.activeWorkspaceRole,
      activeWorkspaceSlug: session.activeWorkspaceSlug,
      sessionId: session.sessionId,
      storageKey: [session.userId, session.sessionId, session.activeWorkspaceId].join(":"),
      userId: session.userId,
    },
  }
}

export function toWorkspaceAuthSession(session: AuthSession): WorkspaceAuthSession {
  return session
}

export async function requireWorkspaceBootstrap({
  queryClient,
  workspaceSlug,
}: {
  queryClient: QueryClient
  workspaceSlug: string
}): Promise<WorkspaceBootstrap> {
  const session = await queryClient.ensureQueryData(sessionQueryOptions())
  const resolution = resolveWorkspaceBootstrap(session, workspaceSlug)

  if (resolution.kind === "active") {
    const { kind: _kind, ...bootstrap } = resolution
    return bootstrap
  }

  throw new WorkspaceBootstrapError({
    reason: resolution.kind,
    target: resolution.kind === "switch" ? resolution.target : undefined,
  })
}
