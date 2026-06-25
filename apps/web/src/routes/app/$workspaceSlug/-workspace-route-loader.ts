import type { QueryClient } from "@tanstack/react-query"

import {
  resolveWorkspaceBootstrap,
  WorkspaceBootstrapError,
} from "../../../app/bootstrap/workspace-bootstrap"
import type { AuthSession } from "../../../domains/auth/client/auth-api"
import { sessionQueryOptions } from "../../../domains/auth/client/use-session"

export async function requireActiveWorkspaceSession({
  queryClient,
  workspaceSlug,
}: {
  queryClient: QueryClient
  workspaceSlug: string
}): Promise<AuthSession> {
  const session = await queryClient.ensureQueryData(sessionQueryOptions())
  const resolution = resolveWorkspaceBootstrap(session, workspaceSlug)

  if (resolution.kind === "active") return session

  throw new WorkspaceBootstrapError({
    reason: resolution.kind,
    target: resolution.kind === "switch" ? resolution.target : undefined,
  })
}
