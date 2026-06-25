import { Schema } from "effect"
import { describe, expect, test } from "vitest"

import { WorkspaceMemberListResponseSchema, WorkspaceMemberUpdateBodySchema } from "./contract.js"

describe("workspace member boundary contracts", () => {
  test("decodes member update bodies and list envelopes", () => {
    const update = Schema.decodeUnknownSync(WorkspaceMemberUpdateBodySchema)({
      role: "workspace_admin",
    })
    const list = Schema.decodeUnknownSync(WorkspaceMemberListResponseSchema)({
      data: [
        {
          displayName: "Member",
          email: "member@example.com",
          id: "mbr_123",
          principalId: "usr_123",
          principalKind: "user",
          role: "workspace_member",
          status: "active",
          workspaceId: "wrk_123",
          workspaceSlug: "core",
        },
      ],
      ok: true,
      page: { next_cursor: null },
    })

    expect(update.role).toBe("workspace_admin")
    expect(list.data[0]?.id).toBe("mbr_123")
  })
})
