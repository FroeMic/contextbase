import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

import { Effect } from "effect"

import { AuthenticationError, ForbiddenError, InternalError } from "../../shared/errors"

export type LoginWorkspace = {
  role: string
  workspaceId: string
  workspaceSlug: string
}

export type LoginUser = {
  email: string
  emailNormalized: string
  passwordHash?: string | null
  userId: string
  workspaces: LoginWorkspace[]
}

export type MagicLinkInsert = {
  emailNormalized: string
  expiresAt: Date
  redirectTo: string | null
  tokenHash: string
  userId: string
  workspaceId: string
  workspaceSlug: string
}

export type BrowserSessionRecord = {
  activeWorkspaceId: string
  activeWorkspaceSlug: string
  expiresAt: Date
  sessionId: string
  userId: string
}

export type BrowserSessionContext = {
  activeWorkspaceId: string
  activeWorkspaceRole: string
  activeWorkspaceSlug: string
  email: string
  expiresAt: Date
  sessionId: string
  userId: string
  workspaces: LoginWorkspace[]
}

export type BrowserSessionSummary = {
  createdAt: Date
  current: boolean
  expiresAt: Date
  id: string
  ipAddress: string | null
  lastSeenAt: Date | null
  userAgent: string | null
}

export type BrowserAuthStore = {
  consumeMagicLinkForSession?: (input: {
    now: Date
    sessionExpiresAt: Date
    sessionTokenHash: string
    tokenHash: string
  }) => Promise<BrowserSessionRecord>
  createPasswordBrowserSession?: (input: {
    now: Date
    sessionExpiresAt: Date
    sessionTokenHash: string
    userId: string
    workspaceId: string
    workspaceSlug: string
  }) => Promise<BrowserSessionRecord>
  findLoginUserByEmail?: (emailNormalized: string) => Promise<LoginUser | null>
  findSessionByTokenHash?: (sessionTokenHash: string) => Promise<BrowserSessionContext | null>
  findUserPasswordHash?: (userId: string) => Promise<string | null>
  insertMagicLink?: (input: MagicLinkInsert) => Promise<void>
  listActiveSessionsByUserId?: (userId: string) => Promise<Omit<BrowserSessionSummary, "current">[]>
  revokeSessionByTokenHash?: (sessionTokenHash: string, now: Date) => Promise<void>
  revokeOtherSessionsByUserId?: (input: {
    currentSessionId: string
    now: Date
    userId: string
  }) => Promise<number>
  revokeOtherSessionByIdForUser?: (input: {
    currentSessionId: string
    now: Date
    sessionId: string
    userId: string
  }) => Promise<boolean>
  switchSessionWorkspaceByTokenHash?: (input: {
    now: Date
    sessionTokenHash: string
    workspaceId: string
  }) => Promise<BrowserSessionRecord>
  updateUserPasswordHash?: (userId: string, passwordHash: string) => Promise<void>
}

export type MagicLinkRequestInput = {
  allowedAbsoluteRedirectOrigins?: readonly string[]
  email: string
  now?: Date
  randomToken?: () => string
  redirectTo?: string | null
  ttlSeconds: number
}

export type MagicLinkRequestResult = {
  accepted: true
  delivery: {
    email: string
    expiresAt: Date
    rawToken: string
    redirectTo: string | null
    userId: string
    workspaceId: string
    workspaceSlug: string
  } | null
}

