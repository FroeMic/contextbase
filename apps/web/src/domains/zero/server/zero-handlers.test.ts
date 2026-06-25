import type { BrowserSessionContext } from "@contextbase/core"
import { describe, expect, test } from "vitest"

import { buildZeroContextFromSession } from "./zero-handlers"

const session: BrowserSessionContext = {
  activeWorkspaceId: "wrk_123",
  activeWorkspaceRole: "workspace_admin",
  activeWorkspaceSlug: "core",
  email: "m@example.com",
  expiresAt: new Date("2026-02-01T00:00:00.000Z"),
  sessionId: "ses_123",
  userId: "usr_123",
  workspaces: [{ role: "workspace_admin", workspaceId: "wrk_123", workspaceSlug: "core" }],
}

describe("Zero server handlers", () => {
  test("derives Zero context from the verified server session", () => {
    expect(buildZeroContextFromSession(session)).toEqual({
      activeWorkspaceId: "wrk_123",
      activeWorkspaceRole: "workspace_admin",
      activeWorkspaceSlug: "core",
      capabilities: ["contextbase:read"],
      userId: "usr_123",
    })
  })
})
