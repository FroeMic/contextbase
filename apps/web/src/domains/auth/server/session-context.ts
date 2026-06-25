import { createDbClient } from "@contextbase/core/db/client"
import type { AuthenticatedContext } from "@contextbase/core/domains/auth/authenticate"
import type { BrowserSessionContext } from "@contextbase/core/domains/auth/browser-session"
import { validateBrowserSession } from "@contextbase/core/domains/auth/browser-session"
import { createPostgresBrowserAuthStore } from "@contextbase/core/domains/auth/browser-session-repository"
import { AuthenticationError } from "@contextbase/core/shared/errors"
import { Effect } from "effect"

import { readSessionCookies } from "./cookie"

export function contextFromBrowserSession(session: BrowserSessionContext): AuthenticatedContext {
  return {
    principalId: session.userId,
    principalKind: "user",
    role: session.activeWorkspaceRole,
    workspaceId: session.activeWorkspaceId,
    workspaceSlug: session.activeWorkspaceSlug,
  }
}

export async function requireBrowserSession(request: Request): Promise<{
  context: AuthenticatedContext
  session: BrowserSessionContext
}> {
  const rawSessionTokens = readSessionCookies(request.headers.get("cookie"))
  if (rawSessionTokens.length === 0) {
    throw new AuthenticationError({
      code: "unauthenticated",
      message: "Browser session is required.",
    })
  }

  const client = createDbClient()
  try {
    for (const rawSessionToken of rawSessionTokens) {
      try {
        const session = await Effect.runPromise(
          validateBrowserSession(createPostgresBrowserAuthStore(client), { rawSessionToken }),
        )
        return {
          context: contextFromBrowserSession(session),
          session,
        }
      } catch {
        // Try the next cookie when browsers send both prod and staging-scoped sessions.
      }
    }
    throw new AuthenticationError({
      code: "unauthenticated",
      message: "Invalid browser session",
    })
  } finally {
    await client.end()
  }
}
