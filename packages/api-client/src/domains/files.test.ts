import { describe, expect, test } from "vitest"

import { createApiClient } from "../client"
import { createFileClient } from "./files"

describe("file api client", () => {
  test("exposes only authenticated file content downloads", async () => {
    const calls: unknown[] = []
    const client = createFileClient(
      createApiClient({
        baseUrl: "http://local.test",
        fetch: async (input, init) => {
          calls.push({ input, init })
          return new Response(
            JSON.stringify({
              data: { contentUrl: "/api/v1/files/fil_123/content", id: "fla_123" },
              ok: true,
              page: { next_cursor: null },
            }),
          )
        },
      }),
    )

    await client.download("fil_123")

    expect(calls).toMatchObject([
      { init: { method: "GET" }, input: "http://local.test/api/v1/files/fil_123/content" },
    ])
    expect(client).not.toHaveProperty("attachments")
    expect(client).not.toHaveProperty("inline")
    expect(client).not.toHaveProperty("upload")
  })

  test("downloads file content through raw responses", async () => {
    const calls: unknown[] = []
    const client = createFileClient(
      createApiClient({
        baseUrl: "http://local.test",
        fetch: async (input, init) => {
          calls.push({ input, init })
          return new Response(new Uint8Array([1, 2, 3]), { status: 200 })
        },
      }),
    )

    const response = await client.downloadFile("fil_123")

    expect(response.status).toBe(200)
    expect(calls).toMatchObject([
      {
        init: { method: "GET" },
        input: "http://local.test/api/v1/files/fil_123/content",
      },
    ])
  })
})
