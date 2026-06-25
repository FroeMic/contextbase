import { createDbClient } from "@contextbase/core/db/client"
import { validateBrowserSession } from "@contextbase/core/domains/auth/browser-session"
import { createPostgresBrowserAuthStore } from "@contextbase/core/domains/auth/browser-session-repository"
import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"
import { Effect } from "effect"

import { readSessionCookies } from "../../auth/server/cookie"

export type LandingSessionState = {
  isSignedIn: boolean
}

export const getLandingSessionState = createServerFn({ method: "GET" }).handler(
  async (): Promise<LandingSessionState> => {
    const request = getRequest()
    const rawSessionTokens = readSessionCookies(request.headers.get("cookie"))
    if (rawSessionTokens.length === 0) return { isSignedIn: false }

    const client = createDbClient()
    try {
      for (const rawSessionToken of rawSessionTokens) {
        try {
          await Effect.runPromise(
            validateBrowserSession(createPostgresBrowserAuthStore(client), { rawSessionToken }),
          )
          return { isSignedIn: true }
        } catch {
          // Try the next cookie when browsers send both prod and staging-scoped sessions.
        }
      }
      return { isSignedIn: false }
    } catch {
      return { isSignedIn: false }
    } finally {
      await client.end()
    }
  },
)
