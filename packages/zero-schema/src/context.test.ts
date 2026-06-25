import { describe, expect, test } from "vitest"

import { canReadWorkspaceRow } from "./context"

const context = {
  activeWorkspaceId: "wrk_123",
  activeWorkspaceRole: "workspace_member",
  activeWorkspaceSlug: "core",
  capabilities: ["contextbase:read"],
  userId: "usr_123",
}

describe("Zero authorization context", () => {
  test("allows workspace rows only in the active workspace", () => {
    expect(canReadWorkspaceRow(context, { workspaceId: "wrk_123" })).toBe(true)
    expect(canReadWorkspaceRow(context, { workspaceId: "wrk_other" })).toBe(false)
  })
})
