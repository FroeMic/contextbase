import { eq, or } from "drizzle-orm"

import type { DbClient } from "../../db/client"
import { workspaceSlugAliases, workspaces } from "../../db/schema"
import type { WorkspaceStore } from "./service"

export function createPostgresWorkspaceStore(client: DbClient): WorkspaceStore {
  return {
    createWorkspace: async (input) => {
      const [workspace] = await client.db
        .insert(workspaces)
        .values({
          workspaceName: input.workspaceName,
          workspaceSlug: input.workspaceSlug,
        })
        .returning({
          id: workspaces.id,
          status: workspaces.status,
          workspaceName: workspaces.workspaceName,
          workspaceSlug: workspaces.workspaceSlug,
        })

      if (!workspace) {
        throw new Error("Workspace insert failed")
      }

      return workspace
    },
    findWorkspaceByIdOrSlug: async (idOrSlug) => {
      const workspace = await client.db.query.workspaces.findFirst({
        where: or(eq(workspaces.id, idOrSlug), eq(workspaces.workspaceSlug, idOrSlug)),
        columns: {
          id: true,
          status: true,
          workspaceName: true,
          workspaceSlug: true,
        },
      })

      return workspace ?? null
    },
    listWorkspaces: async (context) =>
      client.db
        .select({
          id: workspaces.id,
          status: workspaces.status,
          workspaceName: workspaces.workspaceName,
          workspaceSlug: workspaces.workspaceSlug,
        })
        .from(workspaces)
        .where(eq(workspaces.id, context.workspaceId)),
    renameWorkspaceSlug: async (input) =>
      client.db.transaction(async (tx) => {
        await tx.insert(workspaceSlugAliases).values({
          newSlug: input.newSlug,
          oldSlug: input.oldSlug,
          workspaceId: input.workspaceId,
        })

        const [workspace] = await tx
          .update(workspaces)
          .set({
            updatedAt: new Date(),
            workspaceSlug: input.newSlug,
          })
          .where(eq(workspaces.id, input.workspaceId))
          .returning({
            id: workspaces.id,
            status: workspaces.status,
            workspaceName: workspaces.workspaceName,
            workspaceSlug: workspaces.workspaceSlug,
          })

        if (!workspace) {
          throw new Error("Workspace rename failed")
        }

        return workspace
      }),
    updateWorkspace: async (input) => {
      const [workspace] = await client.db
        .update(workspaces)
        .set({
          ...(input.workspaceName ? { workspaceName: input.workspaceName } : {}),
          ...(input.status ? { status: input.status } : {}),
          updatedAt: new Date(),
        })
        .where(
          or(
            eq(workspaces.id, input.workspaceIdOrSlug),
            eq(workspaces.workspaceSlug, input.workspaceIdOrSlug),
          ),
        )
        .returning({
          id: workspaces.id,
          status: workspaces.status,
          workspaceName: workspaces.workspaceName,
          workspaceSlug: workspaces.workspaceSlug,
        })

      if (!workspace) {
        throw new Error("Workspace update failed")
      }

      return workspace
    },
  }
}