export function requestMagicLink(
  store: BrowserAuthStore,
  input: MagicLinkRequestInput,
): Effect.Effect<MagicLinkRequestResult, InternalError> {
  return Effect.tryPromise({
    try: async () => {
      const emailNormalized = normalizeAuthEmail(input.email)
      if (!emailNormalized) {
        return { accepted: true, delivery: null }
      }

      const loginUser = (await store.findLoginUserByEmail?.(emailNormalized)) ?? null
      const workspace = loginUser?.workspaces[0] ?? null

      if (!loginUser || !workspace) {
        return { accepted: true, delivery: null }
      }

      if (!store.insertMagicLink) {
        throw new Error("Browser auth store cannot insert magic links")
      }

      const now = input.now ?? new Date()
      const rawToken = (input.randomToken ?? createBrowserToken)()
      const expiresAt = new Date(now.getTime() + input.ttlSeconds * 1000)
      const redirectTo = sanitizeRedirectTo(input.redirectTo, input.allowedAbsoluteRedirectOrigins)

      await store.insertMagicLink({
        emailNormalized,
        expiresAt,
        redirectTo,
        tokenHash: hashBrowserToken(rawToken),
        userId: loginUser.userId,
        workspaceId: workspace.workspaceId,
        workspaceSlug: workspace.workspaceSlug,
      })

      return {
        accepted: true,
        delivery: {
          email: loginUser.email,
          expiresAt,
          rawToken,
          redirectTo,
          userId: loginUser.userId,
          workspaceId: workspace.workspaceId,
          workspaceSlug: workspace.workspaceSlug,
        },
      }
    },
    catch: toInternalError("Failed to request magic link"),
  })
}

export type ConsumeMagicLinkInput = {
  now?: Date
  randomToken?: () => string
  rawToken: string
  sessionTtlSeconds: number
}

export function consumeMagicLink(
  store: BrowserAuthStore,
  input: ConsumeMagicLinkInput,
): Effect.Effect<
  { rawSessionToken: string; session: BrowserSessionRecord },
  AuthenticationError | InternalError
> {
  return Effect.tryPromise({
    try: async () => {
      if (!store.consumeMagicLinkForSession) {
        throw new Error("Browser auth store cannot consume magic links")
      }

      const now = input.now ?? new Date()
      const rawSessionToken = (input.randomToken ?? createBrowserToken)()
      const session = await store.consumeMagicLinkForSession({
        now,
        sessionExpiresAt: new Date(now.getTime() + input.sessionTtlSeconds * 1000),
        sessionTokenHash: hashBrowserToken(rawSessionToken),
        tokenHash: hashBrowserToken(input.rawToken),
      })

      return {
        rawSessionToken,
        session,
      }
    },
    catch: preserveAuthError("Failed to consume magic link"),
  })
}

export type PasswordLoginInput = {
  email: string
  now?: Date
  password: string
  randomToken?: () => string
  sessionTtlSeconds: number
}

export function loginWithPassword(
  store: BrowserAuthStore,
  input: PasswordLoginInput,
): Effect.Effect<
  { rawSessionToken: string; session: BrowserSessionRecord },
  AuthenticationError | InternalError
> {
  return Effect.tryPromise({
    try: async () => {
      if (!store.createPasswordBrowserSession) {
        throw new Error("Browser auth store cannot create password sessions")
      }

      const emailNormalized = normalizeAuthEmail(input.email)
      if (!emailNormalized) {
        throw invalidPasswordLoginError()
      }

      const loginUser = (await store.findLoginUserByEmail?.(emailNormalized)) ?? null
      const workspace = loginUser?.workspaces[0] ?? null
      if (!loginUser || !workspace) {
        throw invalidPasswordLoginError()
      }

      if (!loginUser.passwordHash) {
        throw new AuthenticationError({
          code: "unauthenticated",
          message:
            "This account does not have a password yet. Use a magic link, then set a password in security settings.",
        })
      }

      if (!verifyPasswordHash(input.password, loginUser.passwordHash)) {
        throw invalidPasswordLoginError()
      }

      const now = input.now ?? new Date()
      const rawSessionToken = (input.randomToken ?? createBrowserToken)()
      const session = await store.createPasswordBrowserSession({
        now,
        sessionExpiresAt: new Date(now.getTime() + input.sessionTtlSeconds * 1000),
        sessionTokenHash: hashBrowserToken(rawSessionToken),
        userId: loginUser.userId,
        workspaceId: workspace.workspaceId,
        workspaceSlug: workspace.workspaceSlug,
      })

      return {
        rawSessionToken,
        session,
      }
    },
    catch: preserveAuthError("Failed to login with password"),
  })
}

