import { createDbClient } from "@contextbase/core/db/client"
import { createPostgresApiTokenManagementStore } from "@contextbase/core/domains/auth/api-token-repository"
import {
  createPersonalApiToken,
  listPersonalApiTokens,
  revokePersonalApiToken,
  updatePersonalApiToken,
} from "@contextbase/core/domains/auth/api-tokens"
import {
  listActiveBrowserSessions,
  revokeOtherBrowserSession,
  revokeOtherBrowserSessions,
  updateBrowserPassword,
} from "@contextbase/core/domains/auth/browser-session"
import { requireBrowserWorkspaceAdminAccess } from "@contextbase/core/domains/auth/browser-session-permissions"
import { createPostgresBrowserAuthStore } from "@contextbase/core/domains/auth/browser-session-repository"
import { createPostgresInvitationStore } from "@contextbase/core/domains/invitations/repository"
import {
  createWorkspaceInvitation,
  listWorkspaceInvitations,
  revokeWorkspaceInvitation,
  type WorkspaceInvitationRole,
} from "@contextbase/core/domains/invitations/service"
import {
  listOwnOAuthGrants,
  revokeOwnOAuthGrant,
  updateOwnOAuthGrantScopes,
} from "@contextbase/core/domains/oauth/grants"
import { createPostgresOAuthRepository } from "@contextbase/core/domains/oauth/repository"
import type { OAuthScope } from "@contextbase/core/domains/oauth/service"
import { createPostgresUserStore } from "@contextbase/core/domains/users/repository"
import { updateOwnUserProfile } from "@contextbase/core/domains/users/service"
import { createPostgresWorkspaceMemberStore } from "@contextbase/core/domains/workspace-members/repository"
import {
  disableWorkspaceMember,
  listWorkspaceMembers,
  reactivateWorkspaceMember,
  updateWorkspaceMember,
} from "@contextbase/core/domains/workspace-members/service"
import { createPostgresWorkspaceStore } from "@contextbase/core/domains/workspaces/repository"
import { renameWorkspaceSlug, updateWorkspace } from "@contextbase/core/domains/workspaces/service"
import { ConflictError } from "@contextbase/core/shared/errors"
import { Effect } from "effect"
import { z } from "zod"

import { runTrpcEffect } from "../../../trpc/errors"
import { protectedProcedure, router } from "../../../trpc/server"
import { normalizeOnboardingSlug } from "../../auth/client/onboarding-slugs"
import { isOnboardingSlugAvailable } from "../../auth/server/onboarding-slug-availability"

const nonEmptyStringSchema = z.string().trim().min(1)
const oauthGrantScopeSchema = z.enum([
  "contextbase:read",
  "contextbase:write",
  "contextbase:files",
  "contextbase:manage",
  "offline_access",
])
const apiTokenScopeSchema = z.enum([
  "contextbase:read",
  "contextbase:write",
  "contextbase:files",
  "contextbase:manage",
])
const workspaceInvitationRoleSchema = z.enum(["workspace_admin", "workspace_member"])
const WORKSPACE_INVITATION_TTL_SECONDS = 60 * 60 * 24 * 7

const updateProfileInputSchema = z.object({
  displayName: nonEmptyStringSchema,
})

const updateWorkspaceInputSchema = z.object({
  workspaceName: nonEmptyStringSchema,
})

const workspaceSlugInputSchema = z.object({
  workspaceSlug: nonEmptyStringSchema.transform((value) => normalizeOnboardingSlug(value)),
})

const updatePasswordInputSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(12),
})

const revokeSessionInputSchema = z.object({
  sessionId: nonEmptyStringSchema,
})

const oauthGrantInputSchema = z.object({
  grantId: nonEmptyStringSchema,
})

const updateOAuthGrantScopesInputSchema = oauthGrantInputSchema.extend({
  scope: z.array(oauthGrantScopeSchema),
})

const apiTokenInputSchema = z.object({
  tokenId: nonEmptyStringSchema,
})

