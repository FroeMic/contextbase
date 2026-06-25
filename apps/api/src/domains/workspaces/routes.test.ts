import { describe, expect, test } from "vitest"

import { createApiApp } from "../../app"

const authContext = {
  principalId: "usr_123",
  principalKind: "user",
  role: "workspace_admin",
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

describe("workspace routes", () => {
  test("lists workspaces through a success envelope", async () => {
    const response = await createApiApp({
      authenticateApiToken: async () => authContext,
      workspaceStore: {
        findWorkspaceByIdOrSlug: async () => null,
        listWorkspaces: async () => [
          {
            id: "wrk_123",
            status: "active",
            workspaceName: "Core",
            workspaceSlug: "core",
          },
        ],
      },
    }).request("/api/v1/workspaces", {
      headers: {
        authorization: "Bearer token",
      },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: [
        {
          id: "wrk_123",
          status: "active",
          workspaceName: "Core",
          workspaceSlug: "core",
        },
      ],
      page: {
        next_cursor: null,
      },
    })
  })

  test("creates a workspace through a success envelope", async () => {
    const response = await createApiApp({
      authenticateApiToken: async () => authContext,
      workspaceStore: {
        createWorkspace: async (input) => ({
          id: "wrk_new",
          status: "active",
          workspaceName: input.workspaceName,
          workspaceSlug: input.workspaceSlug,
        }),
        findWorkspaceByIdOrSlug: async () => null,
      },
    }).request("/api/v1/workspaces", {
      body: JSON.stringify({
        workspaceName: "New Core",
        workspaceSlug: "new-core",
      }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      method: "POST",
    })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        id: "wrk_new",
        status: "active",
        workspaceName: "New Core",
        workspaceSlug: "new-core",
      },
    })
  })

  test("archives and reactivates a workspace through explicit endpoints", async () => {
    const writes: string[] = []
    const response = await createApiApp({
      authenticateApiToken: async () => authContext,
      workspaceStore: {
        findWorkspaceByIdOrSlug: async () => ({
          id: "wrk_123",
          status: writes.includes("archive") ? "archived" : "active",
          workspaceName: "Core",
          workspaceSlug: "core",
        }),
        updateWorkspace: async (input) => {
          writes.push(input.status === "archived" ? "archive" : "reactivate")
          return {
            id: "wrk_123",
            status: input.status ?? "active",
            workspaceName: "Core",
            workspaceSlug: "core",
          }
        },
      },
    })

    const archived = await response.request("/api/v1/workspaces/core/archive", {
      headers: { authorization: "Bearer token" },
      method: "POST",
    })
    const reactivated = await response.request("/api/v1/workspaces/core/reactivate", {
      headers: { authorization: "Bearer token" },
      method: "POST",
    })

    expect(archived.status).toBe(200)
    await expect(archived.json()).resolves.toMatchObject({
      data: { status: "archived" },
      ok: true,
    })
    expect(reactivated.status).toBe(200)
    await expect(reactivated.json()).resolves.toMatchObject({
      data: { status: "active" },
      ok: true,
    })
    expect(writes).toEqual(["archive", "reactivate"])
  })
})
