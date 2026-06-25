import { describe, expect, test } from "vitest"

import { createApiRequestHandler } from "./server-api"

describe("server API routing", () => {
  test("handles magic-link requests before the page app", async () => {
    let called = false
    const handler = createApiRequestHandler({
      handleMagicLinkRequest: async () => {
        called = true
        return Response.json({ ok: true })
      },
    })

    const response = await handler(
      new Request("https://vertical.example.com/api/auth/magic-link/request", {
        body: JSON.stringify({ email: "m@example.com" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    )

    expect(called).toBe(true)
    expect(response?.headers.get("content-type")).toContain("application/json")
    await expect(response?.json()).resolves.toEqual({ ok: true })
  })

  test("handles password login requests before the page app", async () => {
    let called = false
    const handler = createApiRequestHandler({
      handlePasswordLoginRequest: async () => {
        called = true
        return Response.json({ ok: true })
      },
    } as never)

    const response = await handler(
      new Request("https://vertical.example.com/api/auth/password/login", {
        body: JSON.stringify({
          email: "m@example.com",
          password: "correct horse battery staple",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    )

    expect(called).toBe(true)
    expect(response?.headers.get("content-type")).toContain("application/json")
    await expect(response?.json()).resolves.toEqual({ ok: true })
  })

  test("handles signup verification requests before the page app", async () => {
    let called = false
    const handler = createApiRequestHandler({
      handleSignupVerificationRequest: async () => {
        called = true
        return Response.json({ ok: true })
      },
    } as never)

    const response = await handler(
      new Request("https://vertical.example.com/api/auth/signup/request", {
        body: JSON.stringify({ email: "new@example.com" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    )

    expect(called).toBe(true)
    expect(response?.status).toBe(200)
  })

  test("handles signup verification consume requests before the page app", async () => {
    let called = false
    const handler = createApiRequestHandler({
      handleSignupVerificationConsume: async () => {
        called = true
        return Response.json({ ok: true })
      },
    } as never)

    const response = await handler(
      new Request("https://vertical.example.com/api/auth/signup/consume", {
        body: JSON.stringify({ token: "raw_signup" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    )

    expect(called).toBe(true)
    expect(response?.status).toBe(200)
  })

  test("handles onboarding completion requests before the page app", async () => {
    let called = false
    const handler = createApiRequestHandler({
      handleOnboardingCompleteRequest: async () => {
        called = true
        return Response.json({ ok: true })
      },
    } as never)

    const response = await handler(
      new Request("https://vertical.example.com/api/auth/onboarding/complete", {
        body: JSON.stringify({ workspaceName: "Acme" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    )

    expect(called).toBe(true)
    expect(response?.status).toBe(200)
  })

  test("handles onboarding slug availability requests before the page app", async () => {
    let called = false
    const handler = createApiRequestHandler({
      handleOnboardingSlugAvailabilityRequest: async () => {
        called = true
        return Response.json({ data: { available: true }, ok: true })
      },
    } as never)

    const response = await handler(
      new Request(
        "https://vertical.example.com/api/auth/onboarding/slug-availability?kind=workspace&slug=curious-kangaroo",
        {
          method: "GET",
        },
      ),
    )

    expect(called).toBe(true)
    expect(response?.status).toBe(200)
    await expect(response?.json()).resolves.toEqual({ data: { available: true }, ok: true })
  })

  test("handles workspace invitation accept requests before the page app", async () => {
    let called = false
    const handler = createApiRequestHandler({
      handleInvitationAcceptRequest: async () => {
        called = true
        return Response.json({ ok: true })
      },
    } as never)

    const response = await handler(
      new Request("https://vertical.example.com/api/auth/invitations/accept", {
        body: JSON.stringify({ token: "raw_invite" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    )

    expect(called).toBe(true)
    expect(response?.status).toBe(200)
  })

  test("dispatches tRPC requests before the generic API 404", async () => {
    let called = false
    const handler = createApiRequestHandler({
      handleTrpcRequest: async () => {
        called = true
        return Response.json({ ok: true, transport: "trpc" })
      },
    } as never)

    const response = await handler(
      new Request("https://vertical.example.com/api/trpc/tasks.update", {
        body: JSON.stringify({ id: null, json: { taskId: "tsk_123", status: "todo" } }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    )

    expect(called).toBe(true)
    expect(response?.status).toBe(200)
    await expect(response?.json()).resolves.toEqual({ ok: true, transport: "trpc" })
  })

  test("does not route copied browser business selection", async () => {
    const handler = createApiRequestHandler()

    const response = await handler(
      new Request("https://contextbase.localhost/api/auth/business/select", {
        body: JSON.stringify({ businessSlug: "legacy-business" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    )

    expect(response?.status).toBe(404)
  })

  test("does not expose the old internal task online projection table query", async () => {
    const handler = createApiRequestHandler()

    const response = await handler(
      new Request("https://vertical.example.com/api/tables/tasks/query", {
        body: JSON.stringify({ businessId: "biz_123", input: {} }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    )

    expect(response?.status).toBe(404)
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: "not_found" },
      ok: false,
    })
  })

  test("does not expose the legacy task table fallback endpoint", async () => {
    const handler = createApiRequestHandler()

    const response = await handler(
      new Request("https://vertical.example.com/api/tables/tasks", {
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    )

    expect(response?.status).toBe(404)
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: "not_found" },
      ok: false,
    })
  })

  test("returns null for page requests", async () => {
    const handler = createApiRequestHandler()

    await expect(
      handler(new Request("https://vertical.example.com/acme/tasks")),
    ).resolves.toBeNull()
  })
})
