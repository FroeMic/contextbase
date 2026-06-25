import { createDbClient } from "@contextbase/core/db/client"
import {
  type BrowserSessionContext,
  consumeMagicLink,
  loginWithPassword,
  logoutBrowserSession,
  requestMagicLink as requestMagicLinkEffect,
  switchBrowserSessionWorkspace,
  validateBrowserSession,
} from "@contextbase/core/domains/auth/browser-session"
import { createPostgresBrowserAuthStore } from "@contextbase/core/domains/auth/browser-session-repository"
import { createPostgresFeatureFlagStore } from "@contextbase/core/domains/feature-flags/repository"
import {
  defaultClientFeatureFlagSnapshot,
  type EvaluatedFeatureFlagSnapshot,
  evaluateFeatureFlagsForContext,
} from "@contextbase/core/domains/feature-flags/service"
import { createPostgresInvitationStore } from "@contextbase/core/domains/invitations/repository"
import { acceptWorkspaceInvitation as acceptWorkspaceInvitationEffect } from "@contextbase/core/domains/invitations/service"
import { createPostgresSignupStore } from "@contextbase/core/domains/signup/repository"
import {
  completeSignupOnboarding as completeSignupOnboardingEffect,
  consumeSignupVerification,
  requestSignupVerification as requestSignupVerificationEffect,
} from "@contextbase/core/domains/signup/service"
import { mapAppErrorToHttp } from "@contextbase/core/shared/errors"
import { Effect } from "effect"
import { normalizeOnboardingSlug, type OnboardingSlugKind } from "../client/onboarding-slugs"
import { sendMagicLinkEmail as sendAgentMailMagicLinkEmail } from "./agentmail"
import {
  clearAuthShellCookie,
  clearOnboardingSessionCookie,
  clearSessionCookie,
  readOnboardingSessionCookie,
  readSessionCookies,
  serializeAuthShellCookie,
  serializeOnboardingSessionCookie,
  serializeSessionCookie,
} from "./cookie"
import { isOnboardingSlugAvailable } from "./onboarding-slug-availability"

const MAGIC_LINK_TTL_SECONDS = 15 * 60
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

export type AuthHandlerDependencies = {
  consumeMagicLink?: typeof consumeMagicLinkDependency
  evaluateFeatureFlags?: typeof evaluateFeatureFlagsDependency
  logoutSession?: typeof logoutSessionDependency
  loginWithPassword?: typeof loginWithPasswordDependency
  now?: Date
  requestMagicLink?: typeof requestMagicLinkDependency
  requestSignupVerification?: typeof requestSignupVerificationDependency
  sendMagicLinkEmail?: (message: {
    email: string
    expiresAt: Date
    linkUrl: string
  }) => Promise<void>
  sendSignupVerificationEmail?: (message: {
    email: string
    expiresAt: Date
    linkUrl: string
  }) => Promise<void>
  consumeSignupVerification?: typeof consumeSignupVerificationDependency
  completeSignupOnboarding?: typeof completeSignupOnboardingDependency
  acceptWorkspaceInvitation?: typeof acceptWorkspaceInvitationDependency
  switchWorkspace?: typeof switchWorkspaceDependency
  validateSession?: typeof validateSessionDependency
}

export async function handleMagicLinkRequest(
  request: Request,
  dependencies: AuthHandlerDependencies = {},
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as {
    clientKind?: string
    email?: string
    redirectTo?: string | null
  }

  const result = await (dependencies.requestMagicLink ?? requestMagicLinkDependency)({
    allowedAbsoluteRedirectOrigins: allowedMagicLinkRedirectOrigins(request),
    email: body.email ?? "",
    now: dependencies.now,
    redirectTo: body.redirectTo ?? null,
    ttlSeconds: MAGIC_LINK_TTL_SECONDS,
  })

  if (!result.delivery) {
    return json(
      {
        error: {
          code: "email_not_found",
          details: {},
          message: "Email not found.",
        },
        ok: false,
      },
      { status: 404 },
    )
  }

  const linkUrl = new URL(
    body.clientKind === "desktop" ? "/auth/desktop/verify" : "/auth/verify",
    publicAppOrigin(request),
  )
  linkUrl.searchParams.set("token", result.delivery.rawToken)
  if (result.delivery.redirectTo) {
    linkUrl.searchParams.set("redirect_to", result.delivery.redirectTo)
  }
  await (dependencies.sendMagicLinkEmail ?? sendMagicLinkEmailDependency)({
    email: result.delivery.email,
    expiresAt: result.delivery.expiresAt,
    linkUrl: linkUrl.toString(),
  })

  return json({ ok: true })
}

