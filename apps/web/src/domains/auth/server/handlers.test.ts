import { afterEach, describe, expect, test, vi } from "vitest"

import {
  AUTH_SHELL_COOKIE_NAME,
  ONBOARDING_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "./cookie"
import {
  handleInvitationAcceptRequest,
  handleLogoutRequest,
  handleMagicLinkConsume,
  handleMagicLinkRequest,
  handleOnboardingCompleteRequest,
  handlePasswordLoginRequest,
  handleSessionRequest,
  handleSignupVerificationConsume,
  handleSignupVerificationRequest,
  handleWorkspaceSwitchRequest,
} from "./handlers"

describe("auth handlers", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.AGENTMAIL_API_KEY
    delete process.env.AGENTMAIL_INBOX_ID
    delete process.env.CONTEXTBASE_APP_BASE_URL
    process.env.NODE_ENV = "test"
  })

  test("returns generic success and sends email when a delivery is produced", async () => {
    const sent: unknown[] = []
    const response = await handleMagicLinkRequest(
      new Request("https://vertical.example.com/api/auth/magic-link/request", {
        body: JSON.stringify({ email: "m@example.com", redirectTo: "/acme/tasks" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      {
        now: new Date("2026-01-01T00:00:00.000Z"),
        requestMagicLink: async () => ({
          accepted: true,
          delivery: {
            email: "m@example.com",
            expiresAt: new Date("2026-01-01T00:15:00.000Z"),
            rawToken: "raw_magic",
            redirectTo: "/acme/tasks",
            userId: "usr_123",
            workspaceId: "wrk_123",
            workspaceSlug: "core",
          },
        }),
        sendMagicLinkEmail: async (message) => {
          sent.push(message)
        },
      },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(sent).toMatchObject([
      {
        email: "m@example.com",
        linkUrl:
          "https://vertical.example.com/auth/verify?token=raw_magic&redirect_to=%2Facme%2Ftasks",
      },
    ])
  })

  test("sends a desktop trampoline link for desktop-originated magic-link requests", async () => {
    const sent: unknown[] = []
    const response = await handleMagicLinkRequest(
      new Request("https://vertical.example.com/api/auth/magic-link/request", {
        body: JSON.stringify({
          clientKind: "desktop",
          email: "m@example.com",
          redirectTo: "/acme/tasks",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      {
        requestMagicLink: async () => ({
          accepted: true,
          delivery: {
            email: "m@example.com",
            expiresAt: new Date("2026-01-01T00:15:00.000Z"),
            rawToken: "raw_magic",
            redirectTo: "/acme/tasks",
            userId: "usr_123",
            workspaceId: "wrk_123",
            workspaceSlug: "core",
          },
        }),
        sendMagicLinkEmail: async (message) => {
          sent.push(message)
        },
      },
    )

    expect(response.status).toBe(200)
    expect(sent).toMatchObject([
      {
        linkUrl:
          "https://vertical.example.com/auth/desktop/verify?token=raw_magic&redirect_to=%2Facme%2Ftasks",
      },
    ])
  })

  test("uses the configured public app origin for desktop magic-link emails behind the production proxy", async () => {
    process.env.CONTEXTBASE_APP_BASE_URL = "https://contextbase.localhost"
    const sent: unknown[] = []
    const response = await handleMagicLinkRequest(
      new Request("http://contextbase.localhost/api/auth/magic-link/request", {
        body: JSON.stringify({
          clientKind: "desktop",
          email: "m@example.com",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      {
        requestMagicLink: async () => ({
          accepted: true,
          delivery: {
            email: "m@example.com",
            expiresAt: new Date("2026-01-01T00:15:00.000Z"),
            rawToken: "raw_magic",
            redirectTo: null,
            userId: "usr_123",
            workspaceId: "wrk_123",
            workspaceSlug: "core",
          },
        }),
        sendMagicLinkEmail: async (message) => {
          sent.push(message)
        },
      },
    )

    expect(response.status).toBe(200)
    expect(sent).toMatchObject([
      {
        linkUrl: "https://contextbase.localhost/auth/desktop/verify?token=raw_magic",
      },
    ])
  })

  test("returns generic signup success and sends a verification email", async () => {
    const sent: unknown[] = []
    const response = await handleSignupVerificationRequest(
      new Request("https://vertical.example.com/api/auth/signup/request", {
        body: JSON.stringify({ email: "new@example.com" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      {
        requestSignupVerification: async () => ({
          accepted: true,
          delivery: {
            email: "new@example.com",
            expiresAt: new Date("2026-06-06T10:15:00.000Z"),
            rawToken: "raw_signup",
            signupVerificationId: "sev_123",
          },
        }),
        sendSignupVerificationEmail: async (message) => {
          sent.push(message)
        },
      },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(sent).toMatchObject([
      {
        email: "new@example.com",
        linkUrl: "https://vertical.example.com/auth/signup/verify?token=raw_signup",
      },
    ])
  })

  test("uses the configured public app origin for signup verification emails behind the production proxy", async () => {
    process.env.CONTEXTBASE_APP_BASE_URL = "https://contextbase.localhost"
    const sent: unknown[] = []
    const response = await handleSignupVerificationRequest(
      new Request("http://contextbase.localhost/api/auth/signup/request", {
        body: JSON.stringify({ email: "new@example.com" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      {
        requestSignupVerification: async () => ({
          accepted: true,
          delivery: {
            email: "new@example.com",
            expiresAt: new Date("2026-06-06T10:15:00.000Z"),
            rawToken: "raw_signup",
            signupVerificationId: "sev_123",
          },
        }),
        sendSignupVerificationEmail: async (message) => {
          sent.push(message)
        },
      },
    )

    expect(response.status).toBe(200)
    expect(sent).toMatchObject([
      {
        linkUrl: "https://contextbase.localhost/auth/signup/verify?token=raw_signup",
      },
    ])
  })

  test("fails signup requests in production when AgentMail is not configured", async () => {
    process.env.NODE_ENV = "production"
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    const response = await handleSignupVerificationRequest(
      new Request("https://vertical.example.com/api/auth/signup/request", {
        body: JSON.stringify({ email: "new@example.com" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      {
        requestSignupVerification: async () => ({
          accepted: true,
          delivery: {
            email: "new@example.com",
            expiresAt: new Date("2026-06-06T10:15:00.000Z"),
            rawToken: "raw_signup",
            signupVerificationId: "sev_123",
          },
        }),
      },
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "internal_error",
        message: "Unexpected server error.",
      },
      ok: false,
    })
    expect(warn).toHaveBeenCalledWith(
      "[auth] AgentMail is not configured; signup verification email was not sent",
    )
  })

  test("sets onboarding cookies when signup verification succeeds", async () => {
    process.env.AUTH_COOKIE_DOMAIN = ".vertical.example.com"
    const response = await handleSignupVerificationConsume(
      new Request("https://vertical.example.com/api/auth/signup/consume", {
        body: JSON.stringify({ token: "raw_signup" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      {
        consumeSignupVerification: async () => ({
          onboardingSession: {
            expiresAt: new Date("2026-06-06T11:00:00.000Z"),
            onboardingSessionId: "obs_123",
            userId: "usr_123",
          },
          rawOnboardingSessionToken: "raw_onboarding",
          user: {
            displayName: "new",
            email: "new@example.com",
            emailNormalized: "new@example.com",
            emailVerifiedAt: new Date("2026-06-06T10:00:00.000Z"),
            id: "usr_123",
          },
        }),
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("set-cookie")).toContain(
      `${ONBOARDING_SESSION_COOKIE_NAME}=raw_onboarding`,
    )
    expect(response.headers.get("set-cookie")).toContain(`${AUTH_SHELL_COOKIE_NAME}=1`)
    expect(response.headers.get("set-cookie")).toContain("Domain=.vertical.example.com")
    await expect(response.json()).resolves.toMatchObject({
      data: {
        onboardingRequired: true,
        onboardingSessionId: "obs_123",
        userId: "usr_123",
      },
      ok: true,
    })
  })

  test("completes onboarding from the onboarding cookie and creates a normal session", async () => {
    process.env.AUTH_COOKIE_DOMAIN = ".vertical.example.com"
    const observedInputs: unknown[] = []
    const response = await handleOnboardingCompleteRequest(
      new Request("https://vertical.example.com/api/auth/onboarding/complete", {
        body: JSON.stringify({
          profileName: "Moody Mike",
          workspaceName: "Acme Engineering",
          workspaceSlug: "acme-eng",
        }),
        headers: {
          "content-type": "application/json",
          cookie: `${ONBOARDING_SESSION_COOKIE_NAME}=raw_onboarding`,
        },
        method: "POST",
      }),
      {
        completeSignupOnboarding: async (input) => {
          observedInputs.push(input)
          return {
            rawSessionToken: `normal:${input.rawOnboardingSessionToken}`,
            session: {
              activeWorkspaceId: "wrk_123",
              activeWorkspaceSlug: "acme-eng",
              expiresAt: new Date("2026-06-06T11:00:00.000Z"),
              sessionId: "ses_123",
              userId: "usr_123",
            },
          }
        },
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("set-cookie")).toContain(
      `${SESSION_COOKIE_NAME}=normal%3Araw_onboarding`,
    )
    expect(response.headers.get("set-cookie")).toContain(`${ONBOARDING_SESSION_COOKIE_NAME}=`)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        activeWorkspaceId: "wrk_123",
        activeWorkspaceSlug: "acme-eng",
        sessionId: "ses_123",
      },
      ok: true,
    })
    expect(observedInputs).toEqual([
      {
        now: undefined,
        profileName: "Moody Mike",
        profileTitle: null,
        rawOnboardingSessionToken: "raw_onboarding",
        sessionTtlSeconds: 60 * 60 * 24 * 30,
        workspaceName: "Acme Engineering",
        workspaceSlug: "acme-eng",
      },
    ])
  })

  test("accepts a workspace invitation and creates a normal session", async () => {
    process.env.AUTH_COOKIE_DOMAIN = ".vertical.example.com"
    const response = await handleInvitationAcceptRequest(
      new Request("https://vertical.example.com/api/auth/invitations/accept", {
        body: JSON.stringify({ token: "raw_invite" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      {
        acceptWorkspaceInvitation: async (input) => ({
          rawSessionToken: `session:${input.rawToken}`,
          session: {
            activeWorkspaceId: "wrk_123",
            activeWorkspaceSlug: "core",
            expiresAt: new Date("2026-06-06T11:00:00.000Z"),
            sessionId: "ses_123",
            userId: "usr_123",
          },
        }),
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("set-cookie")).toContain(
      `${SESSION_COOKIE_NAME}=session%3Araw_invite`,
    )
    expect(response.headers.get("set-cookie")).toContain(`${AUTH_SHELL_COOKIE_NAME}=1`)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        activeWorkspaceId: "wrk_123",
        activeWorkspaceSlug: "core",
        sessionId: "ses_123",
      },
      ok: true,
    })
  })

  test("maps invalid workspace invitations to 401", async () => {
    const response = await handleInvitationAcceptRequest(
      new Request("https://vertical.example.com/api/auth/invitations/accept", {
        body: JSON.stringify({ token: "spent_invite" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      {
        acceptWorkspaceInvitation: async () => {
          throw new Error(
            "(FiberFailure) AuthenticationError: Invalid or expired workspace invitation",
          )
        },
      },
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "unauthenticated",
        details: {},
        message: "Invalid or expired workspace invitation",
      },
      ok: false,
    })
  })

  test("returns clear feedback when the email is not attached to a user", async () => {
    const response = await handleMagicLinkRequest(
      new Request("https://vertical.example.com/api/auth/magic-link/request", {
        body: JSON.stringify({ email: "missing@example.com" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      {
        requestMagicLink: async () => ({
          accepted: true,
          delivery: null,
        }),
        sendMagicLinkEmail: async () => {
          throw new Error("should not send email for missing users")
        },
      },
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "email_not_found",
        details: {},
        message: "Email not found.",
      },
      ok: false,
    })
  })

  test("logs the magic link in non-production when AgentMail is not configured", async () => {
    process.env.NODE_ENV = "development"
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    const response = await handleMagicLinkRequest(
      new Request("http://127.0.0.1:4017/api/auth/magic-link/request", {
        body: JSON.stringify({ email: "m@example.com", redirectTo: "/acme/tasks" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      {
        requestMagicLink: async () => ({
          accepted: true,
          delivery: {
            email: "m@example.com",
            expiresAt: new Date("2026-01-01T00:15:00.000Z"),
            rawToken: "raw_magic",
            redirectTo: "/acme/tasks",
            userId: "usr_123",
            workspaceId: "wrk_123",
            workspaceSlug: "core",
          },
        }),
      },
    )

    expect(response.status).toBe(200)
    expect(warn).toHaveBeenCalledWith(
      "[auth] AgentMail is not configured; use this local magic link:",
      "http://127.0.0.1:4017/auth/verify?token=raw_magic&redirect_to=%2Facme%2Ftasks",
    )
  })

  test("returns the logged-in user email and refreshes browser cookies with the configured domain", async () => {
    process.env.AUTH_COOKIE_DOMAIN = ".vertical.example.com"
    const response = await handleSessionRequest(
      new Request("https://vertical.example.com/api/auth/session", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=raw_session` },
        method: "GET",
      }),
      {
        evaluateFeatureFlags: async (session) => ({
          evaluatedAt: new Date("2026-01-01T00:00:00.000Z"),
          values: {
            "developer.browserFlagOverrides": false,
          },
          version: `${session.activeWorkspaceId}:0`,
        }),
        validateSession: async () => ({
          activeWorkspaceId: "wrk_123",
          activeWorkspaceRole: "workspace_admin",
          activeWorkspaceSlug: "core",
          email: "m@example.com",
          expiresAt: new Date("2026-02-01T00:00:00.000Z"),
          sessionId: "ses_123",
          userId: "usr_123",
          workspaces: [],
        }),
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=raw_session`)
    expect(response.headers.get("set-cookie")).toContain("Domain=.vertical.example.com")
    expect(response.headers.get("set-cookie")).toContain(`${AUTH_SHELL_COOKIE_NAME}=1`)
    expect(response.headers.get("set-cookie")).toContain("Path=/; HttpOnly; SameSite=Lax;")
    expect(response.headers.get("set-cookie")).toContain(
      "Path=/; HttpOnly; SameSite=Lax; Domain=.vertical.example.com;",
    )
    await expect(response.json()).resolves.toMatchObject({
      data: {
        email: "m@example.com",
        featureFlags: {
          values: {
            "developer.browserFlagOverrides": false,
          },
        },
        userId: "usr_123",
      },
      ok: true,
    })
  })

  test("evaluates browser feature flags from the active session scope", async () => {
    const evaluatedSessions: unknown[] = []
    const response = await handleSessionRequest(
      new Request("https://vertical.example.com/api/auth/session", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=raw_session` },
        method: "GET",
      }),
      {
        evaluateFeatureFlags: async (session) => {
          evaluatedSessions.push(session)
          return {
            evaluatedAt: new Date("2026-01-01T00:00:00.000Z"),
            values: {
              "developer.browserFlagOverrides": true,
            },
            version: `${session.activeWorkspaceId}:1`,
          }
        },
        validateSession: async () => ({
          activeWorkspaceId: "wrk_123",
          activeWorkspaceRole: "workspace_admin",
          activeWorkspaceSlug: "core",
          email: "M@Example.com",
          expiresAt: new Date("2026-02-01T00:00:00.000Z"),
          sessionId: "ses_123",
          userId: "usr_123",
          workspaces: [],
        }),
      },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: expect.objectContaining({
        featureFlags: {
          evaluatedAt: "2026-01-01T00:00:00.000Z",
          values: {
            "developer.browserFlagOverrides": true,
          },
          version: "wrk_123:1",
        },
      }),
      ok: true,
    })
    expect(evaluatedSessions).toMatchObject([
      {
        activeWorkspaceId: "wrk_123",
        activeWorkspaceRole: "workspace_admin",
        activeWorkspaceSlug: "core",
        email: "M@Example.com",
        userId: "usr_123",
      },
    ])
  })

  test("returns a valid session with default flags when feature flag evaluation fails", async () => {
    const response = await handleSessionRequest(
      new Request("https://vertical.example.com/api/auth/session", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=raw_session` },
        method: "GET",
      }),
      {
        evaluateFeatureFlags: async () => {
          throw new Error("feature flag table missing")
        },
        validateSession: async () => ({
          activeWorkspaceId: "wrk_123",
          activeWorkspaceRole: "workspace_admin",
          activeWorkspaceSlug: "core",
          email: "m@example.com",
          expiresAt: new Date("2026-02-01T00:00:00.000Z"),
          sessionId: "ses_123",
          userId: "usr_123",
          workspaces: [],
        }),
      },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        email: "m@example.com",
        featureFlags: {
          values: {
            "developer.browserFlagOverrides": false,
          },
          version: "defaults",
        },
        userId: "usr_123",
      },
      ok: true,
    })
  })

  test("sets the auth shell presentation cookie when a magic link creates a session", async () => {
    process.env.AUTH_COOKIE_DOMAIN = ".vertical.example.com"
    const response = await handleMagicLinkConsume(
      new Request("https://vertical.example.com/api/auth/magic-link/consume", {
        body: JSON.stringify({ token: "raw_magic" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      {
        consumeMagicLink: async () => ({
          rawSessionToken: "raw_session",
          session: {
            activeWorkspaceId: "wrk_123",
            activeWorkspaceSlug: "core",
            expiresAt: new Date("2026-02-01T00:00:00.000Z"),
            sessionId: "ses_123",
            userId: "usr_123",
          },
        }),
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=raw_session`)
    expect(response.headers.get("set-cookie")).toContain(`${AUTH_SHELL_COOKIE_NAME}=1`)
    expect(response.headers.get("set-cookie")).toContain("Domain=.vertical.example.com")
    expect(response.headers.get("set-cookie")).toContain("Path=/; HttpOnly; SameSite=Lax;")
  })

  test("sets session cookies when password login succeeds", async () => {
    process.env.AUTH_COOKIE_DOMAIN = ".vertical.example.com"
    const response = await handlePasswordLoginRequest(
      new Request("https://vertical.example.com/api/auth/password/login", {
        body: JSON.stringify({
          email: "m@example.com",
          password: "correct horse battery staple",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      {
        loginWithPassword: async () => ({
          rawSessionToken: "raw_session",
          session: {
            activeWorkspaceId: "wrk_123",
            activeWorkspaceSlug: "core",
            expiresAt: new Date("2026-02-01T00:00:00.000Z"),
            sessionId: "ses_123",
            userId: "usr_123",
          },
        }),
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=raw_session`)
    expect(response.headers.get("set-cookie")).toContain(`${AUTH_SHELL_COOKIE_NAME}=1`)
    expect(response.headers.get("set-cookie")).toContain("Domain=.vertical.example.com")
    await expect(response.json()).resolves.toMatchObject({
      data: {
        activeWorkspaceId: "wrk_123",
        activeWorkspaceSlug: "core",
        sessionId: "ses_123",
        userId: "usr_123",
      },
      ok: true,
    })
  })

  test("returns password setup guidance when an account has no password", async () => {
    const response = await handlePasswordLoginRequest(
      new Request("https://vertical.example.com/api/auth/password/login", {
        body: JSON.stringify({
          email: "m@example.com",
          password: "correct horse battery staple",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      {
        loginWithPassword: async () => {
          throw new Error(
            "(FiberFailure) AuthenticationError: This account does not have a password yet. Use a magic link, then set a password in security settings.",
          )
        },
      },
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "unauthenticated",
        details: {},
        message:
          "This account does not have a password yet. Use a magic link, then set a password in security settings.",
      },
      ok: false,
    })
  })

  test("maps invalid magic links to 401 instead of leaking a server error", async () => {
    const response = await handleMagicLinkConsume(
      new Request("https://vertical.example.com/api/auth/magic-link/consume", {
        body: JSON.stringify({ token: "spent_magic" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      {
        consumeMagicLink: async () => {
          throw new Error("(FiberFailure) AuthenticationError: Invalid or expired magic link")
        },
      },
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "unauthenticated",
        details: {},
        message: "Invalid or expired magic link",
      },
      ok: false,
    })
  })

  test("maps invalid browser sessions to 401 instead of leaking a server error", async () => {
    const response = await handleSessionRequest(
      new Request("https://vertical.example.com/api/auth/session", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=stale_session` },
        method: "GET",
      }),
      {
        validateSession: async () => {
          throw new Error("(FiberFailure) AuthenticationError: Invalid browser session")
        },
      },
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "unauthenticated",
        details: {},
        message: "Invalid browser session",
      },
      ok: false,
    })
  })

  test("uses a later valid session cookie when a stale cookie is sent first", async () => {
    const checked: string[] = []
    const response = await handleSessionRequest(
      new Request("https://vertical.example.com/api/auth/session", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=prod_stale; ${SESSION_COOKIE_NAME}=staging_valid`,
        },
        method: "GET",
      }),
      {
        evaluateFeatureFlags: async (session) => ({
          evaluatedAt: new Date("2026-01-01T00:00:00.000Z"),
          values: {
            "developer.browserFlagOverrides": false,
          },
          version: `${session.activeWorkspaceId}:0`,
        }),
        validateSession: async ({ rawSessionToken }) => {
          checked.push(rawSessionToken)
          if (rawSessionToken !== "staging_valid") {
            throw new Error("(FiberFailure) AuthenticationError: Invalid browser session")
          }
          return {
            activeWorkspaceId: "wrk_123",
            activeWorkspaceRole: "workspace_admin",
            activeWorkspaceSlug: "core",
            email: "m@example.com",
            expiresAt: new Date("2026-02-01T00:00:00.000Z"),
            sessionId: "ses_123",
            userId: "usr_123",
            workspaces: [],
          }
        },
      },
    )

    expect(response.status).toBe(200)
    expect(checked).toEqual(["prod_stale", "staging_valid"])
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=staging_valid`)
    await expect(response.json()).resolves.toMatchObject({ ok: true })
  })

  test("switches the active workspace from the browser session cookie", async () => {
    const response = await handleWorkspaceSwitchRequest(
      new Request("https://vertical.example.com/api/auth/workspace/switch", {
        body: JSON.stringify({ workspaceId: "wrk_456" }),
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=raw_session`,
        },
        method: "POST",
      }),
      {
        validateSession: async () => ({
          activeWorkspaceId: "wrk_123",
          activeWorkspaceRole: "workspace_admin",
          activeWorkspaceSlug: "core",
          email: "m@example.com",
          expiresAt: new Date("2026-02-01T00:00:00.000Z"),
          sessionId: "ses_123",
          userId: "usr_123",
          workspaces: [],
        }),
        switchWorkspace: async (input) => ({
          activeWorkspaceId: input.workspaceId,
          activeWorkspaceSlug: "studio",
          expiresAt: new Date("2026-02-01T00:00:00.000Z"),
          sessionId: "ses_123",
          userId: "usr_123",
        }),
      },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        activeWorkspaceId: "wrk_456",
        activeWorkspaceSlug: "studio",
      },
      ok: true,
    })
  })

  test("revokes logout sessions before clearing the cookie", async () => {
    process.env.AUTH_COOKIE_DOMAIN = ".vertical.example.com"
    const revoked: unknown[] = []
    const response = await handleLogoutRequest(
      new Request("https://vertical.example.com/api/auth/logout", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=raw_session` },
        method: "POST",
      }),
      {
        logoutSession: async (input) => {
          revoked.push(input)
        },
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=`)
    expect(response.headers.get("set-cookie")).toContain(`${AUTH_SHELL_COOKIE_NAME}=`)
    expect(response.headers.get("set-cookie")).toContain("Domain=.vertical.example.com")
    expect(response.headers.get("set-cookie")).toContain(
      "Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
    )
    expect(revoked).toMatchObject([{ rawSessionToken: "raw_session" }])
  })
})
