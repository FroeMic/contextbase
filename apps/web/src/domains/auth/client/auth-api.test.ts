import { describe, expect, test, vi } from "vitest"

import {
  acceptWorkspaceInvitation,
  checkOnboardingSlugAvailability,
  completeSignupOnboarding,
  consumeMagicLink,
  consumeSignupVerification,
  fetchCurrentSession,
  loginWithPassword,
  requestMagicLink,
  requestSignupVerification,
  switchWorkspace,
} from "./auth-api"

describe("browser auth api", () => {
  test("requests a magic link with redirect context", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true })))

    await expect(
      requestMagicLink({ email: "m@example.com", redirectTo: "/acme/tasks" }, { fetcher }),
    ).resolves.toEqual({ ok: true })

    expect(fetcher).toHaveBeenCalledWith("/api/auth/magic-link/request", {
      body: JSON.stringify({ email: "m@example.com", redirectTo: "/acme/tasks" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
  })

  test("requests a desktop magic link when the login was started from Electron", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true })))

    await requestMagicLink(
      { clientKind: "desktop", email: "m@example.com", redirectTo: "/acme/tasks" },
      { fetcher },
    )

    expect(fetcher).toHaveBeenCalledWith("/api/auth/magic-link/request", {
      body: JSON.stringify({
        clientKind: "desktop",
        email: "m@example.com",
        redirectTo: "/acme/tasks",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
  })

  test("logs in with email and password", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: { sessionId: "ses_123" },
            ok: true,
          }),
        ),
    )

    await expect(
      loginWithPassword(
        { email: "m@example.com", password: "correct horse battery staple" },
        { fetcher },
      ),
    ).resolves.toEqual({
      data: { sessionId: "ses_123" },
      ok: true,
    })

    expect(fetcher).toHaveBeenCalledWith("/api/auth/password/login", {
      body: JSON.stringify({
        email: "m@example.com",
        password: "correct horse battery staple",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
  })

  test("requests and consumes signup verification", async () => {
    const responses = [
      new Response(JSON.stringify({ ok: true })),
      new Response(
        JSON.stringify({
          data: {
            onboardingRequired: true,
            onboardingSessionId: "obs_123",
            userId: "usr_123",
          },
          ok: true,
        }),
      ),
    ]
    const fetcher = vi.fn(
      async () => responses.shift() ?? new Response(JSON.stringify({ ok: true })),
    )

    await requestSignupVerification({ email: "new@example.com" }, { fetcher })
    await expect(consumeSignupVerification("raw_signup", { fetcher })).resolves.toEqual({
      data: {
        onboardingRequired: true,
        onboardingSessionId: "obs_123",
        userId: "usr_123",
      },
      ok: true,
    })

    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/auth/signup/request", {
      body: JSON.stringify({ email: "new@example.com" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/auth/signup/consume", {
      body: JSON.stringify({ token: "raw_signup" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
  })

  test("accepts workspace invitations through opaque cookies", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: { sessionId: "ses_invite" },
            ok: true,
          }),
        ),
    )

    await expect(acceptWorkspaceInvitation("raw_invite", { fetcher })).resolves.toEqual({
      data: { sessionId: "ses_invite" },
      ok: true,
    })

    expect(fetcher).toHaveBeenCalledWith("/api/auth/invitations/accept", {
      body: JSON.stringify({ token: "raw_invite" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
  })

  test("completes signup onboarding", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              activeWorkspaceId: "wrk_123",
              activeWorkspaceSlug: "acme-eng",
              sessionId: "ses_123",
            },
            ok: true,
          }),
        ),
    )

    await completeSignupOnboarding(
      {
        profileName: "Moody Mike",
        workspaceName: "Acme Engineering",
        workspaceSlug: "acme-eng",
      },
      { fetcher },
    )

    expect(fetcher).toHaveBeenCalledWith("/api/auth/onboarding/complete", {
      body: JSON.stringify({
        profileName: "Moody Mike",
        workspaceName: "Acme Engineering",
        workspaceSlug: "acme-eng",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
  })

  test("checks onboarding slug availability", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: { available: true },
            ok: true,
          }),
        ),
    )

    await expect(
      checkOnboardingSlugAvailability({ kind: "workspace", slug: "curious-kangaroo" }, { fetcher }),
    ).resolves.toEqual({
      data: { available: true },
      ok: true,
    })

    expect(fetcher).toHaveBeenCalledWith(
      "/api/auth/onboarding/slug-availability?kind=workspace&slug=curious-kangaroo",
      {
        method: "GET",
      },
    )
  })

  test("throws a typed auth api error for failed responses", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "unauthenticated",
              message: "Invalid browser session",
            },
            ok: false,
          }),
          { status: 401 },
        ),
    )

    await expect(fetchCurrentSession({ fetcher })).rejects.toMatchObject({
      code: "unauthenticated",
      message: "Invalid browser session",
      status: 401,
    })
  })

  test("surfaces missing email feedback from magic-link requests", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "email_not_found",
              message: "Email not found.",
            },
            ok: false,
          }),
          { status: 404 },
        ),
    )

    await expect(
      requestMagicLink({ email: "missing@example.com" }, { fetcher }),
    ).rejects.toMatchObject({
      code: "email_not_found",
      message: "Email not found.",
      status: 404,
    })
  })

  test("consumes a magic link and switches workspace through opaque cookies", async () => {
    const responses = [
      new Response(
        JSON.stringify({
          data: { sessionId: "ses_123" },
          ok: true,
        }),
      ),
      new Response(
        JSON.stringify({
          data: { activeWorkspaceId: "wrk_456" },
          ok: true,
        }),
      ),
    ]
    const fetcher = vi.fn(
      async () => responses.shift() ?? new Response(JSON.stringify({ ok: true })),
    )

    await consumeMagicLink("raw_magic", { fetcher })
    await switchWorkspace("wrk_456", { fetcher })

    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/auth/magic-link/consume", {
      body: JSON.stringify({ token: "raw_magic" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/auth/workspace/select", {
      body: JSON.stringify({ workspaceId: "wrk_456" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
  })
})