export async function handleSignupVerificationRequest(
  request: Request,
  dependencies: AuthHandlerDependencies = {},
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string
  }

  const result = await (
    dependencies.requestSignupVerification ?? requestSignupVerificationDependency
  )({
    email: body.email ?? "",
    now: dependencies.now,
    ttlSeconds: MAGIC_LINK_TTL_SECONDS,
  })

  if (result.delivery) {
    const linkUrl = new URL("/auth/signup/verify", publicAppOrigin(request))
    linkUrl.searchParams.set("token", result.delivery.rawToken)
    try {
      await (dependencies.sendSignupVerificationEmail ?? sendSignupVerificationEmailDependency)({
        email: result.delivery.email,
        expiresAt: result.delivery.expiresAt,
        linkUrl: linkUrl.toString(),
      })
    } catch (error) {
      return appErrorJson(error)
    }
  }

  return json({ ok: true })
}

export async function handleSignupVerificationConsume(
  request: Request,
  dependencies: AuthHandlerDependencies = {},
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { token?: string }

  let result: Awaited<ReturnType<typeof consumeSignupVerificationDependency>>
  try {
    result = await (dependencies.consumeSignupVerification ?? consumeSignupVerificationDependency)({
      now: dependencies.now,
      rawToken: body.token ?? "",
      sessionTtlSeconds: SESSION_TTL_SECONDS,
    })
  } catch (error) {
    return appErrorJson(error)
  }

  const headers = new Headers()
  appendOnboardingSessionCookies(
    headers,
    result.rawOnboardingSessionToken,
    result.onboardingSession.expiresAt,
  )

  return json(
    {
      data: {
        onboardingRequired: true,
        onboardingSessionId: result.onboardingSession.onboardingSessionId,
        userId: result.user.id,
      },
      ok: true,
    },
    { headers },
  )
}

export async function handleOnboardingCompleteRequest(
  request: Request,
  dependencies: AuthHandlerDependencies = {},
): Promise<Response> {
  const rawOnboardingSessionToken = readOnboardingSessionCookie(request.headers.get("cookie"))
  if (!rawOnboardingSessionToken) return json({ ok: false }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    profileName?: string
    profileTitle?: string | null
    workspaceName?: string
    workspaceSlug?: string
  }

  let result: Awaited<ReturnType<typeof completeSignupOnboardingDependency>>
  try {
    result = await (dependencies.completeSignupOnboarding ?? completeSignupOnboardingDependency)({
      now: dependencies.now,
      profileName: body.profileName ?? "",
      profileTitle: body.profileTitle ?? null,
      rawOnboardingSessionToken,
      sessionTtlSeconds: SESSION_TTL_SECONDS,
      workspaceName: body.workspaceName ?? "",
      workspaceSlug: body.workspaceSlug ?? "",
    })
  } catch (error) {
    return appErrorJson(error)
  }

  const headers = new Headers()
  appendSessionCookies(headers, result.rawSessionToken, result.session.expiresAt)
  appendClearedOnboardingSessionCookies(headers)

  return json(
    {
      data: {
        activeWorkspaceId: result.session.activeWorkspaceId,
        activeWorkspaceSlug: result.session.activeWorkspaceSlug,
        expiresAt: result.session.expiresAt.toISOString(),
        sessionId: result.session.sessionId,
        userId: result.session.userId,
      },
      ok: true,
    },
    { headers },
  )
}

