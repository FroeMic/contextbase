import { describe, expect, test } from "vitest"

import { createApiRequestHandler } from "./server-api"

describe("server API file route dispatch", () => {
  test("dispatches account avatar uploads before JSON body-size guards", async () => {
    let dispatched = false
    const handler = createApiRequestHandler({
      handleBrowserFileRequest: async () => {
        dispatched = true
        return new Response(null, { status: 204 })
      },
    })

    const response = await handler(
      new Request("https://contextbase.localhost/api/settings/account/avatar", {
        headers: { "content-length": "999999" },
        method: "POST",
      }),
    )

    expect(dispatched).toBe(true)
    expect(response?.status).toBe(204)
  })

  test("does not dispatch copied product file upload routes", async () => {
    const dispatched: string[] = []
    const handler = createApiRequestHandler({
      handleBrowserFileRequest: async (request) => {
        dispatched.push(new URL(request.url).pathname)
        return new Response(null, { status: 204 })
      },
    })

    for (const path of [
      "/api/files/chats/drafts",
      "/api/files/tasks/tsk_123/files",
      "/api/files/contacts/cnt_123/files",
      "/api/files/organizations/org_123/files",
      "/api/settings/agents/agt_123/avatar",
      "/api/settings/businesses/biz_123/avatar",
    ]) {
      const response = await handler(
        new Request(`https://contextbase.localhost${path}`, {
          headers: { "content-length": "999999" },
          method: "POST",
        }),
      )

      expect(response?.status, path).toBe(413)
    }
    expect(dispatched).toEqual([])
  })

  test("dispatches public avatar assets outside the authenticated API router", async () => {
    let dispatched = false
    const handler = createApiRequestHandler({
      handlePublicAvatarRequest: async () => {
        dispatched = true
        return new Response("avatar", { status: 200 })
      },
    })

    const response = await handler(
      new Request("https://contextbase.localhost/public/avatars/avt_abc123", {
        method: "GET",
      }),
    )

    expect(dispatched).toBe(true)
    expect(response?.status).toBe(200)
    await expect(response?.text()).resolves.toBe("avatar")
  })
})
