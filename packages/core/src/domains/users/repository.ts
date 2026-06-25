import { and, eq, isNull, sql } from "drizzle-orm"

import type { DbClient } from "../../db/client"
import { fileObjects, users, workspaceMemberships } from "../../db/schema"
import { normalizeUserEmail, type UserStore } from "./service"

export function createPostgresUserStore(client: DbClient): UserStore {
  return {
    createUserWithMembership: async (context, input) => {
      const emailNormalized = normalizeUserEmail(input.email)
      const [user] = await client.db.transaction(async (tx) => {
        const [insertedUser] = await tx
          .insert(users)
          .values({
            displayName: input.displayName,
            email: input.email ?? null,
            emailNormalized,
            primaryChannelKind: input.primaryChannelKind ?? null,
            primaryChannelRef: input.primaryChannelRef ?? null,
          })
          .returning(userSelection)

        if (!insertedUser) {
          throw new Error("User insert failed")
        }

        await tx.insert(workspaceMemberships).values({
          principalId: insertedUser.id,
          principalKind: "user",
          role: input.role ?? "workspace_admin",
          workspaceId: context.workspaceId,
          workspaceSlug: context.workspaceSlug,
        })

        return [insertedUser]
      })

      if (!user) {
        throw new Error("User creation failed")
      }

      return user
    },
    findUserByIdInWorkspace: async (context, userId) => {
      const [user] = await client.db
        .select(userWithAvatarSelection)
        .from(users)
        .innerJoin(
          workspaceMemberships,
          and(
            eq(workspaceMemberships.principalId, users.id),
            eq(workspaceMemberships.principalKind, "user"),
            eq(workspaceMemberships.workspaceId, context.workspaceId),
            eq(workspaceMemberships.status, "active"),
          ),
        )
        .leftJoin(fileObjects, userAvatarFileJoinCondition)
        .where(eq(users.id, userId))

      return user ?? null
    },
    listUsers: async (context) => {
      const workspaceJoin = and(
        eq(workspaceMemberships.principalId, users.id),
        eq(workspaceMemberships.principalKind, "user"),
        eq(workspaceMemberships.workspaceId, context.workspaceId),
        eq(workspaceMemberships.status, "active"),
      )

      return client.db
        .select(userWithAvatarSelection)
        .from(users)
        .innerJoin(workspaceMemberships, workspaceJoin)
        .leftJoin(fileObjects, userAvatarFileJoinCondition)
    },
    updateUser: async (_context, input) => {
      const emailNormalized =
        input.email !== undefined ? normalizeUserEmail(input.email) : undefined
      const [user] = await client.db
        .update(users)
        .set({
          ...(input.displayName ? { displayName: input.displayName } : {}),
          ...(input.email !== undefined ? { email: input.email, emailNormalized } : {}),
          ...(input.primaryChannelKind !== undefined
            ? { primaryChannelKind: input.primaryChannelKind }
            : {}),
          ...(input.primaryChannelRef !== undefined
            ? { primaryChannelRef: input.primaryChannelRef }
            : {}),
          ...(input.status ? { status: input.status } : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, input.userId))
        .returning(userSelection)

      if (!user) {
        throw new Error("User update failed")
      }

      return user
    },
  }
}

const userSelection = {
  avatarFileObjectId: users.avatarFileObjectId,
  avatarPublicAssetId: sql<string | null>`null`,
  displayName: users.displayName,
  email: users.email,
  emailNormalized: users.emailNormalized,
  emailVerifiedAt: users.emailVerifiedAt,
  id: users.id,
  lastLoginAt: users.lastLoginAt,
  primaryChannelKind: users.primaryChannelKind,
  primaryChannelRef: users.primaryChannelRef,
  status: users.status,
}

const userWithAvatarSelection = {
  ...userSelection,
  avatarPublicAssetId: fileObjects.publicAssetId,
}

const userAvatarFileJoinCondition = and(
  eq(fileObjects.id, users.avatarFileObjectId),
  eq(fileObjects.visibility, "public"),
  eq(fileObjects.usageKind, "avatar"),
  eq(fileObjects.storageStatus, "available"),
  isNull(fileObjects.deletedAt),
)
