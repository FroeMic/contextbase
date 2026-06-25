import { and, eq, gt, isNull } from "drizzle-orm"

import type { DbClient, DbTransaction } from "../../db/client"
import {
  authSessions,
  onboardingSessions,
  signupEmailVerifications,
  users,
  workspaceMemberships,
  workspaces,
} from "../../db/schema"
import { AuthenticationError, ConflictError } from "../../shared/errors"
import type { SignupStore } from "./service"

export function createPostgresSignupStore(client: DbClient): SignupStore {
  return {
    consumeSignupVerification: async (input) => {
      const [verification] = await client.db
        .update(signupEmailVerifications)
        .set({
          consumedAt: input.now,
        })
        .where(
          and(
            eq(signupEmailVerifications.tokenHash, input.tokenHash),
            isNull(signupEmailVerifications.consumedAt),
            gt(signupEmailVerifications.expiresAt, input.now),
          ),
        )
        .returning({
          email: signupEmailVerifications.email,
          emailNormalized: signupEmailVerifications.emailNormalized,
          id: signupEmailVerifications.id,
        })

      return verification ?? null
    },
    consumeSignupVerificationWithOnboardingSession: async (input) =>
      client.db.transaction(async (tx) => {
        const [verification] = await tx
          .update(signupEmailVerifications)
          .set({
            consumedAt: input.now,
          })
          .where(
            and(
              eq(signupEmailVerifications.tokenHash, input.tokenHash),
              isNull(signupEmailVerifications.consumedAt),
              gt(signupEmailVerifications.expiresAt, input.now),
            ),
          )
          .returning({
            email: signupEmailVerifications.email,
            emailNormalized: signupEmailVerifications.emailNormalized,
            id: signupEmailVerifications.id,
          })

        if (!verification) return null

        return createVerifiedSignupUserWithOnboardingSessionInTransaction(tx, {
          displayName: input.displayNameFromEmailNormalized(verification.emailNormalized),
          email: verification.email,
          emailNormalized: verification.emailNormalized,
          now: input.now,
          sessionExpiresAt: input.sessionExpiresAt,
          sessionTokenHash: input.sessionTokenHash,
          signupVerificationId: verification.id,
        })
      }),
    createVerifiedSignupUserWithOnboardingSession: async (input) =>
      client.db.transaction((tx) =>
        createVerifiedSignupUserWithOnboardingSessionInTransaction(tx, input),
      ),
    completeOnboardingSetup: async (input) => {
      try {
        return await client.db.transaction(async (tx) => {
          const [claimedOnboardingSession] = await tx
            .update(onboardingSessions)
            .set({
              completedAt: input.now,
              status: "completed",
              updatedAt: input.now,
            })
            .where(
              and(
                eq(onboardingSessions.id, input.onboardingSessionId),
                eq(onboardingSessions.userId, input.userId),
                eq(onboardingSessions.status, "active"),
                gt(onboardingSessions.expiresAt, input.now),
                isNull(onboardingSessions.completedAt),
                isNull(onboardingSessions.revokedAt),
              ),
            )
            .returning({
              id: onboardingSessions.id,
            })

          if (!claimedOnboardingSession) {
            throw new AuthenticationError({
              code: "unauthenticated",
              message: "Invalid or expired onboarding session",
            })
          }

          const hasExistingOnboardingWorkspaceMembership =
            await tx.query.workspaceMemberships.findFirst({
              columns: {
                id: true,
              },
              where: and(
                eq(workspaceMemberships.principalKind, "user"),
                eq(workspaceMemberships.principalId, input.userId),
              ),
            })

          if (hasExistingOnboardingWorkspaceMembership) {
            throw new ConflictError({
              code: "conflict",
              details: {
                userId: input.userId,
              },
              message: "User already has a workspace membership",
            })
          }

          const [workspace] = await tx
            .insert(workspaces)
            .values({
              workspaceName: input.workspaceName,
              workspaceSlug: input.workspaceSlug,
            })
            .returning({
              id: workspaces.id,
              workspaceName: workspaces.workspaceName,
              workspaceSlug: workspaces.workspaceSlug,
            })

          if (!workspace) {
            throw new Error("Onboarding workspace insert failed")
          }

          await tx
            .update(users)
            .set({
              displayName: input.profileName,
              metadataJson: JSON.stringify({
                title: input.profileTitle ?? null,
              }),
              updatedAt: input.now,
            })
            .where(eq(users.id, input.userId))

          await tx.insert(workspaceMemberships).values({
            principalId: input.userId,
            principalKind: "user",
            role: "workspace_admin",
            workspaceId: workspace.id,
            workspaceSlug: workspace.workspaceSlug,
          })

          const [session] = await tx
            .insert(authSessions)
            .values({
              activeWorkspaceId: workspace.id,
              activeWorkspaceSlug: workspace.workspaceSlug,
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
            throw new Error("Onboarding browser session insert failed")
          }

          return {
            session,
            userId: input.userId,
            workspaceId: workspace.id,
            workspaceSlug: workspace.workspaceSlug,
          }
        })
      } catch (error) {
        if (isOnboardingSlugUniqueViolation(error)) {
          throw new ConflictError({
            code: "conflict",
            details: {
              workspaceSlug: input.workspaceSlug,
            },
            message: "Workspace slug is already in use.",
          })
        }

        throw error
      }
    },
    findActiveOnboardingSessionByTokenHash: async (tokenHash) => {
      const [session] = await client.db
        .select({
          onboardingSessionId: onboardingSessions.id,
          tokenHash: onboardingSessions.sessionTokenHash,
          userId: onboardingSessions.userId,
        })
        .from(onboardingSessions)
        .where(
          and(
            eq(onboardingSessions.sessionTokenHash, tokenHash),
            eq(onboardingSessions.status, "active"),
            gt(onboardingSessions.expiresAt, new Date()),
            isNull(onboardingSessions.completedAt),
            isNull(onboardingSessions.revokedAt),
          ),
        )

      return session ?? null
    },
    findSignupAccountByEmail: async (emailNormalized) => {
      const user = await client.db.query.users.findFirst({
        columns: {
          id: true,
        },
        where: eq(users.emailNormalized, emailNormalized),
      })

      if (!user) return null

      const membership = await client.db.query.workspaceMemberships.findFirst({
        columns: {
          id: true,
        },
        where: and(
          eq(workspaceMemberships.principalKind, "user"),
          eq(workspaceMemberships.principalId, user.id),
        ),
      })

      return {
        hasWorkspaceMembership: Boolean(membership),
        id: user.id,
      }
    },
    findUserByEmail: async (emailNormalized) => {
      const user = await client.db.query.users.findFirst({
        columns: {
          id: true,
        },
        where: eq(users.emailNormalized, emailNormalized),
      })

      return user ?? null
    },
    insertSignupVerification: async (input) => {
      const [verification] = await client.db
        .insert(signupEmailVerifications)
        .values(input)
        .returning({
          id: signupEmailVerifications.id,
        })

      if (!verification) {
        throw new Error("Signup verification insert failed")
      }

      return verification
    },
  }
}

async function createVerifiedSignupUserWithOnboardingSessionInTransaction(
  tx: DbTransaction,
  input: {
    displayName: string
    email: string
    emailNormalized: string
    now: Date
    sessionExpiresAt: Date
    sessionTokenHash: string
    signupVerificationId: string
  },
) {
  const existingUser = await tx.query.users.findFirst({
    columns: {
      displayName: true,
      email: true,
      emailNormalized: true,
      emailVerifiedAt: true,
      id: true,
      status: true,
    },
    where: eq(users.emailNormalized, input.emailNormalized),
  })

  if (existingUser && existingUser.status !== "active") {
    throw new AuthenticationError({
      code: "unauthenticated",
      message: "Existing user account is not active",
    })
  }

  const user = existingUser
    ? {
        ...existingUser,
        displayName: existingUser.displayName || input.displayName,
        email: existingUser.email ?? input.email,
        emailNormalized: existingUser.emailNormalized ?? input.emailNormalized,
        emailVerifiedAt: existingUser.emailVerifiedAt ?? input.now,
      }
    : (
        await tx
          .insert(users)
          .values({
            displayName: input.displayName,
            email: input.email,
            emailNormalized: input.emailNormalized,
            emailVerifiedAt: input.now,
            lastLoginAt: input.now,
          })
          .returning({
            displayName: users.displayName,
            email: users.email,
            emailNormalized: users.emailNormalized,
            emailVerifiedAt: users.emailVerifiedAt,
            id: users.id,
          })
      )[0]

  if (!user || !user.email || !user.emailNormalized || !user.emailVerifiedAt) {
    throw new Error("Signup user insert failed")
  }

  const hasExistingWorkspaceMembership = await tx.query.workspaceMemberships.findFirst({
    columns: {
      id: true,
    },
    where: and(
      eq(workspaceMemberships.principalKind, "user"),
      eq(workspaceMemberships.principalId, user.id),
    ),
  })

  if (hasExistingWorkspaceMembership) {
    throw new ConflictError({
      code: "conflict",
      details: {
        userId: user.id,
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
      .where(eq(users.id, user.id))
  }

  const [onboardingSession] = await tx
    .insert(onboardingSessions)
    .values({
      expiresAt: input.sessionExpiresAt,
      sessionTokenHash: input.sessionTokenHash,
      userId: user.id,
    })
    .returning({
      expiresAt: onboardingSessions.expiresAt,
      onboardingSessionId: onboardingSessions.id,
      userId: onboardingSessions.userId,
    })

  if (!onboardingSession) {
    throw new Error("Onboarding session insert failed")
  }

  return {
    onboardingSession,
    user: {
      displayName: user.displayName,
      email: user.email,
      emailNormalized: user.emailNormalized,
      emailVerifiedAt: user.emailVerifiedAt,
      id: user.id,
    },
  }
}

function isOnboardingSlugUniqueViolation(cause: unknown) {
  const error = cause as {
    code?: unknown
    constraint?: unknown
    constraint_name?: unknown
    detail?: unknown
    message?: unknown
  }
  const text = [cause, error.constraint, error.constraint_name, error.detail, error.message]
    .filter((value) => typeof value === "string")
    .join(" ")

  return (
    (error.code === "23505" || text.includes("duplicate key")) &&
    text.includes("workspaces_workspace_slug_idx")
  )
}
