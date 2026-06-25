import { createDbClient } from "@contextbase/core/db/client"
import { onboardingSessions, users } from "@contextbase/core/db/schema"
import {
  type BrowserSessionContext,
  validateBrowserSession,
} from "@contextbase/core/domains/auth/browser-session"
import { createPostgresBrowserAuthStore } from "@contextbase/core/domains/auth/browser-session-repository"
import { createPostgresFeatureFlagStore } from "@contextbase/core/domains/feature-flags/repository"
import {
  defaultClientFeatureFlagSnapshot,
  type EvaluatedFeatureFlagSnapshot,
  evaluateFeatureFlagsForContext,
} from "@contextbase/core/domains/feature-flags/service"
import { hashSignupToken } from "@contextbase/core/domains/signup/service"
import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"
import { and, eq, gt, isNull } from "drizzle-orm"
import { Effect } from "effect"
import { serializeFeatureFlagSnapshot } from "../../feature-flags/client/feature-flag-snapshot"
import type { AuthSession } from "../client/auth-api"
import { readOnboardingSessionCookie, readSessionCookies } from "./cookie"
import { resolveAvailableOnboardingSlug } from "./onboarding-slug-availability"

export type LoginSessionState = {
  session: AuthSession | null
}

export type CreateSessionState = {
  generatedWorkspaceSlug: string
  onboardingEmail: string | null
  onboardingRequired: boolean
  session: AuthSession | null
}

type ResolveLoginSessionStateDependencies = {
  evaluateFeatureFlags: (session: BrowserSessionContext) => Promise<EvaluatedFeatureFlagSnapshot>
  rawSessionTokens: string[]
  validateSession: (input: { rawSessionToken: string }) => Promise<BrowserSessionContext>
}

export const getLoginSessionState = createServerFn({ method: "GET" }).handler(
  async (): Promise<LoginSessionState> => {
    const request = getRequest()
    return resolveLoginSessionStateFromCookies(request.headers.get("cookie"))
  },
)

export const getCreateSessionState = createServerFn({ method: "GET" }).handler(
  async (): Promise<CreateSessionState> => {
    const request = getRequest()
    const cookieHeader = request.headers.get("cookie")
    const loginState = await resolveLoginSessionStateFromCookies(cookieHeader)
    const onboardingToken = readOnboardingSessionCookie(cookieHeader)
    const onboardingEmail = onboardingToken
      ? await resolveOnboardingEmailFromToken(onboardingToken)
      : null

    const generatedSlugs = onboardingToken
      ? await resolveCreateGeneratedSlugs()
      : {
          generatedWorkspaceSlug: "",
        }

    return resolveCreateSessionState({
      ...generatedSlugs,
      cookieHeader,
      loginState,
      onboardingEmail,
    })
  },
)

async function resolveLoginSessionStateFromCookies(
  cookieHeader: string | null,
): Promise<LoginSessionState> {
  const rawSessionTokens = readSessionCookies(cookieHeader)
  if (rawSessionTokens.length === 0) return { session: null }

  const client = createDbClient()
  try {
    return await resolveLoginSessionState({
      evaluateFeatureFlags: (session) =>
        Effect.runPromise(
          evaluateFeatureFlagsForContext(createPostgresFeatureFlagStore(client), {
            user: {
              email: session.email,
              emailNormalized: session.email.trim().toLowerCase(),
              id: session.userId,
            },
            workspace: {
              id: session.activeWorkspaceId,
              role: session.activeWorkspaceRole,
              slug: session.activeWorkspaceSlug,
            },
          }),
        ),
      rawSessionTokens,
      validateSession: ({ rawSessionToken }) =>
        Effect.runPromise(
          validateBrowserSession(createPostgresBrowserAuthStore(client), { rawSessionToken }),
        ),
    })
  } catch {
    return { session: null }
  } finally {
    await client.end()
  }
}

export function resolveCreateSessionState(input: {
  cookieHeader: string | null
  generatedWorkspaceSlug?: string
  onboardingEmail?: string | null
  loginState: LoginSessionState
}): CreateSessionState {
  return {
    generatedWorkspaceSlug: input.generatedWorkspaceSlug ?? "",
    onboardingEmail: input.onboardingEmail ?? null,
    onboardingRequired: Boolean(readOnboardingSessionCookie(input.cookieHeader)),
    session: input.loginState.session,
  }
}

async function resolveCreateGeneratedSlugs() {
  const client = createDbClient()
  try {
    const generatedWorkspaceSlug = await resolveAvailableOnboardingSlug({
      db: client.db,
      kind: "workspace",
    })
    return { generatedWorkspaceSlug }
  } catch {
    return {
      generatedWorkspaceSlug: "",
    }
  } finally {
    await client.end()
  }
}

async function resolveOnboardingEmailFromToken(rawOnboardingSessionToken: string) {
  const client = createDbClient()
  try {
    const now = new Date()
    const sessionTokenHash = hashSignupToken(rawOnboardingSessionToken)
    const row = await client.db
      .select({
        email: users.email,
      })
      .from(onboardingSessions)
      .innerJoin(users, eq(users.id, onboardingSessions.userId))
      .where(
        and(
          eq(onboardingSessions.sessionTokenHash, sessionTokenHash),
          eq(onboardingSessions.status, "active"),
          gt(onboardingSessions.expiresAt, now),
          isNull(onboardingSessions.completedAt),
          isNull(onboardingSessions.revokedAt),
        ),
      )
      .limit(1)

    return row[0]?.email ?? null
  } catch {
    return null
  } finally {
    await client.end()
  }
}

export async function resolveLoginSessionState({
  evaluateFeatureFlags,
  rawSessionTokens,
  validateSession,
}: ResolveLoginSessionStateDependencies): Promise<LoginSessionState> {
  let session: BrowserSessionContext | null = null
  for (const rawSessionToken of rawSessionTokens) {
    try {
      session = await validateSession({ rawSessionToken })
      break
    } catch {
      // Try the next cookie when browsers send both prod and staging-scoped sessions.
    }
  }
  if (!session) return { session: null }

  let featureFlags: EvaluatedFeatureFlagSnapshot
  try {
    featureFlags = await evaluateFeatureFlags(session)
  } catch {
    featureFlags = defaultClientFeatureFlagSnapshot()
  }

  return {
    session: {
      ...session,
      expiresAt:
        session.expiresAt instanceof Date
          ? session.expiresAt.toISOString()
          : String(session.expiresAt),
      featureFlags: serializeFeatureFlagSnapshot(featureFlags),
    },
  }
}
