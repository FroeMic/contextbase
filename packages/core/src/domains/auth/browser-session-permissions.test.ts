import { describe, expect, test } from "vitest"

import type { BrowserSessionContext } from "./browser-session"
import { requireBrowserWorkspaceAdminAccess } from "./browser-session-permissions"

const session: BrowserSessionContext = {
  activeWorkspaceId: "wrk_123",
  activeWorkspaceRole: "owner",
  activeWorkspaceSlug: "core",
  email: "m@example.com",
  expiresAt: new Date("2026-02-01T00:00:00.000Z"),
  sessionId: "ses_123",
  userId: "usr_123",
  workspaces: [{ role: "owner", workspaceId: "wrk_123", workspaceSlug: "core" }],
}

describe("browser session permissions", () => {
  test("requires a workspace admin role for workspace settings writes", () => {
    expect(() =>
      requireBrowserWorkspaceAdminAccess({
        ...session,
        activeWorkspaceRole: "workspace_member",
      }),
    ).toThrow(
      expect.objectContaining({
        _tag: "ForbiddenError",
        code: "forbidden",
      }),
    )
    expect(() =>
      requireBrowserWorkspaceAdminAccess({
        ...session,
        activeWorkspaceRole: "workspace_admin",
      }),
    ).not.toThrow()
  })
})