export function validateBrowserSession(
  store: BrowserAuthStore,
  input: { now?: Date; rawSessionToken: string },
): Effect.Effect<BrowserSessionContext, AuthenticationError | InternalError> {
  return Effect.tryPromise({
    try: async () => {
      const session =
        (await store.findSessionByTokenHash?.(hashBrowserToken(input.rawSessionToken))) ?? null

      if (!session) {
        throw new AuthenticationError({
          code: "unauthenticated",
          message: "Invalid browser session",
        })
      }

      const now = input.now ?? new Date()
      if (session.expiresAt.getTime() <= now.getTime()) {
        throw new AuthenticationError({
          code: "unauthenticated",
          message: "Browser session expired",
        })
      }

      return session
    },
    catch: preserveAuthError("Failed to validate browser session"),
  })
}

export function logoutBrowserSession(
  store: BrowserAuthStore,
  input: { now?: Date; rawSessionToken: string },
): Effect.Effect<void, InternalError> {
  return Effect.tryPromise({
    try: async () => {
      await store.revokeSessionByTokenHash?.(
        hashBrowserToken(input.rawSessionToken),
        input.now ?? new Date(),
      )
    },
    catch: toInternalError("Failed to logout browser session"),
  })
}

export function switchBrowserSessionWorkspace(
  store: BrowserAuthStore,
  input: { now?: Date; rawSessionToken: string; workspaceId: string },
): Effect.Effect<BrowserSessionRecord, AuthenticationError | ForbiddenError | InternalError> {
  return Effect.tryPromise({
    try: async () => {
      if (!store.switchSessionWorkspaceByTokenHash) {
        throw new Error("Browser auth store cannot switch workspaces")
      }

      return store.switchSessionWorkspaceByTokenHash({
        now: input.now ?? new Date(),
        sessionTokenHash: hashBrowserToken(input.rawSessionToken),
        workspaceId: input.workspaceId,
      })
    },
    catch: preserveAuthOrForbiddenError("Failed to switch browser session workspace"),
  })
}

export function listActiveBrowserSessions(
  store: BrowserAuthStore,
  input: { currentSessionId: string; userId: string },
): Effect.Effect<BrowserSessionSummary[], InternalError> {
  return Effect.tryPromise({
    try: async () => {
      const sessions = await store.listActiveSessionsByUserId?.(input.userId)
      return (sessions ?? []).map((session) => ({
        ...session,
        current: session.id === input.currentSessionId,
      }))
    },
    catch: toInternalError("Failed to list browser sessions"),
  })
}

export function revokeOtherBrowserSessions(
  store: BrowserAuthStore,
  input: { currentSessionId: string; now?: Date; userId: string },
): Effect.Effect<{ revokedCount: number }, InternalError> {
  return Effect.tryPromise({
    try: async () => {
      const revokedCount =
        (await store.revokeOtherSessionsByUserId?.({
          currentSessionId: input.currentSessionId,
          now: input.now ?? new Date(),
          userId: input.userId,
        })) ?? 0

      return { revokedCount }
    },
    catch: toInternalError("Failed to revoke browser sessions"),
  })
}

export function revokeOtherBrowserSession(
  store: BrowserAuthStore,
  input: { currentSessionId: string; now?: Date; sessionId: string; userId: string },
): Effect.Effect<{ revoked: boolean }, InternalError> {
  return Effect.tryPromise({
    try: async () => {
      if (input.sessionId === input.currentSessionId) {
        return { revoked: false }
      }

      const revoked =
        (await store.revokeOtherSessionByIdForUser?.({
          currentSessionId: input.currentSessionId,
          now: input.now ?? new Date(),
          sessionId: input.sessionId,
          userId: input.userId,
        })) ?? false

      return { revoked }
    },
    catch: toInternalError("Failed to revoke browser session"),
  })
}

