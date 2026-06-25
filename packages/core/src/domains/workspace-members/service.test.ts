import { Effect } from "effect"
import { describe, expect, test } from "vitest"

import type { AuthenticatedContext } from "../auth/authenticate"
import {
  disableWorkspaceMember,
  listWorkspaceMembers,
  reactivateWorkspaceMember,
  updateWorkspaceMember,
} from "./service"

const adminContext: AuthenticatedContext = {
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
  principalKind: "user" as const,
  role: "workspace_member",
  status: "active",
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

describe("workspace member service", () => {
  test("lists workspace members for workspace admins", async () => {
    await expect(
      Effect.runPromise(
        listWorkspaceMembers(
          {
            listWorkspaceMembers: async (context) => [
              { ...member, workspaceId: context.workspaceId },
            ],
          },
          adminContext,
        ),
      ),
    ).resolves.toEqual([member])
  })

  test("rejects member administration for non-admin principals", async () => {
    const viewer = { ...adminContext, role: "workspace_member" }

    await expect(
      Effect.runPromise(
        Effect.either(
          listWorkspaceMembers(
            {
              listWorkspaceMembers: async () => {
                throw new Error("should not list")
              },
            },
            viewer,
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { _tag: "ForbiddenError" },
    })
  })

  test("updates roles without copied event writes", async () => {
    const writes: string[] = []
    const result = await Effect.runPromise(
      updateWorkspaceMember(
        {
          findWorkspaceMemberById: async () => member,
          updateWorkspaceMember: async (_context, input) => {
            const updated = { ...member, role: input.role ?? member.role }
            writes.push(`role:${updated.role}`)
            return updated
          },
        },
        adminContext,
        {
          membershipId: "mbr_123",
          role: "workspace_admin",
        },
      ),
    )

    expect(result.role).toBe("workspace_admin")
    expect(writes).toEqual(["role:workspace_admin"])
  })

  test("disables and reactivates members through direct lifecycle updates", async () => {
    const writes: string[] = []
    const disabledMember = { ...member, status: "disabled" }

    const disabled = await Effect.runPromise(
      disableWorkspaceMember(
        {
          findWorkspaceMemberById: async () => member,
          updateWorkspaceMember: async (_context, input) => {
            const updated = { ...member, status: input.status ?? member.status }
            writes.push(`status:${updated.status}`)
            return updated
          },
        },
        adminContext,
        { membershipId: "mbr_123" },
      ),
    )

    const reactivated = await Effect.runPromise(
      reactivateWorkspaceMember(
        {
          findWorkspaceMemberById: async () => disabledMember,
          updateWorkspaceMember: async (_context, input) => {
            const updated = { ...disabledMember, status: input.status ?? disabledMember.status }
            writes.push(`status:${updated.status}`)
            return updated
          },
        },
        adminContext,
        { membershipId: "mbr_123" },
      ),
    )

    expect(disabled.status).toBe("disabled")
    expect(reactivated.status).toBe("active")
    expect(writes).toEqual(["status:disabled", "status:active"])
  })

  test("prevents admins from disabling or demoting their own membership", async () => {
    const selfMember = {
      ...member,
      id: "mbr_admin",
      principalId: adminContext.principalId,
      role: "workspace_admin",
    }

    await expect(
      Effect.runPromise(
        Effect.either(
          disableWorkspaceMember(
            {
              findWorkspaceMemberById: async () => selfMember,
              updateWorkspaceMember: async () => {
                throw new Error("should not disable current admin")
              },
            },
            adminContext,
            { membershipId: "mbr_admin" },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { _tag: "InvariantViolationError", code: "invariant_violation" },
    })

    await expect(
      Effect.runPromise(
        Effect.either(
          updateWorkspaceMember(
            {
              findWorkspaceMemberById: async () => selfMember,
              updateWorkspaceMember: async () => {
                throw new Error("should not demote current admin")
              },
            },
            adminContext,
            { membershipId: "mbr_admin", role: "workspace_member" },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { _tag: "InvariantViolationError", code: "invariant_violation" },
    })
  })
})
