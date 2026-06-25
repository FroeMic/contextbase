import type {
  WorkspaceMemberListResponse,
  WorkspaceMemberResponse,
  WorkspaceMemberUpdateBody,
} from "@contextbase/contracts"
import { describe, expect, expectTypeOf, test } from "vitest"

import { createApiClient } from "../client"
import { createWorkspaceMemberClient } from "./workspace-members"

describe("workspace member api client", () => {
  test("exposes workspace member contract envelope types", () => {
    const client = createWorkspaceMemberClient(createApiClient({ baseUrl: "http://local.test" }))

    expectTypeOf<
      Awaited<ReturnType<typeof client.list>>
    >().toEqualTypeOf<WorkspaceMemberListResponse>()
    expectTypeOf<Parameters<typeof client.update>[1]>().toEqualTypeOf<WorkspaceMemberUpdateBody>()
    expectTypeOf<
      Awaited<ReturnType<typeof client.update>>
    >().toEqualTypeOf<WorkspaceMemberResponse>()
  })

  test("calls workspace member lifecycle endpoints", async () => {
    const calls: unknown[] = []
    const client = createWorkspaceMemberClient(
      createApiClient({
        baseUrl: "http://local.test",
        fetch: async (input, init) => {
          calls.push({ input, init })
          return new Response(JSON.stringify({ data: { id: "mbr_123" }, ok: true }))
        },
      }),
    )

    await client.list()
    await client.update("mbr_123", { role: "workspace_admin" })
    await client.disable("mbr_123")
    await client.reactivate("mbr_123")

    expect(calls).toMatchObject([
      { input: "http://local.test/api/v1/workspace-members", init: { method: "GET" } },
      {
        input: "http://local.test/api/v1/workspace-members/mbr_123",
        init: { body: JSON.stringify({ role: "workspace_admin" }), method: "PATCH" },
      },
      {
        input: "http://local.test/api/v1/workspace-members/mbr_123/disable",
        init: { method: "POST" },
      },
      {
        input: "http://local.test/api/v1/workspace-members/mbr_123/reactivate",
        init: { method: "POST" },
      },
    ])
  })
})