const createPersonalApiTokenInputSchema = z.object({
  label: nonEmptyStringSchema,
  scope: z.array(apiTokenScopeSchema),
})

const updateApiTokenInputSchema = apiTokenInputSchema.extend({
  label: nonEmptyStringSchema,
  scope: z.array(apiTokenScopeSchema),
})

const createWorkspaceInvitationInputSchema = z.object({
  email: z.string().trim().email(),
  role: workspaceInvitationRoleSchema.default("workspace_member"),
})

const revokeWorkspaceInvitationInputSchema = z.object({
  invitationId: nonEmptyStringSchema,
})

const workspaceMemberInputSchema = z.object({
  membershipId: nonEmptyStringSchema,
})

const updateWorkspaceMemberInputSchema = workspaceMemberInputSchema.extend({
  role: workspaceInvitationRoleSchema,
})

export function createSettingsRouter() {
  return router({
    invitations: router({
      list: protectedProcedure.query(({ ctx }) =>
        runTrpcEffect(async () => {
          const client = createDbClient()
          try {
            requireBrowserWorkspaceAdminAccess(ctx.session)
            const invitations = await Effect.runPromise(
              listWorkspaceInvitations(createPostgresInvitationStore(client), ctx.auth),
            )
            return { invitations: invitations.map(toPublicWorkspaceInvitation) }
          } finally {
            await client.end()
          }
        }),
      ),
      create: protectedProcedure
        .input(createWorkspaceInvitationInputSchema)
        .mutation(({ ctx, input }) =>
          runTrpcEffect(async () => {
            const client = createDbClient()
            try {
              requireBrowserWorkspaceAdminAccess(ctx.session)
              const result = await Effect.runPromise(
                createWorkspaceInvitation(
                  createPostgresInvitationStore(client),
                  ctx.auth,
                  {
                    email: input.email,
                    role: input.role as WorkspaceInvitationRole,
                  },
                  {
                    ttlSeconds: WORKSPACE_INVITATION_TTL_SECONDS,
                  },
                ),
              )
              const linkUrl = new URL("/auth/invitations/accept", publicAuthOrigin(ctx.request))
              linkUrl.searchParams.set("token", result.delivery.rawToken)
              try {
                await sendWorkspaceInvitationEmail({
                  email: result.delivery.email,
                  expiresAt: result.delivery.expiresAt,
                  linkUrl: linkUrl.toString(),
                })
              } catch (deliveryError) {
                try {
                  await Effect.runPromise(
                    revokeWorkspaceInvitation(createPostgresInvitationStore(client), ctx.auth, {
                      invitationId: result.invitation.id,
                    }),
                  )
                } catch (revokeError) {
                  console.error(
                    "[settings] Failed to revoke undelivered workspace invitation",
                    revokeError,
                  )
                }
                throw deliveryError
              }

              return {
                invitation: toPublicWorkspaceInvitation(result.invitation),
              }
            } finally {
              await client.end()
            }
          }),
        ),
      revoke: protectedProcedure
        .input(revokeWorkspaceInvitationInputSchema)
        .mutation(({ ctx, input }) =>
          runTrpcEffect(async () => {
            const client = createDbClient()
            try {
              requireBrowserWorkspaceAdminAccess(ctx.session)
              const invitation = await Effect.runPromise(
                revokeWorkspaceInvitation(createPostgresInvitationStore(client), ctx.auth, {
                  invitationId: input.invitationId,
                }),
              )
              return { invitation: toPublicWorkspaceInvitation(invitation) }
            } finally {
              await client.end()
            }
          }),
        ),
    }),
    members: router({
      list: protectedProcedure.query(({ ctx }) =>
        runTrpcEffect(async () => {
          const client = createDbClient()
          try {
            requireBrowserWorkspaceAdminAccess(ctx.session)
            const members = await Effect.runPromise(
              listWorkspaceMembers(createPostgresWorkspaceMemberStore(client), ctx.auth),
            )
            return { members }
          } finally {
            await client.end()
          }
        }),
      ),
      update: protectedProcedure
        .input(updateWorkspaceMemberInputSchema)
        .mutation(({ ctx, input }) =>
          runTrpcEffect(async () => {
            const client = createDbClient()
            try {
              requireBrowserWorkspaceAdminAccess(ctx.session)
              const member = await Effect.runPromise(
                updateWorkspaceMember(createPostgresWorkspaceMemberStore(client), ctx.auth, {
                  membershipId: input.membershipId,
                  role: input.role,
                }),
              )
              return { member }
            } finally {
              await client.end()
            }
          }),
        ),
      disable: protectedProcedure.input(workspaceMemberInputSchema).mutation(({ ctx, input }) =>
        runTrpcEffect(async () => {
          const client = createDbClient()
          try {
            requireBrowserWorkspaceAdminAccess(ctx.session)
            const member = await Effect.runPromise(
              disableWorkspaceMember(createPostgresWorkspaceMemberStore(client), ctx.auth, {
                membershipId: input.membershipId,
              }),
            )
            return { member }
          } finally {
            await client.end()
          }
        }),
      ),
      reactivate: protectedProcedure.input(workspaceMemberInputSchema).mutation(({ ctx, input }) =>
        runTrpcEffect(async () => {
          const client = createDbClient()
          try {
            requireBrowserWorkspaceAdminAccess(ctx.session)
            const member = await Effect.runPromise(
              reactivateWorkspaceMember(createPostgresWorkspaceMemberStore(client), ctx.auth, {
                membershipId: input.membershipId,
              }),
            )
            return { member }
          } finally {
            await client.end()
          }
        }),
      ),
    }),
    profile: router({
      update: protectedProcedure.input(updateProfileInputSchema).mutation(({ ctx, input }) =>
        runTrpcEffect(async () => {
          const client = createDbClient()
          try {
            return await Effect.runPromise(
              updateOwnUserProfile(createPostgresUserStore(client), ctx.auth, {
                displayName: input.displayName,
              }),
            )
          } finally {
            await client.end()
          }
        }),
      ),
    }),
    oauthGrants: router({
      listMine: protectedProcedure.query(({ ctx }) =>
        runTrpcEffect(async () => {
          const client = createDbClient()
          try {
            return await Effect.runPromise(
              listOwnOAuthGrants(createPostgresOAuthRepository(client), ctx.auth),
            )
          } finally {
            await client.end()
          }
        }),
      ),
      revokeMine: protectedProcedure.input(oauthGrantInputSchema).mutation(({ ctx, input }) =>
        runTrpcEffect(async () => {
          const client = createDbClient()
          try {
            return await Effect.runPromise(
              revokeOwnOAuthGrant(createPostgresOAuthRepository(client), ctx.auth, {
                grantId: input.grantId,
                revokedAt: new Date(),
              }),
            )
          } finally {
            await client.end()
          }
        }),
      ),
      updateMine: protectedProcedure
        .input(updateOAuthGrantScopesInputSchema)
        .mutation(({ ctx, input }) =>
          runTrpcEffect(async () => {
            const client = createDbClient()
            try {
              return await Effect.runPromise(
                updateOwnOAuthGrantScopes(createPostgresOAuthRepository(client), ctx.auth, {
                  grantId: input.grantId,
                  scope: input.scope as OAuthScope[],
                }),
              )
            } finally {
              await client.end()
            }
          }),
        ),
    }),
    apiTokens: router({
      createMine: protectedProcedure
        .input(createPersonalApiTokenInputSchema)
        .mutation(({ ctx, input }) =>
          runTrpcEffect(async () => {
            const client = createDbClient()
            try {
              return await Effect.runPromise(
                createPersonalApiToken(createPostgresApiTokenManagementStore(client), ctx.auth, {
                  label: input.label,
                  scope: input.scope,
                }),
              )
            } finally {
              await client.end()
            }
          }),
        ),
      listMine: protectedProcedure.query(({ ctx }) =>
        runTrpcEffect(async () => {
          const client = createDbClient()
          try {
            return await Effect.runPromise(
              listPersonalApiTokens(createPostgresApiTokenManagementStore(client), ctx.auth),
            )
          } finally {
            await client.end()
          }
        }),
      ),
      revokeMine: protectedProcedure.input(apiTokenInputSchema).mutation(({ ctx, input }) =>
        runTrpcEffect(async () => {
          const client = createDbClient()
          try {
            return await Effect.runPromise(
              revokePersonalApiToken(createPostgresApiTokenManagementStore(client), ctx.auth, {
                revokedAt: new Date(),
                tokenId: input.tokenId,
              }),
            )
          } finally {
            await client.end()
          }
        }),
      ),
      updateMine: protectedProcedure.input(updateApiTokenInputSchema).mutation(({ ctx, input }) =>
        runTrpcEffect(async () => {
          const client = createDbClient()
          try {
            return await Effect.runPromise(
              updatePersonalApiToken(createPostgresApiTokenManagementStore(client), ctx.auth, {
                label: input.label,
                scope: input.scope,
                tokenId: input.tokenId,
              }),
            )
          } finally {
            await client.end()
          }
        }),
      ),
    }),
    security: router({
      get: protectedProcedure.query(({ ctx }) =>
        runTrpcEffect(async () => {
          const client = createDbClient()
          try {
            const store = createPostgresBrowserAuthStore(client)
            const passwordHash = await store.findUserPasswordHash?.(ctx.session.userId)
            return { passwordEnabled: Boolean(passwordHash) }
          } finally {
            await client.end()
          }
        }),
      ),
      listSessions: protectedProcedure.query(({ ctx }) =>
        runTrpcEffect(async () => {
          const client = createDbClient()
          try {
            return await Effect.runPromise(
              listActiveBrowserSessions(createPostgresBrowserAuthStore(client), {
                currentSessionId: ctx.session.sessionId,
                userId: ctx.session.userId,
              }),
            )
          } finally {
            await client.end()
          }
        }),
      ),
      revokeOtherSessions: protectedProcedure.mutation(({ ctx }) =>
        runTrpcEffect(async () => {
          const client = createDbClient()
          try {
            return await Effect.runPromise(
              revokeOtherBrowserSessions(createPostgresBrowserAuthStore(client), {
                currentSessionId: ctx.session.sessionId,
                userId: ctx.session.userId,
              }),
            )
          } finally {
            await client.end()
          }
        }),
      ),
      revokeSession: protectedProcedure.input(revokeSessionInputSchema).mutation(({ ctx, input }) =>
        runTrpcEffect(async () => {
          const client = createDbClient()
          try {
            return await Effect.runPromise(
              revokeOtherBrowserSession(createPostgresBrowserAuthStore(client), {
                currentSessionId: ctx.session.sessionId,
                sessionId: input.sessionId,
                userId: ctx.session.userId,
              }),
            )
          } finally {
            await client.end()
          }
        }),
      ),
      updatePassword: protectedProcedure
        .input(updatePasswordInputSchema)
        .mutation(({ ctx, input }) =>
          runTrpcEffect(async () => {
            const client = createDbClient()
            try {
              return await Effect.runPromise(
                updateBrowserPassword(createPostgresBrowserAuthStore(client), {
                  currentPassword: input.currentPassword,
                  newPassword: input.newPassword,
                  userId: ctx.session.userId,
                }),
              )
            } finally {
              await client.end()
            }
          }),
        ),
    }),
    workspace: router({
      slugAvailability: protectedProcedure.input(workspaceSlugInputSchema).query(({ ctx, input }) =>
        runTrpcEffect(async () => {
          const slug = input.workspaceSlug
          if (!slug) return { available: false }
          if (slug === ctx.auth.workspaceSlug) return { available: true }

          const client = createDbClient()
          try {
            requireBrowserWorkspaceAdminAccess(ctx.session)
            const available = await isOnboardingSlugAvailable({
              db: client.db,
              kind: "workspace",
              slug,
            })
            return { available }
          } finally {
            await client.end()
          }
        }),
      ),
      update: protectedProcedure.input(updateWorkspaceInputSchema).mutation(({ ctx, input }) =>
        runTrpcEffect(async () => {
          const client = createDbClient()
          try {
            requireBrowserWorkspaceAdminAccess(ctx.session)
            return await Effect.runPromise(
              updateWorkspace(createPostgresWorkspaceStore(client), ctx.auth, {
                workspaceIdOrSlug: ctx.auth.workspaceId,
                workspaceName: input.workspaceName,
              }),
            )
          } finally {
            await client.end()
          }
        }),
      ),
      updateSlug: protectedProcedure.input(workspaceSlugInputSchema).mutation(({ ctx, input }) =>
        runTrpcEffect(async () => {
          const slug = input.workspaceSlug
          if (!slug) {
            throw new ConflictError({
              code: "conflict",
              details: {},
              message: "Choose a valid workspace slug.",
            })
          }
          if (slug === ctx.auth.workspaceSlug) {
            return { workspaceSlug: ctx.auth.workspaceSlug }
          }

          const client = createDbClient()
          try {
            requireBrowserWorkspaceAdminAccess(ctx.session)
            const available = await isOnboardingSlugAvailable({
              db: client.db,
              kind: "workspace",
              slug,
            })
            if (!available) {
              throw new ConflictError({
                code: "conflict",
                details: { workspaceSlug: slug },
                message: "Workspace slug is already taken.",
              })
            }

            return await Effect.runPromise(
              renameWorkspaceSlug(createPostgresWorkspaceStore(client), ctx.auth, {
                newSlug: slug,
                workspaceIdOrSlug: ctx.auth.workspaceId,
              }),
            )
          } finally {
            await client.end()
          }
        }),
      ),
    }),
  })
}

