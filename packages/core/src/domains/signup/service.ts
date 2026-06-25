import { createHash, randomBytes } from "node:crypto"

import { Effect } from "effect"

import {
  AuthenticationError,
  ConflictError,
  InternalError,
  InvalidRequestError,
} from "../../shared/errors"

export type SignupStore = {
  findSignupAccountByEmail?: (
    emailNormalized: string,
  ) => Promise<{ hasWorkspaceMembership: boolean; id: string } | null>
  findUserByEmail?: (emailNormalized: string) => Promise<{ id: string } | null>
  insertSignupVerification?: (input: {
    email: string
    emailNormalized: string
    expiresAt: Date
    tokenHash: string
  }) => Promise<{ id: string }>
  consumeSignupVerification?: (input: {
    now: Date
    tokenHash: string
  }) => Promise<{ email: string; emailNormalized: string; id: string } | null>
  consumeSignupVerificationWithOnboardingSession?: (input: {
    displayNameFromEmailNormalized: (emailNormalized: string) => string
    now: Date
    sessionExpiresAt: Date
    sessionTokenHash: string
    tokenHash: string
  }) => Promise<{
    onboardingSession: {
      expiresAt: Date
      onboardingSessionId: string
      userId: string
    }
    user: {
      displayName: string
      email: string
      emailNormalized: string
      emailVerifiedAt: Date
      id: string
    }
  } | null>
  createVerifiedSignupUserWithOnboardingSession?: (input: {
    displayName: string
    email: string
    emailNormalized: string
    now: Date
    sessionExpiresAt: Date
    sessionTokenHash: string
    signupVerificationId: string
  }) => Promise<{
    onboardingSession: {
      expiresAt: Date
      onboardingSessionId: string
      userId: string
    }
    user: {
      displayName: string
      email: string
      emailNormalized: string
      emailVerifiedAt: Date
      id: string
    }
  }>
  findActiveOnboardingSessionByTokenHash?: (
    tokenHash: string,
  ) => Promise<{ onboardingSessionId: string; tokenHash: string; userId: string } | null>
  completeOnboardingSetup?: (input: CompleteOnboardingSetupInput) => Promise<{
    session: {
      activeWorkspaceId: string
      activeWorkspaceSlug: string
      expiresAt: Date
      sessionId: string
      userId: string
    }
    userId: string
    workspaceId: string
    workspaceSlug: string
  }>
}

export type CompleteOnboardingSetupInput = {
  now: Date
  onboardingSessionId: string
  profileName: string
  profileTitle?: string | null
  sessionExpiresAt: Date
  sessionTokenHash: string
  userId: string
  workspaceName: string
  workspaceSlug: string
}

export function requestSignupVerification(
  store: SignupStore,
  input: {
    email: string
    now?: Date
    randomToken?: () => string
    ttlSeconds: number
  },
): Effect.Effect<
  {
    accepted: true
    delivery: {
      email: string
      expiresAt: Date
      rawToken: string
      signupVerificationId: string
    } | null
  },
  InternalError
> {
  return Effect.tryPromise({
    try: async () => {
      const emailNormalized = normalizeSignupEmail(input.email)
      if (!emailNormalized) return { accepted: true as const, delivery: null }
      if (!isValidSignupEmail(emailNormalized)) return { accepted: true as const, delivery: null }

      const existingAccount = store.findSignupAccountByEmail
        ? await store.findSignupAccountByEmail(emailNormalized)
        : null
      if (existingAccount?.hasWorkspaceMembership) {
        return { accepted: true as const, delivery: null }
      }

      if (!store.findSignupAccountByEmail) {
        const existingUser = (await store.findUserByEmail?.(emailNormalized)) ?? null
        if (existingUser) return { accepted: true as const, delivery: null }
      }

      if (!store.insertSignupVerification) {
        throw new Error("Signup store cannot insert signup verifications")
      }

      const now = input.now ?? new Date()
      const rawToken = (input.randomToken ?? createSignupToken)()
      const expiresAt = new Date(now.getTime() + input.ttlSeconds * 1000)
      const verification = await store.insertSignupVerification({
        email: emailNormalized,
        emailNormalized,
        expiresAt,
        tokenHash: hashSignupToken(rawToken),
      })

      return {
        accepted: true as const,
        delivery: {
          email: emailNormalized,
          expiresAt,
          rawToken,
          signupVerificationId: verification.id,
        },
      }
    },
    catch: toInternalError("Failed to request signup verification"),
  })
}

export function consumeSignupVerification(
  store: SignupStore,
  input: {
    now?: Date
    randomToken?: () => string
    rawToken: string
    sessionTtlSeconds: number
  },
): Effect.Effect<
  {
    onboardingSession: {
      expiresAt: Date
      onboardingSessionId: string
      userId: string
    }
    rawOnboardingSessionToken: string
    user: {
      displayName: string
      email: string
      emailNormalized: string
      emailVerifiedAt: Date
      id: string
    }
  },
  AuthenticationError | ConflictError | InternalError
