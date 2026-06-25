import { createDbClient } from "@contextbase/core"
import {
  type AuthenticatedContext,
  authenticateBearerToken,
  extractBearerToken,
} from "@contextbase/core/domains/auth/authenticate"
import { createPostgresUserStore } from "@contextbase/core/domains/users/repository"
import {
  createUser,
  getUser,
  listUsers,
  type UserStore,
  updateUser,
} from "@contextbase/core/domains/users/service"
import {
  type AppError,
  AuthenticationError,
  mapAppErrorToHttp,
} from "@contextbase/core/shared/errors"
import { listEnvelope, successEnvelope } from "@contextbase/core/shared/response"
import { Effect } from "effect"
import type { Context } from "hono"
import { Hono } from "hono"

export type UserRouteDependencies = {
  authenticateApiToken?: (token: string) => Promise<AuthenticatedContext>
  userStore?: UserStore
}

export function createUserRouter(dependencies: UserRouteDependencies = {}) {
  const app = new Hono()

  app.get("/api/v1/users", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies)

    if (!auth.ok) {
      return writeAppError(context, auth.error)
    }

    return withUserStore(dependencies, async (store) => {
      const result = await Effect.runPromise(Effect.either(listUsers(store, auth.data)))

      if (result._tag === "Left") {
        return writeAppError(context, result.left)
      }

      return context.json(listEnvelope(result.right), 200)
    })
  })

  app.post("/api/v1/users", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies)

    if (!auth.ok) {
      return writeAppError(context, auth.error)
    }

    const body = (await context.req.json()) as {
      displayName: string
      email?: string | null
      primaryChannelKind?: string | null
      primaryChannelRef?: string | null
      role?: string
    }

    return withUserStore(dependencies, async (store) => {
      const result = await Effect.runPromise(Effect.either(createUser(store, auth.data, body)))

      if (result._tag === "Left") {
        return writeAppError(context, result.left)
      }

      return context.json(successEnvelope(result.right), 201)
    })
  })

  app.get("/api/v1/users/:userId", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies)

    if (!auth.ok) {
      return writeAppError(context, auth.error)
    }

    return withUserStore(dependencies, async (store) => {
      const result = await Effect.runPromise(
        Effect.either(
          getUser(store, auth.data, {
            userId: context.req.param("userId"),
          }),
        ),
      )

      if (result._tag === "Left") {
        return writeAppError(context, result.left)
      }

      return context.json(successEnvelope(result.right), 200)
    })
  })

  app.patch("/api/v1/users/:userId", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies)

    if (!auth.ok) {
      return writeAppError(context, auth.error)
    }

    const body = (await context.req.json()) as {
      displayName?: string
      email?: string | null
      primaryChannelKind?: string | null
      primaryChannelRef?: string | null
      status?: string
    }

    return withUserStore(dependencies, async (store) => {
      const result = await Effect.runPromise(
        Effect.either(
          updateUser(store, auth.data, {
            ...body,
            userId: context.req.param("userId"),
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

async function authenticateRequest(request: Request, dependencies: UserRouteDependencies) {
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

async function withUserStore<T>(
  dependencies: UserRouteDependencies,
  fn: (store: UserStore) => Promise<T>,
) {
  if (dependencies.userStore) {
    return fn(dependencies.userStore)
  }

  const client = createDbClient()

  try {
    return await fn(createPostgresUserStore(client))
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
