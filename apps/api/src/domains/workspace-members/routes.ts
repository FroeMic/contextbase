import { createDbClient } from "@contextbase/core"
import {
  type AuthenticatedContext,
  authenticateBearerToken,
  extractBearerToken,
} from "@contextbase/core/domains/auth/authenticate"
import type { WorkspaceMemberRole } from "@contextbase/core/domains/workspace-members/contracts"
import { createPostgresWorkspaceMemberStore } from "@contextbase/core/domains/workspace-members/repository"
import {
  disableWorkspaceMember,
  listWorkspaceMembers,
  reactivateWorkspaceMember,
  updateWorkspaceMember,
  type WorkspaceMemberStore,
} from "@contextbase/core/domains/workspace-members/service"
import {
  type AppError,
  AuthenticationError,
  InvalidRequestError,
  mapAppErrorToHttp,
} from "@contextbase/core/shared/errors"
import { listEnvelope, successEnvelope } from "@contextbase/core/shared/response"
import { Effect } from "effect"
import type { Context } from "hono"
import { Hono } from "hono"

export type WorkspaceMemberRouteDependencies = {
  authenticateApiToken?: (token: string) => Promise<AuthenticatedContext>
  workspaceMemberStore?: WorkspaceMemberStore
}

export function createWorkspaceMemberRouter(dependencies: WorkspaceMemberRouteDependencies = {}) {
  const app = new Hono()

  app.get("/api/v1/workspace-members", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies)
    if (!auth.ok) return writeAppError(context, auth.error)

    return withWorkspaceMemberStore(dependencies, async (store) => {
      const result = await Effect.runPromise(Effect.either(listWorkspaceMembers(store, auth.data)))
      if (result._tag === "Left") return writeAppError(context, result.left)
      return context.json(listEnvelope(result.right), 200)
    })
  })

  app.patch("/api/v1/workspace-members/:membershipId", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies)
    if (!auth.ok) return writeAppError(context, auth.error)

    const parsedRole = await parseWorkspaceMemberRole(context)
    if (!parsedRole.ok) return writeAppError(context, parsedRole.error)

    return withWorkspaceMemberStore(dependencies, async (store) => {
      const result = await Effect.runPromise(
        Effect.either(
          updateWorkspaceMember(store, auth.data, {
            membershipId: context.req.param("membershipId"),
            role: parsedRole.role,
          }),
        ),
      )
      if (result._tag === "Left") return writeAppError(context, result.left)
      return context.json(successEnvelope(result.right), 200)
    })
  })

  app.post("/api/v1/workspace-members/:membershipId/disable", async (context) =>
    updateStatus(context, dependencies, "disabled"),
  )

  app.post("/api/v1/workspace-members/:membershipId/reactivate", async (context) =>
    updateStatus(context, dependencies, "active"),
  )

  return app
}

async function parseWorkspaceMemberRole(
  context: Context,
): Promise<{ ok: true; role: WorkspaceMemberRole } | { error: InvalidRequestError; ok: false }> {
  let body: unknown
  try {
    body = await context.req.json()
  } catch {
    return invalidWorkspaceMemberRole()
  }

  const role = typeof body === "object" && body !== null ? (body as { role?: unknown }).role : null
  if (role === "workspace_admin" || role === "workspace_member") {
    return { ok: true as const, role }
  }

  return invalidWorkspaceMemberRole()
}

function invalidWorkspaceMemberRole() {
  return {
    error: new InvalidRequestError({
      code: "invalid_request",
      details: {
        allowedRoles: ["workspace_admin", "workspace_member"],
      },
      message: "Workspace member role must be workspace_admin or workspace_member.",
    }),
    ok: false as const,
  }
}

async function updateStatus(
  context: Context,
  dependencies: WorkspaceMemberRouteDependencies,
  status: "active" | "disabled",
) {
  const auth = await authenticateRequest(context.req.raw, dependencies)
  if (!auth.ok) return writeAppError(context, auth.error)

  return withWorkspaceMemberStore(dependencies, async (store) => {
    const membershipId = context.req.param("membershipId")
    const result = await Effect.runPromise(
      Effect.either(
        status === "disabled"
          ? disableWorkspaceMember(store, auth.data, { membershipId })
          : reactivateWorkspaceMember(store, auth.data, { membershipId }),
      ),
    )
    if (result._tag === "Left") return writeAppError(context, result.left)
    return context.json(successEnvelope(result.right), 200)
  })
}

async function authenticateRequest(
  request: Request,
  dependencies: WorkspaceMemberRouteDependencies,
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

async function withWorkspaceMemberStore<T>(
  dependencies: WorkspaceMemberRouteDependencies,
  fn: (store: WorkspaceMemberStore) => Promise<T>,
) {
  if (dependencies.workspaceMemberStore) return fn(dependencies.workspaceMemberStore)

  const client = createDbClient()
  try {
    return await fn(createPostgresWorkspaceMemberStore(client))
  } finally {
    await client.end()
  }
}

function writeAppError(context: Context, error: AppError) {
  const mapped = mapAppErrorToHttp(error)
  return context.json(mapped.body, mapped.status, {
    "Cache-Control": "no-store",
  })
}
