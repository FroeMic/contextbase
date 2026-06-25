import { describe, expect, test } from "vitest"

import { createApiClient } from "./client"

describe("api client", () => {
  test("adds bearer token and parses success envelopes", async () => {
    const client = createApiClient({
      baseUrl: "http://local.test",
      fetch: async (input, init) => {
        expect(input).toBe("http://local.test/healthz")
        expect(init?.headers).toEqual({ authorization: "Bearer token_123" })

        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              status: "ok",
            },
          }),
          { status: 200 },
        )
      },
      token: "token_123",
    })

    await expect(client.get("/healthz")).resolves.toEqual({
      ok: true,
      data: {
        status: "ok",
      },
    })
  })

  test("throws structured errors for failed API responses", async () => {
    const client = createApiClient({
      baseUrl: "http://local.test",
      fetch: async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "not_found",
              details: { taskId: "tsk_missing" },
              message: "Task not found",
            },
            ok: false,
          }),
          { status: 404 },
        ),
    })

    await expect(client.get("/api/v1/tasks/tsk_missing")).rejects.toMatchObject({
      body: {
        error: {
          code: "not_found",
          details: { taskId: "tsk_missing" },
          message: "Task not found",
        },
        ok: false,
      },
      message: "Task not found",
      status: 404,
    })
  })

  test("posts form data without overriding multipart content type", async () => {
    const formData = new FormData()
    formData.set("file", new File([new Uint8Array([1, 2, 3])], "file.txt"))
    const calls: unknown[] = []
    const client = createApiClient({
      baseUrl: "http://local.test",
      fetch: async (input, init) => {
        calls.push({ input, init })
        return new Response(JSON.stringify({ data: { id: "fla_123" }, ok: true }))
      },
      token: "token_123",
    })

    await client.postForm("/api/v1/tasks/tsk_123/files", formData)

    expect(calls).toMatchObject([
      {
        init: {
          body: formData,
          headers: { authorization: "Bearer token_123" },
          method: "POST",
        },
        input: "http://local.test/api/v1/tasks/tsk_123/files",
      },
    ])
  })

  test("gets raw responses and preserves JSON error envelopes", async () => {
    const rawClient = createApiClient({
      baseUrl: "http://local.test",
      fetch: async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "content-type": "application/octet-stream" },
          status: 200,
        }),
    })
    const errorClient = createApiClient({
      baseUrl: "http://local.test",
      fetch: async () =>
        new Response(
          JSON.stringify({
            error: { code: "not_found", message: "File not found" },
            ok: false,
          }),
          { headers: { "content-type": "application/json" }, status: 404 },
        ),
    })

    await expect(rawClient.getRaw("/api/v1/files/fil_123/content")).resolves.toMatchObject({
      status: 200,
    })
    await expect(errorClient.getRaw("/api/v1/files/fil_missing/content")).rejects.toMatchObject({
      body: {
        error: { code: "not_found", message: "File not found" },
        ok: false,
      },
      message: "File not found",
      status: 404,
    })
  })
})
