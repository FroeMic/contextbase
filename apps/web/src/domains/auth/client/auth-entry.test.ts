import { describe, expect, test } from "vitest"

import { createDefaultFeatureFlagSnapshot } from "../../feature-flags/client/feature-flag-snapshot"
import type { AuthSession } from "./auth-api"
import { selectAuthEntrySelectorMode, selectLoginSingleWorkspaceRedirect } from "./auth-entry"

const session: AuthSession = {
  activeWorkspaceId: "wrk_123",
  activeWorkspaceRole: "workspace_admin",
  activeWorkspaceSlug: "core",
  email: "m@example.com",
  expiresAt: "2026-02-01T00:00:00.000Z",
  featureFlags: createDefaultFeatureFlagSnapshot(),
  sessionId: "ses_123",
  userId: "usr_123",
  workspaces: [
    { role: "workspace_admin", workspaceId: "wrk_123", workspaceSlug: "core" },
    { role: "workspace_admin", workspaceId: "wrk_456", workspaceSlug: "studio" },
  ],
}

describe("auth entry page selection", () => {
  test("always shows workspace selection for signed-in users", () => {
    expect(selectAuthEntrySelectorMode(session)).toBe("workspace")
    expect(
      selectAuthEntrySelectorMode(
        {
          ...session,
          workspaces: [{ role: "workspace_admin", workspaceId: "wrk_123", workspaceSlug: "core" }],
        },
        "/oauth/authorize/resume?request_id=oar_123",
      ),
    ).toBe("workspace")
  })

  test("only auto-forwards login when exactly one workspace is accessible", () => {
    expect(selectLoginSingleWorkspaceRedirect(session)).toBeNull()
    expect(
      selectLoginSingleWorkspaceRedirect({
        activeWorkspaceId: "wrk_123",
        workspaces: [{ role: "workspace_admin", workspaceId: "wrk_123", workspaceSlug: "core" }],
      }),
    ).toBe("/app/core")
  })
})
