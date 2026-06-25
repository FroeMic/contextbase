import { Effect } from "effect"
import { describe, expect, test } from "vitest"

import {
  archiveWorkspace,
  createWorkspace,
  reactivateWorkspace,
  renameWorkspaceSlug,
} from "./service"

describe("workspace service", () => {
  test("creates a workspace without copied event writes", async () => {
    const writes: string[] = []
    const result = await Effect.runPromise(
      createWorkspace(
        {
          createWorkspace: async () => {
            writes.push("workspace")
            return {
              id: "wrk_123",
              status: "active",
              workspaceName: "Core",
              workspaceSlug: "core",
            }
          },
          findWorkspaceByIdOrSlug: async () => null,
        },
        {
          principalId: "usr_123",
          principalKind: "user",
          role: "workspace_admin",
          workspaceId: "wrk_auth",
          workspaceSlug: "auth",
        },
        {
          workspaceName: "Core",
          workspaceSlug: "core",
        },
      ),
    )

    expect(result).toEqual({
      id: "wrk_123",
      status: "active",
      workspaceName: "Core",
      workspaceSlug: "core",
    })
    expect(writes).toEqual(["workspace"])
  })

  test("rejects scoped workspace creation without vertical admin", async () => {
    let created = false

    await expect(
      Effect.runPromise(
        Effect.either(
          createWorkspace(
            {
              createWorkspace: async () => {
                created = true
                throw new Error("should not create")
              },
              findWorkspaceByIdOrSlug: async () => null,
            },
            {
              principalId: "usr_123",
              principalKind: "user",
              role: "workspace_admin",
              scopes: ["contextbase:read", "contextbase:write"],
              workspaceId: "wrk_auth",
              workspaceSlug: "auth",
            },
            {
              workspaceName: "Core",
              workspaceSlug: "core",
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "ForbiddenError",
        code: "forbidden",
      },
    })
    expect(created).toBe(false)
  })

  test("rejects duplicate workspace slugs", async () => {
    await expect(
      Effect.runPromise(
        Effect.either(
          createWorkspace(
            {
              createWorkspace: async () => {
                throw new Error("should not create")
              },
              findWorkspaceByIdOrSlug: async () => ({
                id: "wrk_existing",
                status: "active",
                workspaceName: "Existing",
                workspaceSlug: "core",
              }),
            },
            {
              principalId: "usr_123",
              principalKind: "user",
              role: "workspace_admin",
              workspaceId: "wrk_auth",
              workspaceSlug: "auth",
            },
            {
              workspaceName: "Core",
              workspaceSlug: "core",
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "ConflictError",
        code: "conflict",
      },
    })
  })

  test("renames a workspace slug and records an alias without copied event writes", async () => {
    const writes: string[] = []
    const result = await Effect.runPromise(
      renameWorkspaceSlug(
        {
          findWorkspaceByIdOrSlug: async (idOrSlug) =>
            idOrSlug === "new-core"
              ? null
              : {
                  id: "wrk_123",
                  status: "active",
                  workspaceName: "Core",
                  workspaceSlug: "core",
                },
          renameWorkspaceSlug: async () => {
            writes.push("alias")
            return {
              id: "wrk_123",
              status: "active",
              workspaceName: "Core",
              workspaceSlug: "new-core",
            }
          },
        },
        {
          principalId: "usr_123",
          principalKind: "user",
          role: "workspace_admin",
          workspaceId: "wrk_123",
          workspaceSlug: "core",
        },
        {
          newSlug: "new-core",
          workspaceIdOrSlug: "core",
        },
      ),
    )

    expect(result.workspaceSlug).toBe("new-core")
    expect(writes).toEqual(["alias"])
  })

  test("archives and reactivates a workspace through direct lifecycle updates", async () => {
    const writes: string[] = []
    const activeWorkspace = {
      id: "wrk_123",
      status: "active" as const,
      workspaceName: "Core",
      workspaceSlug: "core",
    }
    const archivedWorkspace = {
      ...activeWorkspace,
      status: "archived" as const,
    }

    const archived = await Effect.runPromise(
      archiveWorkspace(
        {
          findWorkspaceByIdOrSlug: async () => activeWorkspace,
          updateWorkspace: async (input) => {
            const workspace = {
              ...activeWorkspace,
              status: input.status ?? activeWorkspace.status,
            }
            writes.push(`status:${workspace.status}`)
            return workspace
          },
        },
        {
          principalId: "usr_123",
          principalKind: "user",
          role: "workspace_admin",
          workspaceId: "wrk_123",
          workspaceSlug: "core",
        },
        { workspaceIdOrSlug: "core" },
      ),
    )

    const reactivated = await Effect.runPromise(
      reactivateWorkspace(
        {
          findWorkspaceByIdOrSlug: async () => archivedWorkspace,
          updateWorkspace: async (input) => {
            const workspace = {
              ...archivedWorkspace,
              status: input.status ?? archivedWorkspace.status,
            }
            writes.push(`status:${workspace.status}`)
            return workspace
          },
        },
        {
          principalId: "usr_123",
          principalKind: "user",
          role: "workspace_admin",
          workspaceId: "wrk_123",
          workspaceSlug: "core",
        },
        { workspaceIdOrSlug: "core" },
      ),
    )

    expect(archived).toMatchObject({ status: "archived" })
    expect(reactivated).toMatchObject({ status: "active" })
    expect(writes).toEqual(["status:archived", "status:active"])
  })

  test("rejects renaming a workspace outside the authenticated scope", async () => {
    await expect(
      Effect.runPromise(
        Effect.either(
          renameWorkspaceSlug(
            {
              findWorkspaceByIdOrSlug: async () => ({
                id: "wrk_other",
                status: "active",
                workspaceName: "Other",
                workspaceSlug: "other",
              }),
              renameWorkspaceSlug: async () => {
                throw new Error("should not rename")
              },
            },
            {
              principalId: "usr_123",
              principalKind: "user",
              role: "workspace_admin",
              workspaceId: "wrk_123",
              workspaceSlug: "core",
            },
            {
              newSlug: "other-new",
              workspaceIdOrSlug: "other",
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "ForbiddenError",
        code: "forbidden",
      },
    })
  })

  test("uses direct workspace creation without copied event-aware stores", async () => {
    const writes: string[] = []
    const result = await Effect.runPromise(
      createWorkspace(
        {
          createWorkspace: async () => {
            writes.push("create")
            return {
              id: "wrk_123",
              status: "active",
              workspaceName: "Core",
              workspaceSlug: "core",
            }
          },
          findWorkspaceByIdOrSlug: async () => null,
        },
        {
          principalId: "usr_123",
          principalKind: "user",
          role: "workspace_admin",
          workspaceId: "wrk_auth",
          workspaceSlug: "auth",
        },
        {
          workspaceName: "Core",
          workspaceSlug: "core",
        },
      ),
    )

    expect(result.id).toBe("wrk_123")
    expect(writes).toEqual(["create"])
  })
})