export async function handleOnboardingSlugAvailabilityRequest(request: Request): Promise<Response> {
  const rawOnboardingSessionToken = readOnboardingSessionCookie(request.headers.get("cookie"))
  if (!rawOnboardingSessionToken) {
    return json(
      {
        error: {
          code: "unauthenticated",
          details: {},
          message: "Invalid browser session",
        },
        ok: false,
      },
      { status: 401 },
    )
  }

  const url = new URL(request.url)
  const kind = url.searchParams.get("kind")
  const slug = normalizeOnboardingSlug(url.searchParams.get("slug") ?? "")
  if (!isOnboardingSlugKind(kind) || !slug) {
    return json(
      {
        error: {
          code: "invalid_request",
          details: {},
          message: "Choose a valid slug.",
        },
        ok: false,
      },
      { status: 400 },
    )
  }

  const client = createDbClient()
  try {
    const available = await isOnboardingSlugAvailable({ db: client.db, kind, slug })
    return json({ data: { available }, ok: true })
  } finally {
    await client.end()
  }
}

export async function handleMagicLinkConsume(
  request: Request,
  dependencies: AuthHandlerDependencies = {},
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { token?: string }

  let result: Awaited<ReturnType<typeof consumeMagicLinkDependency>>
  try {
    result = await (dependencies.consumeMagicLink ?? consumeMagicLinkDependency)({
      now: dependencies.now,
      rawToken: body.token ?? "",
      sessionTtlSeconds: SESSION_TTL_SECONDS,
    })
  } catch (error) {
    return appErrorJson(error)
  }

  const headers = new Headers()
  appendSessionCookies(headers, result.rawSessionToken, result.session.expiresAt)

  return json(
    {
      data: {
        activeWorkspaceId: result.session.activeWorkspaceId,
        activeWorkspaceSlug: result.session.activeWorkspaceSlug,
        expiresAt: result.session.expiresAt.toISOString(),
        sessionId: result.session.sessionId,
        userId: result.session.userId,
      },
      ok: true,
    },
    { headers },
  )
}

export async function handleInvitationAcceptRequest(
  request: Request,
  dependencies: AuthHandlerDependencies = {},
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { token?: string }

  let result: Awaited<ReturnType<typeof acceptWorkspaceInvitationDependency>>
  try {
    result = await (dependencies.acceptWorkspaceInvitation ?? acceptWorkspaceInvitationDependency)({
      now: dependencies.now,
      rawToken: body.token ?? "",
      sessionTtlSeconds: SESSION_TTL_SECONDS,
    })
  } catch (error) {
    return appErrorJson(error)
  }

  const headers = new Headers()
  appendSessionCookies(headers, result.rawSessionToken, result.session.expiresAt)

  return json(
    {
      data: {
        activeWorkspaceId: result.session.activeWorkspaceId,
        activeWorkspaceSlug: result.session.activeWorkspaceSlug,
        expiresAt: result.session.expiresAt.toISOString(),
        sessionId: result.session.sessionId,
        userId: result.session.userId,
      },
      ok: true,
    },
    { headers },
  )
}

export async function handlePasswordLoginRequest(
  request: Request,
  dependencies: AuthHandlerDependencies = {},
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string
    password?: string
  }

  let result: Awaited<ReturnType<typeof loginWithPasswordDependency>>
  try {
    result = await (dependencies.loginWithPassword ?? loginWithPasswordDependency)({
      email: body.email ?? "",
      now: dependencies.now,
      password: body.password ?? "",
      sessionTtlSeconds: SESSION_TTL_SECONDS,
    })
  } catch (error) {
    return appErrorJson(error)
  }

  const headers = new Headers()
  appendSessionCookies(headers, result.rawSessionToken, result.session.expiresAt)

  return json(
    {
      data: {
        activeWorkspaceId: result.session.activeWorkspaceId,
        activeWorkspaceSlug: result.session.activeWorkspaceSlug,
        expiresAt: result.session.expiresAt.toISOString(),
        sessionId: result.session.sessionId,
        userId: result.session.userId,
      },
      ok: true,
    },
    { headers },
  )
}

