import { Effect } from "effect"
import { describe, expect, test } from "vitest"

import {
  consumeMagicLink,
  hashBrowserToken,
  hashPassword,
  listActiveBrowserSessions,
  loginWithPassword,
  requestMagicLink,
  revokeOtherBrowserSession,
  revokeOtherBrowserSessions,
  switchBrowserSessionWorkspace,
  updateBrowserPassword,
  validateBrowserSession,
} from "./browser-session"

describe("browser session auth", () => {
  test("requests a magic link without revealing missing users", async () => {
    const result = await Effect.runPromise(
      requestMagicLink(
        {
          findLoginUserByEmail: async () => null,
          insertMagicLink: async () => {
            throw new Error("should not create link for missing user")
          },
        },
        {
          email: " Missing@Example.COM ",
          now: new Date("2026-01-01T00:00:00.000Z"),
          randomToken: () => "raw_magic",
          ttlSeconds: 900,
        },
      ),
    )

    expect(result).toEqual({
      accepted: true,
      delivery: null,
    })
  })

  test("creates a hashed magic link for the first active workspace", async () => {
    const created: unknown[] = []
    const result = await Effect.runPromise(
      requestMagicLink(
        {
          findLoginUserByEmail: async () => ({
            email: "m@example.com",
            emailNormalized: "m@example.com",
            userId: "usr_123",
            workspaces: [
              {
                role: "workspace_admin",
                workspaceId: "wrk_123",
                workspaceSlug: "core",
              },
            ],
          }),
          insertMagicLink: async (input) => {
            created.push(input)
          },
        },
        {
          email: " M@Example.com ",
          now: new Date("2026-01-01T00:00:00.000Z"),
          randomToken: () => "raw_magic",
          redirectTo: "/acme/tasks",
          ttlSeconds: 900,
        },
      ),
    )

    expect(created).toMatchObject([
      {
        emailNormalized: "m@example.com",
        tokenHash: hashBrowserToken("raw_magic"),
        workspaceId: "wrk_123",
      },
    ])
    expect(result.delivery).toMatchObject({
      email: "m@example.com",
      expiresAt: new Date("2026-01-01T00:15:00.000Z"),
      rawToken: "raw_magic",
      redirectTo: "/acme/tasks",
      workspaceSlug: "core",
    })
  })

  test("preserves absolute OAuth resume redirects for magic links", async () => {
    const created: unknown[] = []
    const redirectTo = "http://127.0.0.1:3317/oauth/authorize/resume?request_id=oar_split_origin"

    const result = await Effect.runPromise(
      requestMagicLink(
        {
          findLoginUserByEmail: async () => ({
            email: "m@example.com",
            emailNormalized: "m@example.com",
            userId: "usr_123",
            workspaces: [
              {
                role: "workspace_admin",
                workspaceId: "wrk_123",
                workspaceSlug: "core",
              },
            ],
          }),
          insertMagicLink: async (input) => {
            created.push(input)
          },
        },
        {
          email: "m@example.com",
          now: new Date("2026-01-01T00:00:00.000Z"),
          randomToken: () => "raw_magic",
          redirectTo,
          ttlSeconds: 900,
        },
      ),
    )

    expect(created).toMatchObject([{ redirectTo }])
    expect(result.delivery?.redirectTo).toBe(redirectTo)
  })

  test("drops arbitrary absolute redirects for magic links", async () => {
    const created: unknown[] = []

    const result = await Effect.runPromise(
      requestMagicLink(
        {
          findLoginUserByEmail: async () => ({
            email: "m@example.com",
            emailNormalized: "m@example.com",
            userId: "usr_123",
            workspaces: [
              {
                role: "workspace_admin",
                workspaceId: "wrk_123",
                workspaceSlug: "core",
              },
            ],
          }),
          insertMagicLink: async (input) => {
            created.push(input)
          },
        },
        {
          email: "m@example.com",
          now: new Date("2026-01-01T00:00:00.000Z"),
          randomToken: () => "raw_magic",
          redirectTo: "https://evil.example.com/oauth/authorize/resume?request_id=oar_123",
          ttlSeconds: 900,
        },
      ),
    )

    expect(created).toMatchObject([{ redirectTo: null }])
    expect(result.delivery?.redirectTo).toBeNull()
  })

  test("consumes a magic link and returns a raw session token once", async () => {
    const result = await Effect.runPromise(
      consumeMagicLink(
        {
          consumeMagicLinkForSession: async (input) => ({
            activeWorkspaceId: "wrk_123",
            activeWorkspaceSlug: "core",
            expiresAt: input.sessionExpiresAt,
            sessionId: "ses_123",
            userId: "usr_123",
          }),
        },
        {
          now: new Date("2026-01-01T00:00:00.000Z"),
          rawToken: "raw_magic",
          randomToken: () => "raw_session",
          sessionTtlSeconds: 60 * 60 * 24 * 30,
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
  })

  test("creates a browser session when password credentials match", async () => {
    const passwordHash = hashPassword("correct horse battery staple")
    const sessionInputs: unknown[] = []
    const result = await Effect.runPromise(
      loginWithPassword(
        {
          createPasswordBrowserSession: async (input) => {
            sessionInputs.push(input)
            return {
              activeWorkspaceId: input.workspaceId,
              activeWorkspaceSlug: "core",
              expiresAt: input.sessionExpiresAt,
              sessionId: "ses_123",
              userId: input.userId,
            }
          },
          findLoginUserByEmail: async () => ({
            email: "m@example.com",
            emailNormalized: "m@example.com",
            passwordHash,
            userId: "usr_123",
            workspaces: [
              {
                role: "workspace_admin",
                workspaceId: "wrk_123",
                workspaceSlug: "core",
              },
            ],
          }),
        },
        {
          email: " M@Example.com ",
          now: new Date("2026-01-01T00:00:00.000Z"),
          password: "correct horse battery staple",
          randomToken: () => "raw_session",
          sessionTtlSeconds: 60 * 60 * 24 * 30,
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
    expect(sessionInputs).toMatchObject([
      {
        sessionTokenHash: hashBrowserToken("raw_session"),
        userId: "usr_123",
        workspaceId: "wrk_123",
      },
    ])
  })

  test("returns a specific password login error when the user has no password", async () => {
    await expect(
      Effect.runPromise(
        Effect.either(
          loginWithPassword(
            {
              createPasswordBrowserSession: async () => {
                throw new Error("should not create a session without a password")
              },
              findLoginUserByEmail: async () => ({
                email: "m@example.com",
                emailNormalized: "m@example.com",
                passwordHash: null,
                userId: "usr_123",
                workspaces: [
                  {
                    role: "workspace_admin",
                    workspaceId: "wrk_123",
                    workspaceSlug: "core",
                  },
                ],
              }),
            },
            {
              email: "m@example.com",
              password: "correct horse battery staple",
              sessionTtlSeconds: 60 * 60 * 24 * 30,
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "AuthenticationError",
        message:
          "This account does not have a password yet. Use a magic link, then set a password in security settings.",
      },
    })
  })

  test("rejects invalid password credentials with a generic auth error", async () => {
    await expect(
      Effect.runPromise(
        Effect.either(
          loginWithPassword(
            {
              createPasswordBrowserSession: async () => {
                throw new Error("should not create a session for invalid credentials")
              },
              findLoginUserByEmail: async () => ({
                email: "m@example.com",
                emailNormalized: "m@example.com",
                passwordHash: hashPassword("correct horse battery staple"),
                userId: "usr_123",
                workspaces: [
                  {
                    role: "workspace_admin",
                    workspaceId: "wrk_123",
                    workspaceSlug: "core",
                  },
                ],
              }),
            },
            {
              email: "m@example.com",
              password: "wrong password value",
              sessionTtlSeconds: 60 * 60 * 24 * 30,
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "AuthenticationError",
        message: "Invalid email or password.",
      },
    })
  })

  test("rejects expired browser sessions", async () => {
    await expect(
      Effect.runPromise(
        Effect.either(
          validateBrowserSession(
            {
              findSessionByTokenHash: async () => ({
                activeWorkspaceId: "wrk_123",
                activeWorkspaceRole: "workspace_admin",
                activeWorkspaceSlug: "core",
                email: "m@example.com",
                expiresAt: new Date("2025-12-31T23:59:59.000Z"),
                sessionId: "ses_123",
                userId: "usr_123",
                workspaces: [],
              }),
            },
            {
              now: new Date("2026-01-01T00:00:00.000Z"),
              rawSessionToken: "raw_session",
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "AuthenticationError",
      },
    })
  })

  test("switches an active browser session to another workspace membership", async () => {
    const result = await Effect.runPromise(
      switchBrowserSessionWorkspace(
        {
          switchSessionWorkspaceByTokenHash: async (input) => ({
            activeWorkspaceId: input.workspaceId,
            activeWorkspaceSlug: "studio",
            expiresAt: new Date("2026-02-01T00:00:00.000Z"),
            sessionId: "ses_123",
            userId: "usr_123",
          }),
        },
        {
          now: new Date("2026-01-01T00:00:00.000Z"),
          rawSessionToken: "raw_session",
          workspaceId: "wrk_456",
        },
      ),
    )

    expect(result).toMatchObject({
      activeWorkspaceId: "wrk_456",
      activeWorkspaceSlug: "studio",
      sessionId: "ses_123",
    })
  })

  test("lists active browser sessions with the current session marked", async () => {
    const result = await Effect.runPromise(
      listActiveBrowserSessions(
        {
          listActiveSessionsByUserId: async () => [
            {
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              expiresAt: new Date("2026-02-01T00:00:00.000Z"),
              id: "ses_123",
              ipAddress: null,
              lastSeenAt: null,
              userAgent: "Browser",
            },
          ],
        },
        { currentSessionId: "ses_123", userId: "usr_123" },
      ),
    )

    expect(result).toEqual([
      expect.objectContaining({
        current: true,
        id: "ses_123",
        userAgent: "Browser",
      }),
    ])
  })

  test("revokes other browser sessions for the signed-in user", async () => {
    const calls: unknown[] = []
    await Effect.runPromise(
      revokeOtherBrowserSessions(
        {
          revokeOtherSessionsByUserId: async (input) => {
            calls.push(input)
            return 2
          },
        },
        {
          currentSessionId: "ses_current",
          now: new Date("2026-01-01T00:00:00.000Z"),
          userId: "usr_123",
        },
      ),
    )

    expect(calls).toEqual([
      {
        currentSessionId: "ses_current",
        now: new Date("2026-01-01T00:00:00.000Z"),
        userId: "usr_123",
      },
    ])
  })

  test("revokes a selected other browser session for the signed-in user", async () => {
    const calls: unknown[] = []
    await Effect.runPromise(
      revokeOtherBrowserSession(
        {
          revokeOtherSessionByIdForUser: async (input) => {
            calls.push(input)
            return true
          },
        },
        {
          currentSessionId: "ses_current",
          now: new Date("2026-01-01T00:00:00.000Z"),
          sessionId: "ses_other",
          userId: "usr_123",
        },
      ),
    )

    expect(calls).toEqual([
      {
        currentSessionId: "ses_current",
        now: new Date("2026-01-01T00:00:00.000Z"),
        sessionId: "ses_other",
        userId: "usr_123",
      },
    ])
  })

  test("does not revoke the current browser session through the other-session path", async () => {
    const calls: unknown[] = []
    const result = await Effect.runPromise(
      revokeOtherBrowserSession(
        {
          revokeOtherSessionByIdForUser: async (input) => {
            calls.push(input)
            return true
          },
        },
        {
          currentSessionId: "ses_current",
          sessionId: "ses_current",
          userId: "usr_123",
        },
      ),
    )

    expect(result).toEqual({ revoked: false })
    expect(calls).toEqual([])
  })

  test("updates password credentials with a non-plaintext hash", async () => {
    const hashes: string[] = []
    await Effect.runPromise(
      updateBrowserPassword(
        {
          updateUserPasswordHash: async (_userId, passwordHash) => {
            hashes.push(passwordHash)
          },
        },
        { newPassword: "correct horse battery staple", userId: "usr_123" },
      ),
    )

    expect(hashes[0]).toMatch(/^scrypt\$/)
    expect(hashes[0]).not.toContain("correct horse")
  })

  test("requires the current password before changing an existing password", async () => {
    const existingHash = hashPassword("existing secure password")
    const hashes: string[] = []

    await expect(
      Effect.runPromise(
        Effect.either(
          updateBrowserPassword(
            {
              findUserPasswordHash: async () => existingHash,
              updateUserPasswordHash: async (_userId, passwordHash) => {
                hashes.push(passwordHash)
              },
            },
            { newPassword: "correct horse battery staple", userId: "usr_123" },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { _tag: "ForbiddenError" },
    })
    expect(hashes).toEqual([])
  })

  test("changes an existing password when the current password matches", async () => {
    const existingHash = hashPassword("existing secure password")
    const hashes: string[] = []

    const result = await Effect.runPromise(
      updateBrowserPassword(
        {
          findUserPasswordHash: async () => existingHash,
          updateUserPasswordHash: async (_userId, passwordHash) => {
            hashes.push(passwordHash)
          },
        },
        {
          currentPassword: "existing secure password",
          newPassword: "correct horse battery staple",
          userId: "usr_123",
        },
      ),
    )

    expect(result).toEqual({ passwordEnabled: true })
    expect(hashes).toHaveLength(1)
    expect(hashes[0]).toMatch(/^scrypt\$/)
    expect(hashes[0]).not.toBe(existingHash)
  })
})
