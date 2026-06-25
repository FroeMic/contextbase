import type {
  WorkspaceInvitationCreateBody,
  WorkspaceInvitationListResponse,
  WorkspaceInvitationResponse,
} from "@contextbase/contracts"
import { describe, expect, expectTypeOf, test } from "vitest"

import { createApiClient } from "../client"
import { createWorkspaceInvitationClient } from "./invitations"

describe("workspace invitation api client", () => {
  test("exposes invitation contract envelope types", () => {
    const client = createWorkspaceInvitationClient(
      createApiClient({ baseUrl: "http://local.test" }),
    )

    expectTypeOf<
      Parameters<typeof client.create>[0]
    >().toEqualTypeOf<WorkspaceInvitationCreateBody>()
    expectTypeOf<
      Awaited<ReturnType<typeof client.create>>
    >().toEqualTypeOf<WorkspaceInvitationResponse>()
    expectTypeOf<
      Awaited<ReturnType<typeof client.list>>
    >().toEqualTypeOf<WorkspaceInvitationListResponse>()
    expectTypeOf<
      Awaited<ReturnType<typeof client.revoke>>
    >().toEqualTypeOf<WorkspaceInvitationResponse>()
  })

  test("calls invitation endpoints", async () => {
    const calls: unknown[] = []
    const client = createWorkspaceInvitationClient(
      createApiClient({
        baseUrl: "http://local.test",
        fetch: async (input, init) => {
          calls.push({ input, init })
          return new Response(JSON.stringify({ data: { id: "win_123" }, ok: true }))
        },
      }),
    )

    await client.list()
    await client.create({ email: "new@example.com", role: "workspace_member" })
    await client.revoke("win_123")

    expect(calls).toMatchObject([
      {
        init: { method: "GET" },
        input: "http://local.test/api/v1/workspace-invitations",
      },
      {
        init: {
          body: JSON.stringify({ email: "new@example.com", role: "workspace_member" }),
          method: "POST",
        },
        input: "http://local.test/api/v1/workspace-invitations",
      },
      {
        init: {
          body: JSON.stringify({}),
          method: "POST",
        },
        input: "http://local.test/api/v1/workspace-invitations/win_123/revoke",
      },
    ])
  })
})