export async function handleSessionRequest(
  request: Request,
  dependencies: AuthHandlerDependencies = {},
): Promise<Response> {
  const rawSessionTokens = readSessionCookies(request.headers.get("cookie"))
  if (rawSessionTokens.length === 0) return json({ ok: false }, { status: 401 })

  const resolved = await validateFirstSession(rawSessionTokens, dependencies)
  if (!resolved.ok) return appErrorJson(resolved.error)

  const headers = new Headers()
  appendSessionCookies(headers, resolved.rawSessionToken, resolved.session.expiresAt)

  let featureFlags: EvaluatedFeatureFlagSnapshot
  try {
    featureFlags = await (dependencies.evaluateFeatureFlags ?? evaluateFeatureFlagsDependency)(
      resolved.session,
    )
  } catch {
    featureFlags = defaultClientFeatureFlagSnapshot()
  }

  return json(
    {
      data: {
        ...resolved.session,
        featureFlags,
      },
      ok: true,
    },
    { headers },
  )
}

export async function handleWorkspaceSwitchRequest(
  request: Request,
  dependencies: AuthHandlerDependencies = {},
): Promise<Response> {
  const rawSessionTokens = readSessionCookies(request.headers.get("cookie"))
  if (rawSessionTokens.length === 0) return json({ ok: false }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { workspaceId?: string }
  if (!body.workspaceId) {
    return json(
      {
        error: {
          code: "invalid_request",
          details: {},
          message: "workspaceId is required.",
        },
        ok: false,
      },
      { status: 400 },
    )
  }

  try {
    const resolved = await validateFirstSession(rawSessionTokens, dependencies)
    if (!resolved.ok) return appErrorJson(resolved.error)

    const session = await (dependencies.switchWorkspace ?? switchWorkspaceDependency)({
      now: dependencies.now,
      rawSessionToken: resolved.rawSessionToken,
      workspaceId: body.workspaceId,
    })

    return json({
      data: {
        activeWorkspaceId: session.activeWorkspaceId,
        activeWorkspaceSlug: session.activeWorkspaceSlug,
        expiresAt: session.expiresAt.toISOString(),
        sessionId: session.sessionId,
        userId: session.userId,
      },
      ok: true,
    })
  } catch (error) {
    return appErrorJson(error)
  }
}

export async function handleLogoutRequest(
  request: Request,
  dependencies: AuthHandlerDependencies = {},
): Promise<Response> {
  const rawSessionTokens = readSessionCookies(request.headers.get("cookie"))
  for (const rawSessionToken of rawSessionTokens) {
    try {
      await (dependencies.logoutSession ?? logoutSessionDependency)({
        now: dependencies.now,
        rawSessionToken,
      })
    } catch {
      // Keep logout best-effort when a browser sends stale cookies from multiple scopes.
    }
  }

  const headers = new Headers()
  appendClearedSessionCookies(headers)

  return json({ ok: true }, { headers })
}

function appendSessionCookies(headers: Headers, rawSessionToken: string, expiresAt: Date) {
  for (const options of authCookieOptions(expiresAt)) {
    headers.append("set-cookie", serializeSessionCookie(rawSessionToken, options))
    headers.append("set-cookie", serializeAuthShellCookie(options))
  }
}

function appendOnboardingSessionCookies(
  headers: Headers,
  rawSessionToken: string,
  expiresAt: Date,
) {
  for (const options of authCookieOptions(expiresAt)) {
    headers.append("set-cookie", serializeOnboardingSessionCookie(rawSessionToken, options))
    headers.append("set-cookie", serializeAuthShellCookie(options))
  }
}

function appendClearedSessionCookies(headers: Headers) {
  for (const options of authCookieOptions()) {
    headers.append("set-cookie", clearSessionCookie(options))
    headers.append("set-cookie", clearOnboardingSessionCookie(options))
    headers.append("set-cookie", clearAuthShellCookie(options))
  }
}

function appendClearedOnboardingSessionCookies(headers: Headers) {
  for (const options of authCookieOptions()) {
    headers.append("set-cookie", clearOnboardingSessionCookie(options))
  }
}

async function validateFirstSession(
  rawSessionTokens: string[],
  dependencies: AuthHandlerDependencies,
): Promise<
  | {
      ok: true
      rawSessionToken: string
      session: Awaited<ReturnType<typeof validateSessionDependency>>
    }
  | { error: unknown; ok: false }
> {
  let lastError: unknown = null
  for (const rawSessionToken of rawSessionTokens) {
    try {
      const session = await (dependencies.validateSession ?? validateSessionDependency)({
        now: dependencies.now,
        rawSessionToken,
      })
      return { ok: true, rawSessionToken, session }
    } catch (error) {
      lastError = error
      if (!isAuthenticationError(error)) {
        return { error, ok: false }
      }
    }
  }
  return { error: lastError, ok: false }
}

function authCookieOptions(expiresAt?: Date) {
  const secure = isProduction()
  const domain = process.env.AUTH_COOKIE_DOMAIN
  return [{ expiresAt, secure }, ...(domain ? [{ domain, expiresAt, secure }] : [])]
}

async function requestMagicLinkDependency(input: {
  allowedAbsoluteRedirectOrigins?: readonly string[]
  email: string
  now?: Date
  redirectTo?: string | null
  ttlSeconds: number
}) {
  const client = createDbClient()
  try {
    return await Effect.runPromise(
      requestMagicLinkEffect(createPostgresBrowserAuthStore(client), input),
    )
  } finally {
    await client.end()
  }
}

async function requestSignupVerificationDependency(input: {
  email: string
  now?: Date
  ttlSeconds: number
}) {
  const client = createDbClient()
  try {
    return await Effect.runPromise(
      requestSignupVerificationEffect(createPostgresSignupStore(client), input),
    )
  } finally {
    await client.end()
  }
}

async function consumeSignupVerificationDependency(input: {
  now?: Date
  rawToken: string
  sessionTtlSeconds: number
}) {
  const client = createDbClient()
  try {
    return await Effect.runPromise(
      consumeSignupVerification(createPostgresSignupStore(client), input),
    )
  } finally {
    await client.end()
  }
}

async function completeSignupOnboardingDependency(input: {
  now?: Date
  profileName: string
  profileTitle?: string | null
  rawOnboardingSessionToken: string
  sessionTtlSeconds: number
  workspaceName: string
  workspaceSlug: string
}) {
  const client = createDbClient()
  try {
    return await Effect.runPromise(
      completeSignupOnboardingEffect(createPostgresSignupStore(client), input),
    )
  } finally {
    await client.end()
  }
}

function allowedMagicLinkRedirectOrigins(request: Request) {
  return [
    new URL(request.url).origin,
    publicAppOrigin(request),
    process.env.AUTH_PUBLIC_BASE_URL,
    process.env.CONTEXTBASE_AUTH_BASE_URL,
    process.env.VITE_CONTEXTBASE_AUTH_BASE_URL,
    process.env.VITE_AUTH_BASE_URL,
  ].filter((value): value is string => Boolean(value))
}

function publicAppOrigin(request: Request) {
  return (
    process.env.CONTEXTBASE_APP_BASE_URL ??
    process.env.CONTEXTBASE_WEB_BASE_URL ??
    new URL(request.url).origin
  ).replace(/\/+$/, "")
}

function isOnboardingSlugKind(value: string | null): value is OnboardingSlugKind {
  return value === "workspace"
}

async function consumeMagicLinkDependency(input: {
  now?: Date
  rawToken: string
  sessionTtlSeconds: number
}) {
  const client = createDbClient()
  try {
    return await Effect.runPromise(consumeMagicLink(createPostgresBrowserAuthStore(client), input))
  } finally {
    await client.end()
  }
}

async function acceptWorkspaceInvitationDependency(input: {
  now?: Date
  rawToken: string
  sessionTtlSeconds: number
}) {
  const client = createDbClient()
  try {
    return await Effect.runPromise(
      acceptWorkspaceInvitationEffect(createPostgresInvitationStore(client), input),
    )
  } finally {
    await client.end()
  }
}

async function loginWithPasswordDependency(input: {
  email: string
  now?: Date
  password: string
  sessionTtlSeconds: number
}) {
  const client = createDbClient()
  try {
    return await Effect.runPromise(loginWithPassword(createPostgresBrowserAuthStore(client), input))
  } finally {
    await client.end()
  }
}

async function validateSessionDependency(input: { now?: Date; rawSessionToken: string }) {
  const client = createDbClient()
  try {
    return await Effect.runPromise(
      validateBrowserSession(createPostgresBrowserAuthStore(client), input),
    )
  } finally {
    await client.end()
  }
}

async function evaluateFeatureFlagsDependency(
  session: BrowserSessionContext,
): Promise<EvaluatedFeatureFlagSnapshot> {
  const client = createDbClient()
  try {
    return await Effect.runPromise(
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
    )
  } finally {
    await client.end()
  }
}

async function switchWorkspaceDependency(input: {
  now?: Date
  rawSessionToken: string
  workspaceId: string
}) {
  const client = createDbClient()
  try {
    return await Effect.runPromise(
      switchBrowserSessionWorkspace(createPostgresBrowserAuthStore(client), input),
    )
  } finally {
    await client.end()
  }
}

async function logoutSessionDependency(input: { now?: Date; rawSessionToken: string }) {
  const client = createDbClient()
  try {
    return await Effect.runPromise(
      logoutBrowserSession(createPostgresBrowserAuthStore(client), input),
    )
  } finally {
    await client.end()
  }
}

async function sendMagicLinkEmailDependency(message: {
  email: string
  expiresAt: Date
  linkUrl: string
}) {
  const apiKey = process.env.AGENTMAIL_API_KEY
  const inboxId = process.env.AGENTMAIL_INBOX_ID
  if (!apiKey || !inboxId) {
    if (!isProduction()) {
      console.warn(
        "[auth] AgentMail is not configured; use this local magic link:",
        message.linkUrl,
      )
      return
    }

    console.warn("[auth] AgentMail is not configured; magic link email was not sent")
    return
  }

  await sendAgentMailMagicLinkEmail(
    {
      apiKey,
      fromName: process.env.AGENTMAIL_FROM_NAME ?? "Contextbase",
      inboxId,
    },
    message,
  )
}

async function sendSignupVerificationEmailDependency(message: {
  email: string
  expiresAt: Date
  linkUrl: string
}) {
  const apiKey = process.env.AGENTMAIL_API_KEY
  const inboxId = process.env.AGENTMAIL_INBOX_ID
  if (!apiKey || !inboxId) {
    if (!isProduction()) {
      console.warn(
        "[auth] AgentMail is not configured; use this local signup verification link:",
        message.linkUrl,
      )
      return
    }

    console.warn("[auth] AgentMail is not configured; signup verification email was not sent")
    throw new Error("AgentMail is not configured; signup verification email was not sent")
  }

  await sendAgentMailMagicLinkEmail(
    {
      apiKey,
      fromName: process.env.AGENTMAIL_FROM_NAME ?? "Contextbase",
      inboxId,
    },
    message,
  )
}

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set("content-type", "application/json")
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  })
}

