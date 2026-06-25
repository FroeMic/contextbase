import { and, desc, eq, gt, isNull } from "drizzle-orm"

import type { DbClient } from "../../db/client"
import { authSessions, users, workspaceInvitations, workspaceMemberships } from "../../db/schema"
import { AuthenticationError, ConflictError, NotFoundError } from "../../shared/errors"
import type { InvitationStore, WorkspaceInvitationDto, WorkspaceInvitationRole } from "./service"

export function createPostgresInvitationStore(client: DbClient): InvitationStore {
  return {
    listInvitations: async (context) => {
      const rows = await client.db
        .select(invitationSelection)
        .from(workspaceInvitations)
        .where(eq(workspaceInvitations.workspaceId, context.workspaceId))
        .orderBy(desc(workspaceInvitations.createdAt))

      return rows.map(toWorkspaceInvitationDto)
    },
    acceptInvitationWithSession: async (input) =>
      client.db.transaction(async (tx) => {
        const [invitation] = await tx
          .update(workspaceInvitations)
          .set({
            acceptedAt: input.now,
            status: "accepted",
            updatedAt: input.now,
          })
          .where(
            and(
              eq(workspaceInvitations.tokenHash, input.tokenHash),
              eq(workspaceInvitations.status, "pending"),
              gt(workspaceInvitations.expiresAt, input.now),
              isNull(workspaceInvitations.acceptedAt),
              isNull(workspaceInvitations.revokedAt),
            ),
          )
          .returning(invitationSelection)

        if (!invitation) {
          throw new AuthenticationError({
            code: "unauthenticated",
            message: "Invalid or expired workspace invitation",
          })
        }

        const invitationDto = toWorkspaceInvitationDto(invitation)
        const existingUser = await tx.query.users.findFirst({
          columns: { id: true, status: true },
          where: eq(users.emailNormalized, invitationDto.emailNormalized),
        })

        if (existingUser && existingUser.status !== "active") {
          throw new AuthenticationError({
            code: "unauthenticated",
            message: "Existing user account is not active",
          })
        }

        const userId = existingUser?.id ?? (await createInvitedUser(tx, invitationDto, input.now))
        const existingMembership = await tx.query.workspaceMemberships.findFirst({
          columns: {
            id: true,
          },
          where: and(
            eq(workspaceMemberships.workspaceId, invitationDto.workspaceId),
            eq(workspaceMemberships.principalKind, "user"),
            eq(workspaceMemberships.principalId, userId),
          ),
        })

        if (existingMembership) {
          throw new ConflictError({
            code: "conflict",
            details: {
              invitationId: invitationDto.id,
              membershipId: existingMembership.id,
              workspaceId: invitationDto.workspaceId,
            },
            message: "User already has a workspace membership",
          })
        }

        if (existingUser) {
          await tx
            .update(users)
            .set({
              emailVerifiedAt: input.now,
              lastLoginAt: input.now,
              updatedAt: input.now,
            })
            .where(eq(users.id, userId))
        }

        const [membership] = await tx
          .insert(workspaceMemberships)
          .values({
            principalId: userId,
            principalKind: "user",
            role: invitationDto.role,
            workspaceId: invitationDto.workspaceId,
            workspaceSlug: invitationDto.workspaceSlug,
          })
          .onConflictDoNothing({
            target: [
              workspaceMemberships.workspaceId,
              workspaceMemberships.principalKind,
              workspaceMemberships.principalId,
            ],
          })
          .returning({ id: workspaceMemberships.id })

        if (!membership) {
          throw new ConflictError({
            code: "conflict",
            details: {
              invitationId: invitationDto.id,
              workspaceId: invitationDto.workspaceId,
            },
            message: "User already has a workspace membership",
          })
        }

        const [session] = await tx
          .insert(authSessions)
          .values({
            activeWorkspaceId: invitationDto.workspaceId,
            activeWorkspaceSlug: invitationDto.workspaceSlug,
            expiresAt: input.sessionExpiresAt,
            sessionTokenHash: input.sessionTokenHash,
            userId,
          })
          .returning({
            activeWorkspaceId: authSessions.activeWorkspaceId,
            activeWorkspaceSlug: authSessions.activeWorkspaceSlug,
            expiresAt: authSessions.expiresAt,
            sessionId: authSessions.id,
            userId: authSessions.userId,
          })

        if (!session) {
          throw new Error("Invitation session insert failed")
        }

        return {
          session,
          userId,
          workspaceId: invitationDto.workspaceId,
          workspaceSlug: invitationDto.workspaceSlug,
        }
      }),
    createInvitation: async (_context, input) =>
      client.db.transaction(async (tx) => {
        const [invitation] = await tx
          .insert(workspaceInvitations)
          .values(input)
          .returning(invitationSelection)

        if (!invitation) {
          throw new Error("Workspace invitation insert failed")
        }

        const invitationDto = toWorkspaceInvitationDto(invitation)

        return invitationDto
      }),
    revokeInvitation: async (context, input) =>
      client.db.transaction(async (tx) => {
        const [invitation] = await tx
          .update(workspaceInvitations)
          .set({
            revokedAt: input.now,
            status: "revoked",
            updatedAt: input.now,
          })
          .where(
            and(
              eq(workspaceInvitations.id, input.invitationId),
              eq(workspaceInvitations.workspaceId, context.workspaceId),
              eq(workspaceInvitations.status, "pending"),
              isNull(workspaceInvitations.acceptedAt),
              isNull(workspaceInvitations.revokedAt),
            ),
          )
          .returning(invitationSelection)

        if (!invitation) {
          const existing = await tx.query.workspaceInvitations.findFirst({
            columns: {
              id: true,
              workspaceId: true,
            },
            where: eq(workspaceInvitations.id, input.invitationId),
          })

          if (!existing || existing.workspaceId !== context.workspaceId) {
            throw new NotFoundError({
              code: "not_found",
              details: {
                invitationId: input.invitationId,
                workspaceId: context.workspaceId,
              },
              message: "Workspace invitation not found",
            })
          }

          throw new ConflictError({
            code: "conflict",
            details: {
              invitationId: input.invitationId,
              workspaceId: context.workspaceId,
            },
            message: "Workspace invitation is no longer revocable",
          })
        }

        return toWorkspaceInvitationDto(invitation)
      }),
  }
}

