import { describe, expect, test } from "vitest"

import { resolveCreateSessionState, resolveLoginSessionState } from "./login-session"

describe("login session state", () => {
  test("keeps a valid session when feature flag evaluation fails", async () => {
    const state = await resolveLoginSessionState({
      evaluateFeatureFlags: async () => {
        throw new Error("feature flag table missing")
      },
      rawSessionTokens: ["raw_session"],
      validateSession: async () => ({
        activeWorkspaceId: "wrk_123",
        activeWorkspaceRole: "workspace_admin",
        activeWorkspaceSlug: "core",
        email: "m@example.com",
        expiresAt: new Date("2026-02-01T00:00:00.000Z"),
        sessionId: "ses_123",
        userId: "usr_123",
        workspaces: [],
      }),
    })

    expect(state).toEqual({
      session: expect.objectContaining({
        email: "m@example.com",
        expiresAt: "2026-02-01T00:00:00.000Z",
        featureFlags: {
          evaluatedAt: expect.any(String),
          values: {
            "developer.browserFlagOverrides": false,
          },
          version: "defaults",
        },
        userId: "usr_123",
      }),
    })
  })

  test("marks create route as onboarding when the onboarding cookie is present", () => {
    const session = {
      activeWorkspaceId: "wrk_123",
      activeWorkspaceRole: "workspace_admin",
      activeWorkspaceSlug: "core",
      email: "m@example.com",
      expiresAt: "2026-02-01T00:00:00.000Z",
      featureFlags: {
        evaluatedAt: "2026-01-01T00:00:00.000Z",
        values: {
          "developer.browserFlagOverrides": false,
        },
        version: "test",
      },
      sessionId: "ses_123",
      userId: "usr_123",
      workspaces: [],
    }

    expect(
      resolveCreateSessionState({
        cookieHeader: "contextbase_onboarding_session=raw_onboarding",
        generatedWorkspaceSlug: "bright-atlas",
        onboardingEmail: "signup@example.com",
        loginState: { session },
      }),
    ).toEqual({
      generatedWorkspaceSlug: "bright-atlas",
      onboardingEmail: "signup@example.com",
      onboardingRequired: true,
      session,
    })
  })
})
