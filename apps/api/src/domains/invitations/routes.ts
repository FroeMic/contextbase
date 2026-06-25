import { createDbClient } from "@contextbase/core"
import {
  type AuthenticatedContext,
  authenticateBearerToken,
  extractBearerToken,
} from "@contextbase/core/domains/auth/authenticate"
import { createPostgresInvitationStore } from "@contextbase/core/domains/invitations/repository"
import {
  createWorkspaceInvitation,
  type InvitationStore,
  listWorkspaceInvitations,
  revokeWorkspaceInvitation,
  type WorkspaceInvitationDto,
  type WorkspaceInvitationRole,
} from "@contextbase/core/domains/invitations/service"
import {
  type AppError,
  AuthenticationError,
  mapAppErrorToHttp,
} from "@contextbase/core/shared/errors"
import { listEnvelope, successEnvelope } from "@contextbase/core/shared/response"
import { Effect } from "effect"
import type { Context } from "hono"
import { Hono } from "hono"

const WORKSPACE_INVITATION_TTL_SECONDS = 60 * 60 * 24 * 7

export type WorkspaceInvitationRouteDependencies = {
  authenticateApiToken?: (token: string) => Promise<AuthenticatedContext>
  invitationStore?: InvitationStore
  sendWorkspaceInvitationEmail?: (message: {
    email: string
    expiresAt: Date
    linkUrl: string
  }) => Promise<void>
}

export function createWorkspaceInvitationRouter(
  dependencies: WorkspaceInvitationRouteDependencies = {},
) {
  const app = new Hono()

  app.get("/api/v1/workspace-invitations", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies)
    if (!auth.ok) return writeAppError(context, auth.error)

    return withInvitationStore(dependencies, async (store) => {
      const result = await Effect.runPromise(
        Effect.either(listWorkspaceInvitations(store, auth.data)),
      )
      if (result._tag === "Left") return writeAppError(context, result.left)
      return context.json(listEnvelope(result.right.map(toPublicInvitation)), 200)
    })
  })

  app.post("/api/v1/workspace-invitations", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies)
    if (!auth.ok) return writeAppError(context, auth.error)

    const body = (await context.req.json()) as {
      email?: string
      role?: WorkspaceInvitationRole
    }

    return withInvitationStore(dependencies, async (store) => {
      const result = await Effect.runPromise(
        Effect.either(
          createWorkspaceInvitation(
            store,
            auth.data,
            {
              email: body.email ?? "",
              role: body.role ?? "workspace_member",
            },
            {
              ttlSeconds: WORKSPACE_INVITATION_TTL_SECONDS,
            },
          ),
        ),
      )
      if (result._tag === "Left") return writeAppError(context, result.left)

      const linkUrl = new URL("/auth/invitations/accept", publicAppOrigin(context.req.raw))
      linkUrl.searchParams.set("token", result.right.delivery.rawToken)
      try {
        await (dependencies.sendWorkspaceInvitationEmail ?? sendWorkspaceInvitationEmail)({
          email: result.right.delivery.email,
          expiresAt: result.right.delivery.expiresAt,
          linkUrl: linkUrl.toString(),
        })
      } catch (deliveryError) {
        try {
          await Effect.runPromise(
            revokeWorkspaceInvitation(store, auth.data, {
              invitationId: result.right.invitation.id,
            }),
          )
        } catch (revokeError) {
          console.error("[api] Failed to revoke undelivered workspace invitation", revokeError)
        }
        throw deliveryError
      }

      return context.json(successEnvelope(toPublicInvitation(result.right.invitation)), 201)
    })
  })

  app.post("/api/v1/workspace-invitations/:invitationId/revoke", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies)
    if (!auth.ok) return writeAppError(context, auth.error)

    return withInvitationStore(dependencies, async (store) => {
      const result = await Effect.runPromise(
        Effect.either(
          revokeWorkspaceInvitation(store, auth.data, {
            invitationId: context.req.param("invitationId"),
          }),
        ),
      )
      if (result._tag === "Left") return writeAppError(context, result.left)
      return context.json(successEnvelope(toPublicInvitation(result.right)), 200)
    })
  })

  return app
}

async function authenticateRequest(
  request: Request,
  dependencies: WorkspaceInvitationRouteDependencies,
) {
  const token = extractBearerToken(request)

  if (!token) {
    return {
      error: new AuthenticationError({
        code: "unauthenticated",
        message: "Missing API token",
      }),
      ok: false as const,
    }
  }

  try {
    if (dependencies.authenticateApiToken) {
      return {
        data: await dependencies.authenticateApiToken(token),
        ok: true as const,
      }
    }

    const client = createDbClient()
    try {
      return {
        data: await Effect.runPromise(authenticateBearerToken(client, token)),
        ok: true as const,
      }
    } finally {
      await client.end()
    }
  } catch (error) {
    return {
      error: error as AppError,
      ok: false as const,
    }
  }
}

async function withInvitationStore<T>(
  dependencies: WorkspaceInvitationRouteDependencies,
  fn: (store: InvitationStore) => Promise<T>,
) {
  if (dependencies.invitationStore) return fn(dependencies.invitationStore)

  const client = createDbClient()
  try {
    return await fn(createPostgresInvitationStore(client))
  } finally {
    await client.end()
  }
}

function toPublicInvitation(invitation: WorkspaceInvitationDto) {
  return {
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    email: invitation.email,
    emailNormalized: invitation.emailNormalized,
    expiresAt: invitation.expiresAt.toISOString(),
    id: invitation.id,
    invitedByUserId: invitation.invitedByUserId,
    revokedAt: invitation.revokedAt?.toISOString() ?? null,
    role: invitation.role,
    status: invitation.status,
    workspaceId: invitation.workspaceId,
    workspaceSlug: invitation.workspaceSlug,
  }
}

function publicAppOrigin(request: Request) {
  void request
  return firstNonBlank(
    process.env.CONTEXTBASE_APP_BASE_URL,
    process.env.CONTEXTBASE_WEB_BASE_URL,
    "http://127.0.0.1:4017",
  )
}

function firstNonBlank(...values: Array<string | undefined>) {
  for (const value of values) {
    const normalized = value?.trim().replace(/\/+$/, "")
    if (normalized) return normalized
  }

  return "http://127.0.0.1:4017"
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
        "[api] AgentMail is not configured; use this local workspace invitation link:",
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

  if (!response.ok) throw new Error(`AgentMail send failed with status ${response.status}`)
}

function writeAppError(context: Context, error: AppError) {
  const mapped = mapAppErrorToHttp(error)

  return context.json(mapped.body, mapped.status, {
    "Cache-Control": "no-store",
  })
}
