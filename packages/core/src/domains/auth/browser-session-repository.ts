import { and, eq, gt, isNull, ne } from "drizzle-orm"

import type { DbClient } from "../../db/client"
import { authMagicLinks, authSessions, users, workspaceMemberships } from "../../db/schema"
import { AuthenticationError, ForbiddenError } from "../../shared/errors"
import type { BrowserAuthStore } from "./browser-session"

export function createPostgresBrowserAuthStore(client: DbClient): BrowserAuthStore {
  return {
    consumeMagicLinkForSession: async (input) =>
      client.db.transaction(async (tx) => {
        const [magicLink] = await tx
          .update(authMagicLinks)
          .set({
            consumedAt: input.now,
          })
          .where(
            and(
              eq(authMagicLinks.tokenHash, input.tokenHash),
              isNull(authMagicLinks.consumedAt),
              gt(authMagicLinks.expiresAt, input.now),
            ),
          )
          .returning({
            userId: authMagicLinks.userId,
            workspaceId: authMagicLinks.workspaceId,
            workspaceSlug: authMagicLinks.workspaceSlug,
          })

        if (!magicLink) {
          throw new AuthenticationError({
            code: "unauthenticated",
            message: "Invalid or expired magic link",
          })
        }

        const [session] = await tx
          .insert(authSessions)
          .values({
            activeWorkspaceId: magicLink.workspaceId,
            activeWorkspaceSlug: magicLink.workspaceSlug,
            expiresAt: input.sessionExpiresAt,
            sessionTokenHash: input.sessionTokenHash,
            userId: magicLink.userId,
          })
          .returning({
            activeWorkspaceId: authSessions.activeWorkspaceId,
            activeWorkspaceSlug: authSessions.activeWorkspaceSlug,
            expiresAt: authSessions.expiresAt,
            sessionId: authSessions.id,
            userId: authSessions.userId,
          })

        if (!session) {
          throw new Error("Session insert failed")
        }

        await tx
          .update(users)
          .set({
            emailVerifiedAt: input.now,
            lastLoginAt: input.now,
            updatedAt: input.now,
          })
          .where(eq(users.id, magicLink.userId))

        return session
      }),
    createPasswordBrowserSession: async (input) =>
      client.db.transaction(async (tx) => {
        const [session] = await tx
          .insert(authSessions)
          .values({
            activeWorkspaceId: input.workspaceId,
            activeWorkspaceSlug: input.workspaceSlug,
            expiresAt: input.sessionExpiresAt,
            sessionTokenHash: input.sessionTokenHash,
            userId: input.userId,
          })
          .returning({
            activeWorkspaceId: authSessions.activeWorkspaceId,
            activeWorkspaceSlug: authSessions.activeWorkspaceSlug,
            expiresAt: authSessions.expiresAt,
            sessionId: authSessions.id,
            userId: authSessions.userId,
          })

        if (!session) {
          throw new Error("Session insert failed")
        }

        await tx
          .update(users)
          .set({
            lastLoginAt: input.now,
            updatedAt: input.now,
          })
          .where(eq(users.id, input.userId))

        return session
      }),
    findLoginUserByEmail: async (emailNormalized) => {
      const rows = await client.db
        .select({
          email: users.email,
          emailNormalized: users.emailNormalized,
          passwordHash: users.passwordHash,
          role: workspaceMemberships.role,
          userId: users.id,
          workspaceId: workspaceMemberships.workspaceId,
          workspaceSlug: workspaceMemberships.workspaceSlug,
        })
        .from(users)
        .innerJoin(
          workspaceMemberships,
          and(
            eq(workspaceMemberships.principalKind, "user"),
            eq(workspaceMemberships.principalId, users.id),
            eq(workspaceMemberships.status, "active"),
          ),
        )
        .where(and(eq(users.emailNormalized, emailNormalized), eq(users.status, "active")))

      const first = rows[0]
      if (!first || !first.email || !first.emailNormalized) {
        return null
      }

      return {
        email: first.email,
        emailNormalized: first.emailNormalized,
        passwordHash: first.passwordHash,
        userId: first.userId,
        workspaces: rows.map((row) => ({
          role: row.role,
          workspaceId: row.workspaceId,
          workspaceSlug: row.workspaceSlug,
        })),
      }
    },
    findSessionByTokenHash: async (sessionTokenHash) => {
      const [session] = await client.db
        .select({
          activeWorkspaceId: authSessions.activeWorkspaceId,
          activeWorkspaceSlug: authSessions.activeWorkspaceSlug,
          email: users.email,
          expiresAt: authSessions.expiresAt,
          role: workspaceMemberships.role,
          sessionId: authSessions.id,
          userId: authSessions.userId,
        })
        .from(authSessions)
        .innerJoin(users, eq(users.id, authSessions.userId))
        .innerJoin(
          workspaceMemberships,
          and(
            eq(workspaceMemberships.workspaceId, authSessions.activeWorkspaceId),
            eq(workspaceMemberships.principalKind, "user"),
            eq(workspaceMemberships.principalId, authSessions.userId),
            eq(workspaceMemberships.status, "active"),
          ),
        )
        .where(
          and(
            eq(authSessions.sessionTokenHash, sessionTokenHash),
            eq(authSessions.status, "active"),
          ),
        )

      if (!session) {
        return null
      }

      const workspaceRows = await client.db
        .select({
          role: workspaceMemberships.role,
          workspaceId: workspaceMemberships.workspaceId,
          workspaceSlug: workspaceMemberships.workspaceSlug,
        })
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.principalKind, "user"),
            eq(workspaceMemberships.principalId, session.userId),
            eq(workspaceMemberships.status, "active"),
          ),
        )

      return {
        activeWorkspaceId: session.activeWorkspaceId,
        activeWorkspaceRole: session.role,
        activeWorkspaceSlug: session.activeWorkspaceSlug,
        email: session.email ?? "",
        expiresAt: session.expiresAt,
        sessionId: session.sessionId,
        userId: session.userId,
        workspaces: workspaceRows,
      }
    },
    insertMagicLink: async (input) => {
      await client.db.insert(authMagicLinks).values(input)
    },
    listActiveSessionsByUserId: async (userId) =>
      client.db
        .select({
          createdAt: authSessions.createdAt,
          expiresAt: authSessions.expiresAt,
          id: authSessions.id,
          ipAddress: authSessions.ipAddress,
          lastSeenAt: authSessions.lastSeenAt,
          userAgent: authSessions.userAgent,
        })
        .from(authSessions)
        .where(and(eq(authSessions.userId, userId), eq(authSessions.status, "active"))),
    revokeSessionByTokenHash: async (sessionTokenHash, now) => {
      await client.db
        .update(authSessions)
        .set({
          revokedAt: now,
          status: "revoked",
          updatedAt: now,
        })
        .where(eq(authSessions.sessionTokenHash, sessionTokenHash))
    },
    revokeOtherSessionsByUserId: async (input) => {
      const rows = await client.db
        .update(authSessions)
        .set({
          revokedAt: input.now,
          status: "revoked",
          updatedAt: input.now,
        })
        .where(
          and(
            eq(authSessions.userId, input.userId),
            eq(authSessions.status, "active"),
            ne(authSessions.id, input.currentSessionId),
          ),
        )
        .returning({ id: authSessions.id })
      return rows.length
    },
    revokeOtherSessionByIdForUser: async (input) => {
      const rows = await client.db
        .update(authSessions)
        .set({
          revokedAt: input.now,
          status: "revoked",
          updatedAt: input.now,
        })
        .where(
          and(
            eq(authSessions.id, input.sessionId),
            eq(authSessions.userId, input.userId),
            eq(authSessions.status, "active"),
            ne(authSessions.id, input.currentSessionId),
          ),
        )
        .returning({ id: authSessions.id })
      return rows.length > 0
    },
    findUserPasswordHash: async (userId) => {
      const [user] = await client.db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, userId))
      return user?.passwordHash ?? null
    },
    updateUserPasswordHash: async (userId, passwordHash) => {
      await client.db
        .update(users)
        .set({
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
    },
    switchSessionWorkspaceByTokenHash: async (input) =>
      client.db.transaction(async (tx) => {
        const [session] = await tx
          .select({
            expiresAt: authSessions.expiresAt,
            sessionId: authSessions.id,
            userId: authSessions.userId,
          })
          .from(authSessions)
          .where(
            and(
              eq(authSessions.sessionTokenHash, input.sessionTokenHash),
              eq(authSessions.status, "active"),
              gt(authSessions.expiresAt, input.now),
            ),
          )

        if (!session) {
          throw new AuthenticationError({
            code: "unauthenticated",
            message: "Invalid browser session",
          })
        }

        const [membership] = await tx
          .select({
            workspaceId: workspaceMemberships.workspaceId,
            workspaceSlug: workspaceMemberships.workspaceSlug,
          })
          .from(workspaceMemberships)
          .where(
            and(
              eq(workspaceMemberships.workspaceId, input.workspaceId),
              eq(workspaceMemberships.principalKind, "user"),
              eq(workspaceMemberships.principalId, session.userId),
              eq(workspaceMemberships.status, "active"),
            ),
          )

        if (!membership) {
          throw new ForbiddenError({
            code: "forbidden",
            message: "Workspace is not available to this browser session",
          })
        }

        const [updatedSession] = await tx
          .update(authSessions)
          .set({
            activeWorkspaceId: membership.workspaceId,
            activeWorkspaceSlug: membership.workspaceSlug,
            lastSeenAt: input.now,
            updatedAt: input.now,
          })
          .where(eq(authSessions.id, session.sessionId))
          .returning({
            activeWorkspaceId: authSessions.activeWorkspaceId,
            activeWorkspaceSlug: authSessions.activeWorkspaceSlug,
            expiresAt: authSessions.expiresAt,
            sessionId: authSessions.id,
            userId: authSessions.userId,
          })

        if (!updatedSession) {
          throw new Error("Session workspace update failed")
        }

        return updatedSession
      }),
  }
}
