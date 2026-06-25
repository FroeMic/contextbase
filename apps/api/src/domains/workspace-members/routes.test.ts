import type { AuthenticatedContext } from "@contextbase/core/domains/auth/authenticate"
import { describe, expect, test } from "vitest"

import { createApiApp } from "../../app"

const authContext: AuthenticatedContext = {
  principalId: "usr_admin",
  principalKind: "user",
  role: "workspace_admin",
  scopes: ["contextbase:read", "contextbase:manage"],
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

const member = {
  displayName: "Member",
  email: "member@example.com",
  id: "mbr_123",
  principalId: "usr_member",
  principalKind: "user",
  role: "workspace_member",
  status: "active",
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

describe("workspace member routes", () => {
  test("lists workspace members through a success envelope", async () => {
    const response = await createApiApp({
      authenticateApiToken: async () => authContext,
      workspaceMemberStore: {
        listWorkspaceMembers: async () => [member],
      },
    }).request("/api/v1/workspace-members", {
      headers: { authorization: "Bearer token" },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: [member],
      ok: true,
      page: { next_cursor: null },
    })
  })

  test("updates, disables, and reactivates workspace members", async () => {
    const writes: string[] = []
    const app = createApiApp({
      authenticateApiToken: async () => authContext,
      workspaceMemberStore: {
        findWorkspaceMemberById: async () => member,
        updateWorkspaceMember: async (_context, input) => {
          const updated = {
            ...member,
            ...(input.role ? { role: input.role } : {}),
            ...(input.status ? { status: input.status } : {}),
          }
          writes.push(input.role ? `role:${updated.role}` : `status:${updated.status}`)
          return updated
        },
      },
    })

    const updated = await app.request("/api/v1/workspace-members/mbr_123", {
      body: JSON.stringify({ role: "workspace_admin" }),
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      method: "PATCH",
    })
    const disabled = await app.request("/api/v1/workspace-members/mbr_123/disable", {
      headers: { authorization: "Bearer token" },
      method: "POST",
    })
    const reactivated = await app.request("/api/v1/workspace-members/mbr_123/reactivate", {
      headers: { authorization: "Bearer token" },
      method: "POST",
    })

    expect(updated.status).toBe(200)
    await expect(updated.json()).resolves.toMatchObject({ data: { role: "workspace_admin" } })
    expect(disabled.status).toBe(200)
    await expect(disabled.json()).resolves.toMatchObject({ data: { status: "disabled" } })
    expect(reactivated.status).toBe(200)
    await expect(reactivated.json()).resolves.toMatchObject({ data: { status: "active" } })
    expect(writes).toEqual(["role:workspace_admin", "status:disabled", "status:active"])
  })

  test("rejects invalid workspace member roles before updating", async () => {
    const app = createApiApp({
      authenticateApiToken: async () => authContext,
      workspaceMemberStore: {
        findWorkspaceMemberById: async () => {
          throw new Error("should not load member for invalid role")
        },
        updateWorkspaceMember: async () => {
          throw new Error("should not update member for invalid role")
        },
      },
    })

    const response = await app.request("/api/v1/workspace-members/mbr_123", {
      body: JSON.stringify({ role: "foo" }),
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      method: "PATCH",
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "invalid_request",
      },
      ok: false,
    })
  })
})