function appErrorJson(error: unknown): Response {
  if (typeof error === "object" && error !== null && "_tag" in error) {
    const mapped = mapAppErrorToHttp(error as Parameters<typeof mapAppErrorToHttp>[0])
    return json(mapped.body, { status: mapped.status })
  }

  if (isAuthenticationError(error)) {
    const diagnostic = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    const message = diagnostic.includes("Invalid or expired magic link")
      ? "Invalid or expired magic link"
      : diagnostic.includes("Invalid or expired signup verification link")
        ? "Invalid or expired signup verification link"
        : diagnostic.includes("Invalid or expired workspace invitation")
          ? "Invalid or expired workspace invitation"
          : diagnostic.includes("This account does not have a password yet")
            ? "This account does not have a password yet. Use a magic link, then set a password in security settings."
            : diagnostic.includes("Invalid email or password")
              ? "Invalid email or password."
              : "Invalid browser session"
    return json(
      {
        error: {
          code: "unauthenticated",
          details: {},
          message,
        },
        ok: false,
      },
      { status: 401 },
    )
  }

  return json(
    {
      error: {
        code: "internal_error",
        details: {},
        message: "Unexpected server error.",
      },
      ok: false,
    },
    { status: 500 },
  )
}

function isAuthenticationError(error: unknown) {
  if (typeof error === "object" && error !== null && "_tag" in error) {
    return (error as { _tag?: unknown })._tag === "AuthenticationError"
  }

  const diagnostic = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return diagnostic.includes("AuthenticationError")
}

function isProduction() {
  return process.env.NODE_ENV === "production"
}
