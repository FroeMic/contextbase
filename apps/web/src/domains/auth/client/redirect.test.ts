import { afterEach, describe, expect, test, vi } from "vitest"

import { createDefaultFeatureFlagSnapshot } from "../../feature-flags/client/feature-flag-snapshot"
import type { AuthSession } from "./auth-api"
import {
  rememberWorkspaceSelection,
  selectPostLoginRedirect,
  selectWorkspaceRedirect,
} from "./redirect"

const session: AuthSession = {
  activeWorkspaceId: "wrk_123",
  activeWorkspaceRole: "workspace_admin",
  activeWorkspaceSlug: "core",
  email: "m@example.com",
  expiresAt: "2026-02-01T00:00:00.000Z",
  featureFlags: createDefaultFeatureFlagSnapshot(),
  sessionId: "ses_123",
  userId: "usr_123",
  workspaces: [{ role: "workspace_admin", workspaceId: "wrk_123", workspaceSlug: "core" }],
}

describe("auth redirect selection", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test("prefers a safe redirect inside an accessible workspace app route", () => {
    expect(selectPostLoginRedirect(session, "/app/core/accounts/waa_123")).toBe(
      "/app/core/accounts/waa_123",
    )
  })

  test("preserves OAuth authorization resume redirects after login", () => {
    expect(selectPostLoginRedirect(session, "/oauth/authorize/resume?request_id=oar_123")).toBe(
      "/oauth/authorize/resume?request_id=oar_123",
    )
  })

  test("normalizes same-origin absolute OAuth redirects after login", () => {
    vi.stubGlobal("location", { origin: "https://startwithvertical.test" })

    expect(
      selectPostLoginRedirect(
        session,
        "https://startwithvertical.test/oauth/authorize/resume?request_id=oar_123",
      ),
    ).toBe("/oauth/authorize/resume?request_id=oar_123")
  })

  test("preserves configured auth-origin OAuth redirects after login", () => {
    vi.stubGlobal("location", { origin: "http://127.0.0.1:4017" })

    expect(
      selectPostLoginRedirect(
        session,
        "http://127.0.0.1:3317/oauth/authorize/resume?request_id=oar_split_origin",
      ),
    ).toBe("http://127.0.0.1:3317/oauth/authorize/resume?request_id=oar_split_origin")
  })

  test("falls back to the active workspace app page", () => {
    expect(selectPostLoginRedirect(session, "https://evil.example.com")).toBe("/app/core")
  })

  test("prefers an accessible workspace redirect before showing the multi-workspace chooser", () => {
    expect(
      selectPostLoginRedirect(
        {
          ...session,
          workspaces: [
            { role: "workspace_admin", workspaceId: "wrk_123", workspaceSlug: "core" },
            { role: "workspace_admin", workspaceId: "wrk_456", workspaceSlug: "studio" },
          ],
        },
        "/app/studio/settings/account/profile",
      ),
    ).toBe("/app/studio/settings/account/profile")
  })

  test("sends multi-workspace sessions without a usable redirect to the workspace chooser", () => {
    expect(
      selectPostLoginRedirect(
        {
          ...session,
          workspaces: [
            { role: "workspace_admin", workspaceId: "wrk_123", workspaceSlug: "core" },
            { role: "workspace_admin", workspaceId: "wrk_456", workspaceSlug: "studio" },
          ],
        },
        null,
      ),
    ).toBe("/workspaces/select")
  })

  test("uses remembered workspace preference before showing the chooser", () => {
    expect(
      selectPostLoginRedirect(
        {
          ...session,
          workspaces: [
            { role: "workspace_admin", workspaceId: "wrk_123", workspaceSlug: "core" },
            { role: "workspace_admin", workspaceId: "wrk_456", workspaceSlug: "studio" },
          ],
        },
        null,
        {
          lastWorkspaceId: "wrk_456",
        },
      ),
    ).toBe("/app/studio")
  })

  test("selects a workspace redirect after workspace choice without looping", () => {
    expect(
      selectWorkspaceRedirect(
        {
          ...session,
          activeWorkspaceId: "wrk_456",
          activeWorkspaceSlug: "studio",
          workspaces: [
            { role: "workspace_admin", workspaceId: "wrk_123", workspaceSlug: "core" },
            { role: "workspace_admin", workspaceId: "wrk_456", workspaceSlug: "studio" },
          ],
        },
        "/app/studio/accounts/waa_123",
      ),
    ).toBe("/app/studio/accounts/waa_123")
  })

  test("selects OAuth authorization resume after workspace choice", () => {
    expect(selectWorkspaceRedirect(session, "/oauth/authorize/resume?request_id=oar_123")).toBe(
      "/oauth/authorize/resume?request_id=oar_123",
    )
  })

  test("stores remembered workspace preference with a product-scoped key", () => {
    const storage = new Map<string, string>()

    rememberWorkspaceSelection(
      { workspaceId: "wrk_123" },
      {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
      },
    )

    expect(storage.get("contextbase:lastWorkspaceId")).toBe("wrk_123")
  })
})
