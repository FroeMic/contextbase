import { Schema } from "effect"
import { describe, expect, test } from "vitest"

import {
  WorkspaceCreateBodySchema,
  WorkspaceDtoSchema,
  WorkspaceListResponseSchema,
  WorkspaceRenameSlugBodySchema,
  WorkspaceUpdateBodySchema,
} from "./contract.js"

describe("workspace boundary contracts", () => {
  test("decodes workspace bodies and list envelopes", () => {
    const create = Schema.decodeUnknownSync(WorkspaceCreateBodySchema)({
      workspaceName: "Core",
      workspaceSlug: "core",
    })
    const dto = Schema.decodeUnknownSync(WorkspaceDtoSchema)({
      id: "wrk_123",
      status: "archived",
      workspaceName: "Core",
      workspaceSlug: "core",
    })
    const update = Schema.decodeUnknownSync(WorkspaceUpdateBodySchema)({
      workspaceName: "New Core",
    })
    const rename = Schema.decodeUnknownSync(WorkspaceRenameSlugBodySchema)({
      newSlug: "new-core",
    })
    const list = Schema.decodeUnknownSync(WorkspaceListResponseSchema)({
      data: [{ id: "wrk_123", status: "active", workspaceName: "Core", workspaceSlug: "core" }],
      ok: true,
      page: { next_cursor: null },
    })

    expect(create.workspaceSlug).toBe("core")
    expect(dto.status).toBe("archived")
    expect(update.workspaceName).toBe("New Core")
    expect(rename.newSlug).toBe("new-core")
    expect(list.data[0]?.id).toBe("wrk_123")
  })
})
