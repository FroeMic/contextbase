import { createDbClient } from "@contextbase/core"
import {
  type AuthenticatedContext,
  authenticateBearerToken,
  extractBearerToken,
} from "@contextbase/core/domains/auth/authenticate"
import type { UpdateWorkspaceInput } from "@contextbase/core/domains/workspaces/contracts"
import { createPostgresWorkspaceStore } from "@contextbase/core/domains/workspaces/repository"
import {
  archiveWorkspace,
  createWorkspace,
  getWorkspace,
  listWorkspaces,
  reactivateWorkspace,
  renameWorkspaceSlug,
  updateWorkspace,
  type WorkspaceStore,
} from "@contextbase/core/domains/workspaces/service"
import {
  type AppError,
  AuthenticationError,
  mapAppErrorToHttp,
} from "@contextbase/core/shared/errors"
import { listEnvelope, successEnvelope } from "@contextbase/core/shared/response"
import { Effect } from "effect"
import type { Context } from "hono"
import { Hono } from "hono"

export type WorkspaceRouteDependencies = {
  authenticateApiToken?: (token: string) => Promise<AuthenticatedContext>
  workspaceStore?: WorkspaceStore
}

export function createWorkspaceRouter(dependencies: WorkspaceRouteDependencies = {}) {
  const app = new Hono()

  app.get("/api/v1/workspaces", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies)

    if (!auth.ok) {
      return writeAppError(context, auth.error)
    }

    return withWorkspaceStore(dependencies, async (store) => {
      const result = await Effect.runPromise(Effect.either(listWorkspaces(store, auth.data)))

      if (result._tag === "Left") {
        return writeAppError(context, result.left)
      }

      return context.json(listEnvelope(result.right), 200)
    })
  })

  app.post("/api/v1/workspaces", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies)

    if (!auth.ok) {
      return writeAppError(context, auth.error)
    }

    const body = (await context.req.json()) as { workspaceName: string; workspaceSlug: string }

    return withWorkspaceStore(dependencies, async (store) => {
      const result = await Effect.runPromise(Effect.either(createWorkspace(store, auth.data, body)))

      if (result._tag === "Left") {
        return writeAppError(context, result.left)
      }

      return context.json(successEnvelope(result.right), 201)
    })
  })

  app.get("/api/v1/workspaces/:workspaceIdOrSlug", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies)

    if (!auth.ok) {
      return writeAppError(context, auth.error)
    }

    return withWorkspaceStore(dependencies, async (store) => {
      const result = await Effect.runPromise(
        Effect.either(
          getWorkspace(store, auth.data, {
            workspaceIdOrSlug: context.req.param("workspaceIdOrSlug"),
          }),
        ),
      )

      if (result._tag === "Left") {
        return writeAppError(context, result.left)
      }

      return context.json(successEnvelope(result.right), 200)
    })
  })

  app.patch("/api/v1/workspaces/:workspaceIdOrSlug", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies)

    if (!auth.ok) {
      return writeAppError(context, auth.error)
    }

    const body = (await context.req.json()) as Omit<UpdateWorkspaceInput, "workspaceIdOrSlug">

    return withWorkspaceStore(dependencies, async (store) => {
      const result = await Effect.runPromise(
        Effect.either(
          updateWorkspace(store, auth.data, {
            ...body,
            workspaceIdOrSlug: context.req.param("workspaceIdOrSlug"),
          }),
        ),
      )

      if (result._tag === "Left") {
        return writeAppError(context, result.left)
      }

      return context.json(successEnvelope(result.right), 200)
    })
  })

  app.post("/api/v1/workspaces/:workspaceIdOrSlug/archive", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies)

    if (!auth.ok) {
      return writeAppError(context, auth.error)
    }

    return withWorkspaceStore(dependencies, async (store) => {
      const result = await Effect.runPromise(
        Effect.either(
          archiveWorkspace(store, auth.data, {
            workspaceIdOrSlug: context.req.param("workspaceIdOrSlug"),
          }),
        ),
      )

      if (result._tag === "Left") {
        return writeAppError(context, result.left)
      }

      return context.json(successEnvelope(result.right), 200)
    })
  })

  app.post("/api/v1/workspaces/:workspaceIdOrSlug/reactivate", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies)

    if (!auth.ok) {
      return writeAppError(context, auth.error)
    }

    return withWorkspaceStore(dependencies, async (store) => {
      const result = await Effect.runPromise(
        Effect.either(
          reactivateWorkspace(store, auth.data, {
            workspaceIdOrSlug: context.req.param("workspaceIdOrSlug"),
          }),
        ),
      )

      if (result._tag === "Left") {
        return writeAppError(context, result.left)
      }

      return context.json(successEnvelope(result.right), 200)
    })
  })

  app.post("/api/v1/workspaces/:workspaceIdOrSlug/rename-slug", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies)

    if (!auth.ok) {
      return writeAppError(context, auth.error)
    }

    const body = (await context.req.json()) as { newSlug: string }

    return withWorkspaceStore(dependencies, async (store) => {
      const result = await Effect.runPromise(
        Effect.either(
          renameWorkspaceSlug(store, auth.data, {
            newSlug: body.newSlug,
            workspaceIdOrSlug: context.req.param("workspaceIdOrSlug"),
          }),
        ),
      )

      if (result._tag === "Left") {
        return writeAppError(context, result.left)
      }

      return context.json(successEnvelope(result.right), 200)
    })
  })

  return app
}

async function authenticateRequest(request: Request, dependencies: WorkspaceRouteDependencies) {
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

async function withWorkspaceStore<T>(
  dependencies: WorkspaceRouteDependencies,
  fn: (store: WorkspaceStore) => Promise<T>,
) {
  if (dependencies.workspaceStore) {
    return fn(dependencies.workspaceStore)
  }

  const client = createDbClient()

  try {
    return await fn(createPostgresWorkspaceStore(client))
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
