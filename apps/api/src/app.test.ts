import { InternalError } from "@contextbase/core/shared/errors"
import { describe, expect, test, vi } from "vitest"

import { createApiApp } from "./app"
import type { ApiErrorReporter } from "./http/error-reporter"

function createErrorReporter(): ApiErrorReporter {
  return {
    captureException: vi.fn(async () => undefined),
    flush: vi.fn(async () => undefined),
  }
}

describe("api app", () => {
  test("returns success envelope from health endpoint", async () => {
    const response = await createApiApp().request("/healthz")

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        service: "api",
        status: "ok",
      },
    })
  })

  test("returns typed error envelope for missing routes", async () => {
    const response = await createApiApp().request("/missing")

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "not_found",
        message: "Route not found",
        details: {},
      },
    })
  })

  test("returns 401 envelope when authenticated route has no API token", async () => {
    const response = await createApiApp().request("/api/v1/auth/probe")

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "unauthenticated",
        message: "Missing API token",
        details: {},
      },
    })
  })

  test("returns authenticated scope context from probe route", async () => {
    const response = await createApiApp({
      authenticateApiToken: (token) => {
        expect(token).toBe("test-token")

        return Promise.resolve({
          principalId: "usr_test",
          principalKind: "user",
          role: "workspace_admin",
          workspaceId: "wrk_test",
          workspaceSlug: "core",
        })
      },
    }).request("/api/v1/auth/probe", {
      headers: {
        authorization: "Bearer test-token",
      },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        principalId: "usr_test",
        principalKind: "user",
        role: "workspace_admin",
        workspaceId: "wrk_test",
        workspaceSlug: "core",
      },
    })
  })

  test("enforces admin scope before direct API routers handle workspace administration", async () => {
    let storeCalled = false
    const response = await createApiApp({
      authenticateApiToken: async () => ({
        principalId: "usr_test",
        principalKind: "user",
        role: "workspace_admin",
        scopes: ["contextbase:read"],
        workspaceId: "wrk_test",
        workspaceSlug: "core",
      }),
      workspaceStore: {
        createWorkspace: async () => {
          storeCalled = true
          throw new Error("scope middleware should reject before workspace store")
        },
        findWorkspaceByIdOrSlug: async () => null,
      },
    }).request("/api/v1/workspaces", {
      body: JSON.stringify({ name: "Blocked", slug: "blocked" }),
      headers: {
        authorization: "Bearer read-only",
        "content-type": "application/json",
      },
      method: "POST",
    })

    expect(response.status).toBe(403)
    expect(storeCalled).toBe(false)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "forbidden",
        details: { requiredScope: "contextbase:manage" },
      },
      ok: false,
    })
  })

  test("enforces read scope before direct API routers handle reads", async () => {
    let storeCalled = false
    const response = await createApiApp({
      authenticateApiToken: async () => ({
        principalId: "usr_test",
        principalKind: "user",
        role: "workspace_admin",
        scopes: ["contextbase:write"],
        workspaceId: "wrk_test",
        workspaceSlug: "core",
      }),
      workspaceStore: {
        findWorkspaceByIdOrSlug: async () => null,
        listWorkspaces: async () => {
          storeCalled = true
          return []
        },
      },
    }).request("/api/v1/workspaces", {
      headers: {
        authorization: "Bearer write-only",
      },
    })

    expect(response.status).toBe(403)
    expect(storeCalled).toBe(false)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "forbidden",
        details: { requiredScope: "contextbase:read" },
      },
      ok: false,
    })
  })

  test("captures API 500 responses exactly once through the app-level reporter", async () => {
    const errorReporter = createErrorReporter()
    const response = await createApiApp({
      authenticateApiToken: async () => {
        throw new InternalError({
          code: "internal_error",
          message: "Authenticator database failed",
        })
      },
      errorReporter,
    }).request("/api/v1/auth/probe", {
      headers: {
        authorization: "Bearer test-token",
      },
    })

    expect(response.status).toBe(500)
    expect(errorReporter.captureException).toHaveBeenCalledTimes(1)
    expect(errorReporter.captureException).toHaveBeenCalledWith(expect.any(Error), {
      method: "GET",
      path: "/api/v1/auth/probe",
      routeKind: "route_500_response",
      serviceName: "contextbase-api",
      status: 500,
    })
  })

  test("does not capture health checks or API 4xx responses", async () => {
    const errorReporter = createErrorReporter()
    const app = createApiApp({ errorReporter })

    expect((await app.request("/healthz")).status).toBe(200)
    expect((await app.request("/api/v1/auth/probe")).status).toBe(401)

    expect(errorReporter.captureException).not.toHaveBeenCalled()
  })

  test("captures uncaught Hono errors with the JSON error envelope", async () => {
    const errorReporter = createErrorReporter()
    const app = createApiApp({ errorReporter })
    app.get("/explode", () => {
      throw new Error("uncaught route failure")
    })

    const response = await app.request("/explode")

    expect(response.status).toBe(500)
    expect(response.headers.get("cache-control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "internal_error",
        details: {},
        message: "Internal server error",
      },
    })
    expect(errorReporter.captureException).toHaveBeenCalledTimes(1)
    expect(errorReporter.captureException).toHaveBeenCalledWith(expect.any(Error), {
      method: "GET",
      path: "/explode",
      routeKind: "hono_uncaught",
      serviceName: "contextbase-api",
      status: 500,
    })
  })
})