export const settingsRouter = createSettingsRouter()

function toPublicWorkspaceInvitation(invitation: {
  acceptedAt?: Date | null
  email: string
  expiresAt: Date
  id: string
  revokedAt?: Date | null
  role: WorkspaceInvitationRole
  status: string
}) {
  return {
    acceptedAt: invitation.acceptedAt ?? null,
    email: invitation.email,
    expiresAt: invitation.expiresAt,
    id: invitation.id,
    revokedAt: invitation.revokedAt ?? null,
    role: invitation.role,
    status: invitation.status,
  }
}

function publicAuthOrigin(request: Request) {
  return (
    process.env.CONTEXTBASE_APP_BASE_URL ??
    process.env.AUTH_PUBLIC_BASE_URL ??
    process.env.CONTEXTBASE_AUTH_BASE_URL ??
    process.env.VITE_CONTEXTBASE_AUTH_BASE_URL ??
    process.env.VITE_AUTH_BASE_URL ??
    new URL(request.url).origin
  )
}

async function sendWorkspaceInvitationEmail(message: {
  email: string
  expiresAt: Date
  linkUrl: string
}) {
  const apiKey = process.env.AGENTMAIL_API_KEY
  const inboxId = process.env.AGENTMAIL_INBOX_ID
  if (!apiKey || !inboxId) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[settings] AgentMail is not configured; use this local workspace invitation link:",
        message.linkUrl,
      )
      return
    }

    throw new Error("AgentMail is required for workspace invitation delivery in production")
  }

  const response = await fetch(
    `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/messages/send`,
    {
      body: JSON.stringify({
        from_name: process.env.AGENTMAIL_FROM_NAME ?? "Contextbase",
        html: `<p>You have been invited to join a Contextbase workspace.</p><p><a href="${message.linkUrl}">${message.linkUrl}</a></p>`,
        subject: "Join Contextbase",
        text: `You have been invited to join a Contextbase workspace: ${message.linkUrl}\n\nThis link expires at ${message.expiresAt.toISOString()}.`,
        to: [message.email],
      }),
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      method: "POST",
    },
  )

  if (!response.ok) {
    throw new Error(`AgentMail send failed with status ${response.status}`)
  }
}
