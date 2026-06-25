import { Effect } from "effect"
import { describe, expect, test } from "vitest"

import { ConflictError } from "../../shared/errors"
import {
  completeSignupOnboarding,
  consumeSignupVerification,
  hashSignupToken,
  requestSignupVerification,
} from "./service"

describe("signup service", () => {
  test("creates a pending email verification without creating user or workspace records", async () => {
    const writes: unknown[] = []

    const result = await Effect.runPromise(
      requestSignupVerification(
        {
          findUserByEmail: async () => null,
          insertSignupVerification: async (input) => {
            writes.push(input)
            return { id: "sev_123" }
          },
        },
        {
          email: " New@Example.com ",
          now: new Date("2026-06-06T10:00:00.000Z"),
          randomToken: () => "raw_signup",
          ttlSeconds: 900,
        },
      ),
    )

    expect(result).toMatchObject({
      accepted: true,
      delivery: {
        email: "new@example.com",
        rawToken: "raw_signup",
        signupVerificationId: "sev_123",
      },
    })
    expect(writes).toEqual([
      {
        email: "new@example.com",
        emailNormalized: "new@example.com",
        expiresAt: new Date("2026-06-06T10:15:00.000Z"),
        tokenHash: hashSignupToken("raw_signup"),
      },
    ])
  })

  test("does not reveal existing users when requesting signup verification", async () => {
    const result = await Effect.runPromise(
      requestSignupVerification(
        {
          findSignupAccountByEmail: async () => ({
            hasWorkspaceMembership: true,
            id: "usr_existing",
          }),
          insertSignupVerification: async () => {
            throw new Error("should not insert signup verification for existing users")
          },
        },
        {
          email: "existing@example.com",
          randomToken: () => "raw_signup",
          ttlSeconds: 900,
        },
      ),
    )

    expect(result).toEqual({ accepted: true, delivery: null })
  })

  test("does not create verifications for malformed signup emails", async () => {
    const result = await Effect.runPromise(
      requestSignupVerification(
        {
          findSignupAccountByEmail: async () => {
            throw new Error("should not query users for malformed email")
          },
          insertSignupVerification: async () => {
            throw new Error("should not insert malformed email verification")
          },
        },
        {
          email: "not-an-email",
          randomToken: () => "raw_signup",
          ttlSeconds: 900,
        },
      ),
    )

    expect(result).toEqual({ accepted: true, delivery: null })
  })

  test("allows unfinished signup users to request a fresh verification", async () => {
    const writes: unknown[] = []

    const result = await Effect.runPromise(
      requestSignupVerification(
        {
          findSignupAccountByEmail: async () => ({
            hasWorkspaceMembership: false,
            id: "usr_unfinished",
          }),
          findUserByEmail: async () => ({ id: "usr_unfinished" }),
          insertSignupVerification: async (input) => {
            writes.push(input)
            return { id: "sev_retry" }
          },
        },
        {
          email: "unfinished@example.com",
          now: new Date("2026-06-06T10:00:00.000Z"),
          randomToken: () => "raw_retry",
          ttlSeconds: 900,
        },
      ),
    )

    expect(result).toMatchObject({
      accepted: true,
      delivery: {
        email: "unfinished@example.com",
        rawToken: "raw_retry",
        signupVerificationId: "sev_retry",
      },
    })
    expect(writes).toEqual([
      expect.objectContaining({
        emailNormalized: "unfinished@example.com",
        tokenHash: hashSignupToken("raw_retry"),
      }),
    ])
  })

  test("consumes a verified signup token into a user and onboarding session", async () => {
    const writes: unknown[] = []

    const result = await Effect.runPromise(
      consumeSignupVerification(
        {
          consumeSignupVerificationWithOnboardingSession: async (input) => {
            writes.push({
              now: input.now,
              sessionExpiresAt: input.sessionExpiresAt,
              sessionTokenHash: input.sessionTokenHash,
              tokenHash: input.tokenHash,
            })
            return {
              onboardingSession: {
                expiresAt: input.sessionExpiresAt,
                onboardingSessionId: "obs_123",
                userId: "usr_123",
              },
              user: {
                displayName: input.displayNameFromEmailNormalized("new@example.com"),
                email: "new@example.com",
                emailNormalized: "new@example.com",
                emailVerifiedAt: input.now,
                id: "usr_123",
              },
            }
          },
        },
        {
          now: new Date("2026-06-06T10:00:00.000Z"),
          randomToken: () => "raw_onboarding",
          rawToken: "raw_signup",
          sessionTtlSeconds: 3600,
        },
      ),
    )

    expect(result).toMatchObject({
      rawOnboardingSessionToken: "raw_onboarding",
      onboardingSession: {
        onboardingSessionId: "obs_123",
        userId: "usr_123",
      },
      user: {
        email: "new@example.com",
        id: "usr_123",
      },
    })
    expect(writes).toEqual([
      {
        now: new Date("2026-06-06T10:00:00.000Z"),
        sessionExpiresAt: new Date("2026-06-06T11:00:00.000Z"),
        sessionTokenHash: hashSignupToken("raw_onboarding"),
        tokenHash: hashSignupToken("raw_signup"),
      },
    ])
  })

  test("requires an active onboarding session before creating workspace context", async () => {
    await expect(
      Effect.runPromise(
        Effect.either(
          completeSignupOnboarding(
            {
              completeOnboardingSetup: async () => {
                throw new Error("should not create workspace context")
              },
              findActiveOnboardingSessionByTokenHash: async () => null,
            },
            {
              profileName: "Moody Mike",
              rawOnboardingSessionToken: "missing",
              sessionTtlSeconds: 3600,
              workspaceName: "Acme Engineering",
              workspaceSlug: "acme-eng",
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "AuthenticationError",
        code: "unauthenticated",
      },
    })
  })

  test("completes onboarding by creating the first workspace and browser session", async () => {
    const writes: unknown[] = []

    const result = await Effect.runPromise(
      completeSignupOnboarding(
        {
          completeOnboardingSetup: async (input) => {
            writes.push(input)
            return {
              session: {
                activeWorkspaceId: "wrk_123",
                activeWorkspaceSlug: input.workspaceSlug,
                expiresAt: input.sessionExpiresAt,
                sessionId: "ses_123",
                userId: input.userId,
              },
              userId: input.userId,
              workspaceId: "wrk_123",
              workspaceSlug: input.workspaceSlug,
            }
          },
          findActiveOnboardingSessionByTokenHash: async (tokenHash) => ({
            onboardingSessionId: "obs_123",
            tokenHash,
            userId: "usr_123",
          }),
        },
        {
          now: new Date("2026-06-06T10:00:00.000Z"),
          profileName: " Moody Mike ",
          profileTitle: " Engineer ",
          randomToken: () => "raw_session",
          rawOnboardingSessionToken: "raw_onboarding",
          sessionTtlSeconds: 3600,
          workspaceName: " Acme Engineering ",
          workspaceSlug: "acme-eng",
        },
      ),
    )

    expect(result).toMatchObject({
      rawSessionToken: "raw_session",
      session: {
        activeWorkspaceId: "wrk_123",
        sessionId: "ses_123",
      },
    })
    expect(writes).toEqual([
      {
        now: new Date("2026-06-06T10:00:00.000Z"),
        onboardingSessionId: "obs_123",
        profileName: "Moody Mike",
        profileTitle: "Engineer",
        sessionExpiresAt: new Date("2026-06-06T11:00:00.000Z"),
        sessionTokenHash: hashSignupToken("raw_session"),
        userId: "usr_123",
        workspaceName: "Acme Engineering",
        workspaceSlug: "acme-eng",
      },
    ])
  })

  test("preserves duplicate onboarding slug conflicts", async () => {
    await expect(
      Effect.runPromise(
        Effect.either(
          completeSignupOnboarding(
            {
              completeOnboardingSetup: async () => {
                throw new ConflictError({
                  code: "conflict",
                  details: {
                    workspaceSlug: "acme",
                  },
                  message: "Workspace slug is already in use.",
                })
              },
              findActiveOnboardingSessionByTokenHash: async (tokenHash) => ({
                onboardingSessionId: "obs_123",
                tokenHash,
                userId: "usr_123",
              }),
            },
            {
              profileName: "Moody Mike",
              rawOnboardingSessionToken: "raw_onboarding",
              sessionTtlSeconds: 3600,
              workspaceName: "Acme",
              workspaceSlug: "acme",
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "ConflictError",
        code: "conflict",
      },
    })
  })

  test("returns typed invalid request errors for empty onboarding slugs", async () => {
    await expect(
      Effect.runPromise(
        Effect.either(
          completeSignupOnboarding(
            {
              completeOnboardingSetup: async () => {
                throw new Error("should not complete onboarding with empty slugs")
              },
              findActiveOnboardingSessionByTokenHash: async (tokenHash) => ({
                onboardingSessionId: "obs_123",
                tokenHash,
                userId: "usr_123",
              }),
            },
            {
              profileName: "Moody Mike",
              rawOnboardingSessionToken: "raw_onboarding",
              sessionTtlSeconds: 3600,
              workspaceName: "!!!",
              workspaceSlug: " ",
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "InvalidRequestError",
        code: "invalid_request",
      },
    })
  })

  test("returns typed invalid request errors for blank onboarding text fields", async () => {
    for (const input of [
      { profileName: " ", workspaceName: "Acme" },
      { profileName: "Moody Mike", workspaceName: " " },
    ]) {
      await expect(
        Effect.runPromise(
          Effect.either(
            completeSignupOnboarding(
              {
                completeOnboardingSetup: async () => {
                  throw new Error("should not complete onboarding with blank fields")
                },
                findActiveOnboardingSessionByTokenHash: async (tokenHash) => ({
                  onboardingSessionId: "obs_123",
                  tokenHash,
                  userId: "usr_123",
                }),
              },
              {
                profileName: input.profileName,
                rawOnboardingSessionToken: "raw_onboarding",
                sessionTtlSeconds: 3600,
                workspaceName: input.workspaceName,
                workspaceSlug: "acme",
              },
            ),
          ),
        ),
      ).resolves.toMatchObject({
        _tag: "Left",
        left: {
          _tag: "InvalidRequestError",
          code: "invalid_request",
        },
      })
    }
  })
})
