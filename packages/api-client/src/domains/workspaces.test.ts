import type {
  WorkspaceCreateBody,
  WorkspaceListResponse,
  WorkspaceRenameSlugBody,
  WorkspaceResponse,
  WorkspaceUpdateBody,
} from "@contextbase/contracts"
import { describe, expect, expectTypeOf, test } from "vitest"

import { createApiClient } from "../client"
import { createWorkspaceClient } from "./workspaces"

describe("workspace api client", () => {
  test("exposes workspace contract envelope types", () => {
    const client = createWorkspaceClient(createApiClient({ baseUrl: "http://local.test" }))

    expectTypeOf<Parameters<typeof client.create>[0]>().toEqualTypeOf<WorkspaceCreateBody>()
    expectTypeOf<Awaited<ReturnType<typeof client.create>>>().toEqualTypeOf<WorkspaceResponse>()
    expectTypeOf<Awaited<ReturnType<typeof client.list>>>().toEqualTypeOf<WorkspaceListResponse>()
    expectTypeOf<Parameters<typeof client.update>[1]>().toEqualTypeOf<WorkspaceUpdateBody>()
    expectTypeOf<Parameters<typeof client.renameSlug>[1]>().toEqualTypeOf<
      WorkspaceRenameSlugBody["newSlug"]
    >()
    expectTypeOf<Awaited<ReturnType<typeof client.archive>>>().toEqualTypeOf<WorkspaceResponse>()
    expectTypeOf<Awaited<ReturnType<typeof client.reactivate>>>().toEqualTypeOf<WorkspaceResponse>()
  })

  test("posts workspace creation payloads", async () => {
    const calls: unknown[] = []
    const client = createWorkspaceClient(
      createApiClient({
        baseUrl: "http://local.test",
        fetch: async (input, init) => {
          calls.push({ input, init })

          return new Response(
            JSON.stringify({
              ok: true,
              data: {
                id: "wrk_123",
                status: "active",
                workspaceName: "Core",
                workspaceSlug: "core",
              },
            }),
          )
        },
      }),
    )

    await client.create({
      workspaceName: "Core",
      workspaceSlug: "core",
    })

    expect(calls).toMatchObject([
      {
        input: "http://local.test/api/v1/workspaces",
        init: {
          body: JSON.stringify({
            workspaceName: "Core",
            workspaceSlug: "core",
          }),
          method: "POST",
        },
      },
    ])
  })

  test("posts explicit workspace lifecycle commands", async () => {
    const calls: unknown[] = []
    const client = createWorkspaceClient(
      createApiClient({
        baseUrl: "http://local.test",
        fetch: async (input, init) => {
          calls.push({ input, init })

          return new Response(
            JSON.stringify({
              data: {
                id: "wrk_123",
                status: "active",
                workspaceName: "Core",
                workspaceSlug: "core",
              },
              ok: true,
            }),
          )
        },
      }),
    )

    await client.archive("core")
    await client.reactivate("core")

    expect(calls).toMatchObject([
      {
        input: "http://local.test/api/v1/workspaces/core/archive",
        init: { method: "POST" },
      },
      {
        input: "http://local.test/api/v1/workspaces/core/reactivate",
        init: { method: "POST" },
      },
    ])
  })
})
