import { AuthenticationError, NotFoundError } from "@contextbase/core/shared/errors"
import { Effect, Schema } from "effect"
import { Hono } from "hono"
import { describe, expect, test } from "vitest"

import { getApiErrorReportContext } from "./error-reporter"
import { route } from "./route"

const authContext = {
  principalId: "usr_123",
  principalKind: "user",
  role: "workspace_admin",
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

describe("route helper", () => {
  test("returns 401 envelope and request id when bearer token is missing", async () => {
    const app = new Hono()
    app.get(
      "/things",
      route(
        {
          handler: () => Effect.succeed({ id: "thing_123" }),
          response: "success",
        },
        {
          requestId: () => "req_missing_auth",
        },
      ),
    )

    const response = await app.request("/things")

    expect(response.status).toBe(401)
    expect(response.headers.get("x-request-id")).toBe("req_missing_auth")
    expect(response.headers.get("cache-control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "unauthenticated",
        details: {},
        message: "Missing API token",
      },
    })
  })

  test("decodes query params and returns a success envelope", async () => {
    const app = new Hono()
    app.get(
      "/things",
      route(
        {
          handler: ({ auth, query, requestId }) =>
            Effect.succeed({
              owner: auth.workspaceSlug,
              query,
              requestId,
            }),
          query: Schema.Struct({
            state: Schema.Literal("ready", "blocked"),
          }),
          response: "success",
        },
        {
          authenticateApiToken: async (token) => {
            expect(token).toBe("test-token")
            return authContext
          },
          requestId: () => "req_success",
        },
      ),
    )

    const response = await app.request("/things?state=ready", {
      headers: { authorization: "Bearer test-token" },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("x-request-id")).toBe("req_success")
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        owner: "core",
        query: { state: "ready" },
        requestId: "req_success",
      },
    })
  })

  test("uses configured success status codes", async () => {
    const app = new Hono()
    app.post(
      "/things",
      route(
        {
          handler: () => Effect.succeed({ id: "thing_123" }),
          response: "success",
          status: 201,
        },
        {
          authenticateApiToken: async () => authContext,
          requestId: () => "req_created",
        },
      ),
    )

    const response = await app.request("/things", {
      headers: { authorization: "Bearer test-token" },
      method: "POST",
    })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { id: "thing_123" },
    })
  })

  test("rejects bearer tokens missing the required route scope", async () => {
    const app = new Hono()
    app.post(
      "/things",
      route(
        {
          handler: () => Effect.succeed({ id: "thing_123" }),
          response: "success",
        },
        {
          authenticateApiToken: async () => ({
            ...authContext,
            scopes: ["contextbase:read"],
          }),
          requestId: () => "req_forbidden_scope",
        },
      ),
    )

    const response = await app.request("/things", {
      headers: { authorization: "Bearer test-token" },
      method: "POST",
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "forbidden",
        message: "Bearer token is missing required scope contextbase:write",
      },
      ok: false,
    })
  })

  test("returns 400 envelope when query decoding fails", async () => {
    const app = new Hono()
    app.get(
      "/things",
      route(
        {
          handler: () => Effect.succeed({ id: "thing_123" }),
          query: Schema.Struct({
            status: Schema.Literal("ready"),
          }),
          response: "success",
        },
        {
          authenticateApiToken: async () => authContext,
          requestId: () => "req_bad_query",
        },
      ),
    )

    const response = await app.request("/things?status=blocked", {
      headers: { authorization: "Bearer test-token" },
    })

    expect(response.status).toBe(400)
    expect(response.headers.get("x-request-id")).toBe("req_bad_query")
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: {
        code: "invalid_request",
        message: "Invalid request query",
      },
    })
  })

  test("returns 400 envelope when body decoding fails", async () => {
    const app = new Hono()
    app.post(
      "/things",
      route(
        {
          body: Schema.Struct({
            title: Schema.String,
          }),
          handler: () => Effect.succeed({ id: "thing_123" }),
          response: "success",
        },
        {
          authenticateApiToken: async () => authContext,
          requestId: () => "req_bad_body",
        },
      ),
    )

    const response = await app.request("/things", {
      body: JSON.stringify({ title: 123 }),
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      method: "POST",
    })

    expect(response.status).toBe(400)
    expect(response.headers.get("x-request-id")).toBe("req_bad_body")
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: {
        code: "invalid_request",
        message: "Invalid request body",
      },
    })
  })

  test("uses an empty body for optional body routes without json content", async () => {
    const app = new Hono()
    app.post(
      "/things/:thingId/complete",
      route(
        {
          body: Schema.Struct({
            comment: Schema.optional(Schema.String),
          }),
          bodyOptional: true,
          handler: ({ body, params }) =>
            Effect.succeed({
              body,
              params,
            }),
          params: Schema.Struct({
            thingId: Schema.String,
          }),
          response: "success",
        },
        {
          authenticateApiToken: async () => authContext,
          requestId: () => "req_optional_body",
        },
      ),
    )

    const response = await app.request("/things/thing_123/complete", {
      headers: { authorization: "Bearer test-token" },
      method: "POST",
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        body: {},
        params: { thingId: "thing_123" },
      },
    })
  })

  test("returns list envelope with next cursor from paged list handlers", async () => {
    const app = new Hono()
    app.get(
      "/things",
      route(
        {
          handler: () =>
            Effect.succeed({
              data: [{ id: "thing_123" }],
              page: { nextCursor: "cursor_123" },
            }),
          response: "list",
        },
        {
          authenticateApiToken: async () => authContext,
          requestId: () => "req_list",
        },
      ),
    )

    const response = await app.request("/things", {
      headers: { authorization: "Bearer test-token" },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: [{ id: "thing_123" }],
      page: { next_cursor: "cursor_123" },
    })
  })

  test("maps typed handler errors with the shared error envelope", async () => {
    const app = new Hono()
    app.get(
      "/things/:thingId",
      route(
        {
          handler: ({ params }) =>
            Effect.fail(
              new NotFoundError({
                code: "not_found",
                details: params,
                message: "Thing not found",
              }),
            ),
          params: Schema.Struct({
            thingId: Schema.String,
          }),
          response: "success",
        },
        {
          authenticateApiToken: async () => authContext,
          requestId: () => "req_not_found",
        },
      ),
    )

    const response = await app.request("/things/thing_missing", {
      headers: { authorization: "Bearer test-token" },
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "not_found",
        details: { thingId: "thing_missing" },
        message: "Thing not found",
      },
    })
  })

  test("normalizes authenticator failures and unknown defects to envelopes", async () => {
    const authApp = new Hono()
    authApp.get(
      "/things",
      route(
        {
          handler: () => Effect.succeed({ id: "thing_123" }),
          response: "success",
        },
        {
          authenticateApiToken: async () => {
            throw new AuthenticationError({
              code: "unauthenticated",
              message: "Invalid API token",
            })
          },
          requestId: () => "req_bad_auth",
        },
      ),
    )

    const authResponse = await authApp.request("/things", {
      headers: { authorization: "Bearer bad-token" },
    })

    expect(authResponse.status).toBe(401)
    await expect(authResponse.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "unauthenticated", message: "Invalid API token" },
    })

    const defectApp = new Hono()
    defectApp.get(
      "/things",
      route(
        {
          handler: () =>
            Effect.sync(() => {
              throw new Error("database exploded")
            }),
          response: "success",
        },
        {
          authenticateApiToken: async () => authContext,
          requestId: () => "req_defect",
        },
      ),
    )

    const defectResponse = await defectApp.request("/things", {
      headers: { authorization: "Bearer test-token" },
    })

    expect(defectResponse.status).toBe(500)
    expect(defectResponse.headers.get("x-request-id")).toBe("req_defect")
    await expect(defectResponse.json()).resolves.toMatchObject({
      ok: false,
      error: {
        code: "internal_error",
        message: "Internal server error",
      },
    })
  })

  test("stashes route defect context for app-level 500 reporting", async () => {
    const app = new Hono()
    let reportContext: unknown

    app.use("*", async (context, next) => {
      await next()
      reportContext = getApiErrorReportContext(context)
    })
    app.get(
      "/things",
      route(
        {
          handler: () =>
            Effect.sync(() => {
              throw new Error("database exploded")
            }),
          response: "success",
        },
        {
          authenticateApiToken: async () => authContext,
          requestId: () => "req_defect_context",
        },
      ),
    )

    const response = await app.request("/things?token=secret", {
      headers: { authorization: "Bearer test-token" },
    })

    expect(response.status).toBe(500)
    expect(reportContext).toMatchObject({
      auth: {
        principalId: "usr_123",
        principalKind: "user",
        workspaceId: "wrk_123",
        workspaceSlug: "core",
      },
      error: expect.any(Error),
      errorCode: "internal_error",
      method: "GET",
      path: "/things",
      requestId: "req_defect_context",
    })
  })

  test("does not stash report context for non-500 route errors", async () => {
    const app = new Hono()
    let reportContext: unknown

    app.use("*", async (context, next) => {
      await next()
      reportContext = getApiErrorReportContext(context)
    })
    app.get(
      "/things/:thingId",
      route(
        {
          handler: ({ params }) =>
            Effect.fail(
              new NotFoundError({
                code: "not_found",
                details: params,
                message: "Thing not found",
              }),
            ),
          params: Schema.Struct({
            thingId: Schema.String,
          }),
          response: "success",
        },
        {
          authenticateApiToken: async () => authContext,
          requestId: () => "req_not_found_context",
        },
      ),
    )

    const response = await app.request("/things/missing", {
      headers: { authorization: "Bearer test-token" },
    })

    expect(response.status).toBe(404)
    expect(reportContext).toBeUndefined()
  })
})
