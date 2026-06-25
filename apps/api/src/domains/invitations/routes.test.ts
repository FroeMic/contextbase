import { afterEach, describe, expect, test, vi } from "vitest"

import { createApiApp } from "../../app"

const authContext = {
  principalId: "usr_admin",
  principalKind: "user",
  role: "workspace_admin",
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

const invitation = {
  acceptedAt: null,
  email: "new@example.com",
  emailNormalized: "new@example.com",
  expiresAt: new Date("2026-06-13T10:00:00.000Z"),
  id: "win_123",
  invitedByUserId: "usr_admin",
  revokedAt: null,
  role: "workspace_member" as const,
  status: "pending",
  tokenHash: "hash",
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

describe("workspace invitation routes", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test("lists invitations through a list envelope", async () => {
    const response = await createApiApp({
      authenticateApiToken: async () => authContext,
      invitationStore: {
        listInvitations: async () => [invitation],
      },
    }).request("/api/v1/workspace-invitations", {
      headers: { authorization: "Bearer token" },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          email: "new@example.com",
          id: "win_123",
          status: "pending",
        },
      ],
      ok: true,
      page: { next_cursor: null },
    })
  })

  test("creates invitations without returning the raw token", async () => {
    const sent: unknown[] = []
    const response = await createApiApp({
      authenticateApiToken: async () => authContext,
      invitationStore: {
        createInvitation: async (_context, input) => ({
          ...invitation,
          email: input.email,
          emailNormalized: input.emailNormalized,
          expiresAt: input.expiresAt,
          role: input.role,
          tokenHash: input.tokenHash,
        }),
      },
      sendWorkspaceInvitationEmail: async (message) => {
        sent.push(message)
      },
    }).request("/api/v1/workspace-invitations", {
      body: JSON.stringify({ email: "new@example.com", role: "workspace_member" }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      method: "POST",
    })

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(JSON.stringify(body)).not.toContain("rawToken")
    expect(JSON.stringify(body)).not.toContain("tokenHash")
    expect(sent).toMatchObject([
      {
        email: "new@example.com",
        linkUrl: expect.stringContaining("/auth/invitations/accept?token="),
      },
    ])
  })

  test("builds invitation links from the web app origin when app base URL is unset", async () => {
    vi.stubEnv("CONTEXTBASE_APP_BASE_URL", undefined)
    vi.stubEnv("CONTEXTBASE_WEB_BASE_URL", undefined)
    const sent: Array<{ linkUrl: string }> = []

    const response = await createApiApp({
      authenticateApiToken: async () => authContext,
      invitationStore: {
        createInvitation: async (_context, input) => ({
          ...invitation,
          email: input.email,
          emailNormalized: input.emailNormalized,
          expiresAt: input.expiresAt,
          role: input.role,
          tokenHash: input.tokenHash,
        }),
      },
      sendWorkspaceInvitationEmail: async (message) => {
        sent.push(message)
      },
    }).request("http://127.0.0.1:3017/api/v1/workspace-invitations", {
      body: JSON.stringify({ email: "new@example.com", role: "workspace_member" }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      method: "POST",
    })

    expect(response.status).toBe(201)
    expect(sent[0]?.linkUrl).toContain("http://127.0.0.1:4017/auth/invitations/accept")
  })

  test("revokes created invitations when delivery fails", async () => {
    const revoked: unknown[] = []
    const response = await createApiApp({
      authenticateApiToken: async () => authContext,
      invitationStore: {
        createInvitation: async (_context, input) => ({
          ...invitation,
          email: input.email,
          emailNormalized: input.emailNormalized,
          expiresAt: input.expiresAt,
          role: input.role,
          tokenHash: input.tokenHash,
        }),
        revokeInvitation: async (_context, input) => {
          revoked.push(input)
          return {
            ...invitation,
            revokedAt: input.now,
            status: "revoked",
          }
        },
      },
      sendWorkspaceInvitationEmail: async () => {
        throw new Error("delivery failed")
      },
    }).request("/api/v1/workspace-invitations", {
      body: JSON.stringify({ email: "new@example.com", role: "workspace_member" }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      method: "POST",
    })

    expect(response.status).toBe(500)
    expect(revoked).toEqual([
      expect.objectContaining({
        invitationId: "win_123",
      }),
    ])
  })

  test("revokes invitations", async () => {
    const response = await createApiApp({
      authenticateApiToken: async () => authContext,
      invitationStore: {
        revokeInvitation: async () => ({
          ...invitation,
          revokedAt: new Date("2026-06-06T10:00:00.000Z"),
          status: "revoked",
        }),
      },
    }).request("/api/v1/workspace-invitations/win_123/revoke", {
      headers: { authorization: "Bearer token" },
      method: "POST",
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: "win_123",
        status: "revoked",
      },
      ok: true,
    })
  })
})
