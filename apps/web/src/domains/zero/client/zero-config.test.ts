import { afterEach, describe, expect, test, vi } from "vitest"

import type { AuthSession } from "../../auth/client/auth-api"
import { createDefaultFeatureFlagSnapshot } from "../../feature-flags/client/feature-flag-snapshot"
import { buildZeroContext, buildZeroOptions } from "./zero-config"

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

describe("Zero client config", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test("derives scoped context from the verified browser session", () => {
    expect(buildZeroContext(session)).toEqual({
      activeWorkspaceId: "wrk_123",
      activeWorkspaceRole: "workspace_admin",
      activeWorkspaceSlug: "core",
      capabilities: ["contextbase:read"],
      userId: "usr_123",
    })
  })

  test("uses zero-cache configured query and mutate URLs", () => {
    const options = buildZeroOptions(session, {
      cacheURL: "http://localhost:4817",
    })

    expect(options).toMatchObject({
      auth: undefined,
      cacheURL: "http://localhost:4817",
      storageKey: "contextbase-zero-v2:usr_123:ses_123:wrk_123",
      userID: "usr_123",
    })
    expect(options).not.toHaveProperty("mutateURL")
    expect(options).not.toHaveProperty("queryURL")
  })

  test("normalizes local configured cache URL host to the browser host so session cookies reach Zero", () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "localhost",
        protocol: "http:",
      },
    })

    const options = buildZeroOptions(session, {
      cacheURL: "http://127.0.0.1:4917",
    })

    expect(options.cacheURL).toBe("http://localhost:4917")
  })

  test("derives the default cache URL from the browser host", () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "127.0.0.1",
        protocol: "http:",
      },
    })

    const options = buildZeroOptions(session)

    expect(options.cacheURL).toBe("http://127.0.0.1:4817")
  })
})