export function updateBrowserPassword(
  store: BrowserAuthStore,
  input: { currentPassword?: string | null; newPassword: string; userId: string },
): Effect.Effect<{ passwordEnabled: true }, AuthenticationError | ForbiddenError | InternalError> {
  return Effect.tryPromise({
    try: async () => {
      const password = input.newPassword.trim()
      if (password.length < 12) {
        throw new ForbiddenError({
          code: "forbidden",
          message: "Password must be at least 12 characters.",
        })
      }

      if (!store.updateUserPasswordHash) {
        throw new Error("Browser auth store cannot update user passwords")
      }

      const existingHash = (await store.findUserPasswordHash?.(input.userId)) ?? null
      if (existingHash) {
        const currentPassword = input.currentPassword?.trim() ?? ""
        if (!currentPassword) {
          throw new ForbiddenError({
            code: "forbidden",
            message: "Current password is required.",
          })
        }
        if (!verifyPasswordHash(currentPassword, existingHash)) {
          throw new ForbiddenError({
            code: "forbidden",
            message: "Current password is invalid.",
          })
        }
      }

      await store.updateUserPasswordHash(input.userId, hashPassword(password))
      return { passwordEnabled: true as const }
    },
    catch: preserveAuthOrForbiddenError("Failed to update password"),
  })
}

export function createBrowserToken() {
  return randomBytes(32).toString("base64url")
}

export function hashBrowserToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url")
  const hash = scryptSync(password, salt, 64).toString("base64url")
  return `scrypt$${salt}$${hash}`
}

export function verifyPasswordHash(password: string, passwordHash: string) {
  const [algorithm, salt, expectedHash] = passwordHash.split("$")
  if (algorithm !== "scrypt" || !salt || !expectedHash) return false

  try {
    const expected = Buffer.from(expectedHash, "base64url")
    const actual = scryptSync(password, salt, expected.length)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

export function normalizeAuthEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase()
  return normalized ? normalized : null
}

function sanitizeRedirectTo(
  redirectTo: string | null | undefined,
  allowedAbsoluteRedirectOrigins: readonly string[] = [],
) {
  if (!redirectTo) return null
  if (isAbsoluteOAuthResumeRedirect(redirectTo, allowedAbsoluteRedirectOrigins)) return redirectTo
  if (!redirectTo.startsWith("/")) return null
  if (redirectTo.startsWith("//")) return null
  return redirectTo
}

function isAbsoluteOAuthResumeRedirect(
  redirectTo: string,
  allowedAbsoluteRedirectOrigins: readonly string[],
) {
  try {
    const url = new URL(redirectTo)
    return (
      url.pathname === "/oauth/authorize/resume" &&
      url.searchParams.has("request_id") &&
      allowedOAuthResumeRedirectOrigins(allowedAbsoluteRedirectOrigins).includes(url.origin)
    )
  } catch {
    return false
  }
}

function allowedOAuthResumeRedirectOrigins(extraOrigins: readonly string[]) {
  return [
    ...extraOrigins,
    process.env.AUTH_PUBLIC_BASE_URL,
    process.env.CONTEXTBASE_AUTH_BASE_URL,
    process.env.VITE_CONTEXTBASE_AUTH_BASE_URL,
    process.env.VITE_AUTH_BASE_URL,
    "http://127.0.0.1:3317",
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => {
      try {
        return [new URL(value).origin]
      } catch {
        return []
      }
    })
}

function invalidPasswordLoginError() {
  return new AuthenticationError({
    code: "unauthenticated",
    message: "Invalid email or password.",
  })
}

function preserveAuthError(message: string) {
  return (cause: unknown) => {
    if (cause instanceof AuthenticationError || cause instanceof InternalError) {
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

function preserveAuthOrForbiddenError(message: string) {
  return (cause: unknown) => {
    if (
      cause instanceof AuthenticationError ||
      cause instanceof ForbiddenError ||
      cause instanceof InternalError
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