> {
  return Effect.tryPromise({
    try: async () => {
      if (!store.consumeSignupVerificationWithOnboardingSession) {
        throw new Error("Signup store cannot atomically consume signup verifications")
      }

      const now = input.now ?? new Date()
      const rawOnboardingSessionToken = (input.randomToken ?? createSignupToken)()
      const result = await store.consumeSignupVerificationWithOnboardingSession({
        displayNameFromEmailNormalized: defaultDisplayNameFromEmail,
        now,
        sessionExpiresAt: new Date(now.getTime() + input.sessionTtlSeconds * 1000),
        sessionTokenHash: hashSignupToken(rawOnboardingSessionToken),
        tokenHash: hashSignupToken(input.rawToken),
      })

      if (!result) {
        throw new AuthenticationError({
          code: "unauthenticated",
          message: "Invalid or expired signup verification link",
        })
      }

      return {
        ...result,
        rawOnboardingSessionToken,
      }
    },
    catch: preserveAuthError("Failed to consume signup verification"),
  })
}

export function completeSignupOnboarding(
  store: SignupStore,
  input: {
    now?: Date
    profileName: string
    profileTitle?: string | null
    randomToken?: () => string
    rawOnboardingSessionToken: string
    sessionTtlSeconds: number
    workspaceName: string
    workspaceSlug: string
  },
): Effect.Effect<
  {
    rawSessionToken: string
    session: {
      activeWorkspaceId: string
      activeWorkspaceSlug: string
      expiresAt: Date
      sessionId: string
      userId: string
    }
  },
  AuthenticationError | ConflictError | InternalError | InvalidRequestError
> {
  return Effect.tryPromise({
    try: async () => {
      if (!store.findActiveOnboardingSessionByTokenHash) {
        throw new Error("Signup store cannot find onboarding sessions")
      }
      if (!store.completeOnboardingSetup) {
        throw new Error("Signup store cannot complete onboarding")
      }

      const onboardingSession = await store.findActiveOnboardingSessionByTokenHash(
        hashSignupToken(input.rawOnboardingSessionToken),
      )
      if (!onboardingSession) {
        throw new AuthenticationError({
          code: "unauthenticated",
          message: "Invalid or expired onboarding session",
        })
      }

      const now = input.now ?? new Date()
      const rawSessionToken = (input.randomToken ?? createSignupToken)()
      const resolved = await store.completeOnboardingSetup({
        now,
        onboardingSessionId: onboardingSession.onboardingSessionId,
        profileName: normalizeRequiredText(input.profileName, "profileName", "Profile"),
        profileTitle: normalizeOptionalText(input.profileTitle),
        sessionExpiresAt: new Date(now.getTime() + input.sessionTtlSeconds * 1000),
        sessionTokenHash: hashSignupToken(rawSessionToken),
        userId: onboardingSession.userId,
        workspaceName: normalizeRequiredText(input.workspaceName, "workspaceName", "Workspace"),
        workspaceSlug: normalizeRequiredSlug(input.workspaceSlug, "workspaceSlug"),
      })

      return {
        rawSessionToken,
        session: resolved.session,
      }
    },
    catch: preserveOnboardingError("Failed to complete onboarding"),
  })
}

export function hashSignupToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

export function createSignupToken() {
  return randomBytes(32).toString("base64url")
}

function normalizeSignupEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase()
  return normalized ? normalized : null
}

function isValidSignupEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function defaultDisplayNameFromEmail(emailNormalized: string) {
  const localPart = emailNormalized.split("@")[0]?.trim()
  return localPart || "New user"
}

function normalizeRequiredText(
  value: string,
  field: "profileName" | "workspaceName",
  label: string,
) {
  const normalized = value.trim()
  if (normalized) return normalized
  return invalidRequest(`${label} name is required`, { field })
}

function normalizeRequiredSlug(value: string, field: "workspaceSlug") {
  const normalized = value.trim()
  if (normalized) return normalized

  return invalidRequest("Workspace slug is required", {
    field,
  })
}

function invalidRequest(message: string, details: Record<string, unknown>): never {
  throw new InvalidRequestError({
    code: "invalid_request",
    details,
    message,
  })
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function preserveAuthError(message: string) {
  return (cause: unknown) => {
    if (
      cause instanceof AuthenticationError ||
      cause instanceof ConflictError ||
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

function preserveOnboardingError(message: string) {
  return (cause: unknown) => {
    if (
      cause instanceof AuthenticationError ||
      cause instanceof ConflictError ||
      cause instanceof InternalError ||
      cause instanceof InvalidRequestError
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
