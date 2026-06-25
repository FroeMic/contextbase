import { QueryClient } from "@tanstack/react-query"
import { describe, expect, test, vi } from "vitest"

import type { AuthSession } from "../../domains/auth/client/auth-api"
import { sessionQueryKey, sessionQueryOptions } from "../../domains/auth/client/use-session"
import { createDefaultFeatureFlagSnapshot } from "../../domains/feature-flags/client/feature-flag-snapshot"
import { requireWorkspaceBootstrap, resolveWorkspaceBootstrap } from "./workspace-bootstrap"

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
    { role: "workspace_member", workspaceId: "wrk_456", workspaceSlug: "support" },
  ],
}

describe("workspace bootstrap helpers", () => {
  test("session query options still fetch the current browser session with the shared key", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: session,
            ok: true,
          }),
        ),
    )
    const options = sessionQueryOptions({ fetcher })

    await expect(options.queryFn?.({} as never)).resolves.toEqual(session)
    expect(options.queryKey).toEqual(sessionQueryKey)
    expect(options.retry).toBe(false)
    expect(options.staleTime).toBe(30_000)
  })

  test("resolves the active workspace into a bootstrap payload without business scope", () => {
    expect(resolveWorkspaceBootstrap(session, "core")).toEqual({
      activeWorkspace: {
        role: "workspace_admin",
        workspaceId: "wrk_123",
        workspaceSlug: "core",
      },
      kind: "active",
      session: {
        activeWorkspaceId: "wrk_123",
        activeWorkspaceRole: "workspace_admin",
        activeWorkspaceSlug: "core",
        email: "m@example.com",
        expiresAt: "2026-02-01T00:00:00.000Z",
        featureFlags: session.featureFlags,
        sessionId: "ses_123",
        userId: "usr_123",
        workspaces: [
          { role: "workspace_admin", workspaceId: "wrk_123", workspaceSlug: "core" },
          { role: "workspace_member", workspaceId: "wrk_456", workspaceSlug: "support" },
        ],
      },
      zero: {
        activeWorkspaceId: "wrk_123",
        activeWorkspaceRole: "workspace_admin",
        activeWorkspaceSlug: "core",
        sessionId: "ses_123",
        storageKey: "usr_123:ses_123:wrk_123",
        userId: "usr_123",
      },
    })
  })

  test("keeps cross-workspace targets explicit for route lifecycle handling", () => {
    expect(resolveWorkspaceBootstrap(session, "support")).toEqual({
      kind: "switch",
      target: {
        role: "workspace_member",
        workspaceId: "wrk_456",
        workspaceSlug: "support",
      },
    })
  })

  test("keeps unavailable workspace slugs explicit", () => {
    expect(resolveWorkspaceBootstrap(session, "missing")).toEqual({ kind: "unavailable" })
  })

  test("requires workspace bootstrap through QueryClient.ensureQueryData", async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(sessionQueryKey, session)

    await expect(
      requireWorkspaceBootstrap({
        queryClient,
        workspaceSlug: "core",
      }),
    ).resolves.toMatchObject({
      activeWorkspace: { workspaceId: "wrk_123" },
      session: { sessionId: "ses_123" },
    })
  })

  test("does not expose legacy business session fields to workspace consumers", () => {
    const resolution = resolveWorkspaceBootstrap(session, "core")
    expect(resolution.kind).toBe("active")
    if (resolution.kind !== "active") return

    expect("businesses" in resolution.session).toBe(false)
    expect("businessSwitchTargets" in resolution.session).toBe(false)
  })
})
