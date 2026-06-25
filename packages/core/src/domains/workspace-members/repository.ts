import { and, eq } from "drizzle-orm"

import type { DbClient } from "../../db/client"
import { users, workspaceMemberships } from "../../db/schema"
import type { WorkspaceMemberDto } from "./contracts"
import type { WorkspaceMemberStore } from "./service"

export function createPostgresWorkspaceMemberStore(client: DbClient): WorkspaceMemberStore {
  return {
    findWorkspaceMemberById: async (context, membershipId) => {
      const [member] = await client.db
        .select(workspaceMemberSelection)
        .from(workspaceMemberships)
        .innerJoin(
          users,
          and(
            eq(workspaceMemberships.principalKind, "user"),
            eq(workspaceMemberships.principalId, users.id),
          ),
        )
        .where(
          and(
            eq(workspaceMemberships.id, membershipId),
            eq(workspaceMemberships.workspaceId, context.workspaceId),
          ),
        )

      return member ?? null
    },
    listWorkspaceMembers: async (context) =>
      client.db
        .select(workspaceMemberSelection)
        .from(workspaceMemberships)
        .innerJoin(
          users,
          and(
            eq(workspaceMemberships.principalKind, "user"),
            eq(workspaceMemberships.principalId, users.id),
          ),
        )
        .where(eq(workspaceMemberships.workspaceId, context.workspaceId)),
    updateWorkspaceMember: async (context, input) =>
      client.db.transaction(async (tx) => {
        const [member] = await tx
          .update(workspaceMemberships)
          .set({
            ...(input.role ? { role: input.role } : {}),
            ...(input.status ? { status: input.status } : {}),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(workspaceMemberships.id, input.membershipId),
              eq(workspaceMemberships.workspaceId, context.workspaceId),
            ),
          )
          .returning({ id: workspaceMemberships.id })

        if (!member) {
          throw new Error("Workspace member update failed")
        }

        const [updated] = await tx
          .select(workspaceMemberSelection)
          .from(workspaceMemberships)
          .innerJoin(
            users,
            and(
              eq(workspaceMemberships.principalKind, "user"),
              eq(workspaceMemberships.principalId, users.id),
            ),
          )
          .where(eq(workspaceMemberships.id, member.id))

        if (!updated) {
          throw new Error("Workspace member read failed")
        }

        return updated
      }),
  }
}

const workspaceMemberSelection = {
  displayName: users.displayName,
  email: users.email,
  id: workspaceMemberships.id,
  principalId: workspaceMemberships.principalId,
  principalKind: workspaceMemberships.principalKind,
  role: workspaceMemberships.role,
  status: workspaceMemberships.status,
  workspaceId: workspaceMemberships.workspaceId,
  workspaceSlug: workspaceMemberships.workspaceSlug,
} satisfies Record<keyof WorkspaceMemberDto, unknown>