function toWorkspaceInvitationDto(row: InvitationRow): WorkspaceInvitationDto {
  return {
    ...row,
    role: toWorkspaceInvitationRole(row.role),
  }
}

function toWorkspaceInvitationRole(role: string): WorkspaceInvitationRole {
  if (role === "workspace_admin" || role === "workspace_member") {
    return role
  }

  throw new Error(`Unsupported workspace invitation role: ${role}`)
}

async function createInvitedUser(
  tx: Parameters<Parameters<DbClient["db"]["transaction"]>[0]>[0],
  invitation: WorkspaceInvitationDto,
  now: Date,
) {
  const [user] = await tx
    .insert(users)
    .values({
      displayName: invitation.emailNormalized.split("@")[0] || invitation.emailNormalized,
      email: invitation.email,
      emailNormalized: invitation.emailNormalized,
      emailVerifiedAt: now,
      lastLoginAt: now,
    })
    .returning({ id: users.id })

  if (!user) {
    throw new Error("Invitation user insert failed")
  }

  return user.id
}

const invitationSelection = {
  acceptedAt: workspaceInvitations.acceptedAt,
  email: workspaceInvitations.email,
  emailNormalized: workspaceInvitations.emailNormalized,
  expiresAt: workspaceInvitations.expiresAt,
  id: workspaceInvitations.id,
  invitedByUserId: workspaceInvitations.invitedByUserId,
  revokedAt: workspaceInvitations.revokedAt,
  role: workspaceInvitations.role,
  status: workspaceInvitations.status,
  tokenHash: workspaceInvitations.tokenHash,
  workspaceId: workspaceInvitations.workspaceId,
  workspaceSlug: workspaceInvitations.workspaceSlug,
} satisfies Record<string, unknown>

type InvitationRow = {
  acceptedAt: Date | null
  email: string
  emailNormalized: string
  expiresAt: Date
  id: string
  invitedByUserId: string
  revokedAt: Date | null
  role: string
  status: string
  tokenHash: string
  workspaceId: string
  workspaceSlug: string
}
