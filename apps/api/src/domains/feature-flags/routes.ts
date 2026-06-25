import { createDbClient } from "@contextbase/core"
import {
  type AuthenticatedContext,
  authenticateBearerToken,
  extractBearerToken,
} from "@contextbase/core/domains/auth/authenticate"
import { createPostgresFeatureFlagStore } from "@contextbase/core/domains/feature-flags/repository"
import {
  createFeatureFlagRule,
  deleteFeatureFlagRule,
  type FeatureFlagRuleCondition,
  type FeatureFlagStore,
  featureFlags,
  listFeatureFlagRules,
  updateFeatureFlagRule,
} from "@contextbase/core/domains/feature-flags/service"
import {
  type AppError,
  AuthenticationError,
  InvalidRequestError,
  mapAppErrorToHttp,
} from "@contextbase/core/shared/errors"
import { listEnvelope, successEnvelope } from "@contextbase/core/shared/response"
import { Effect, Schema } from "effect"
import type { Context } from "hono"
import { Hono } from "hono"

export type FeatureFlagRouteDependencies = {
  authenticateApiToken?: (token: string) => Promise<AuthenticatedContext>
  featureFlagStore?: FeatureFlagStore
}

export function createFeatureFlagRouter(dependencies: FeatureFlagRouteDependencies = {}) {
  const app = new Hono()

  app.get("/api/v1/feature-flags", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies)
    if (!auth.ok) return writeAppError(context, auth.error)
    return context.json(successEnvelope(featureFlags), 200)
  })

  app.get("/api/v1/feature-flags/rules", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies)
    if (!auth.ok) return writeAppError(context, auth.error)

    return withStore(dependencies, async (store) => {
      const result = await Effect.runPromise(Effect.either(listFeatureFlagRules(store, auth.data)))
      if (result._tag === "Left") return writeAppError(context, result.left)
      return context.json(listEnvelope(result.right), 200)
    })
  })

  app.post("/api/v1/feature-flags/rules", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies)
    if (!auth.ok) return writeAppError(context, auth.error)
    const body = await readJsonBody(context, CreateFeatureFlagRuleBodySchema)
    if (!body.ok) return writeAppError(context, body.error)

    return withStore(dependencies, async (store) => {
      const createInput = {
        conditions: toFeatureFlagRuleConditions(body.data.conditions ?? []),
        flagKey: body.data.flagKey,
        value: body.data.value,
        ...(body.data.description !== undefined ? { description: body.data.description } : {}),
        ...(body.data.enabled !== undefined ? { enabled: body.data.enabled } : {}),
        ...(body.data.priority !== undefined ? { priority: body.data.priority } : {}),
      }
      const result = await Effect.runPromise(
        Effect.either(createFeatureFlagRule(store, auth.data, createInput)),
      )
      if (result._tag === "Left") return writeAppError(context, result.left)
      return context.json(successEnvelope(result.right), 201)
    })
  })

  app.patch("/api/v1/feature-flags/rules/:ruleId", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies)
    if (!auth.ok) return writeAppError(context, auth.error)
    const body = await readJsonBody(context, UpdateFeatureFlagRuleBodySchema)
    if (!body.ok) return writeAppError(context, body.error)

    return withStore(dependencies, async (store) => {
      const updateInput = {
        ruleId: context.req.param("ruleId"),
        ...(body.data.conditions !== undefined
          ? { conditions: toFeatureFlagRuleConditions(body.data.conditions) }
          : {}),
        ...(body.data.description !== undefined ? { description: body.data.description } : {}),
        ...(body.data.enabled !== undefined ? { enabled: body.data.enabled } : {}),
        ...(body.data.priority !== undefined ? { priority: body.data.priority } : {}),
        ...(body.data.value !== undefined ? { value: body.data.value } : {}),
      }
      const result = await Effect.runPromise(
        Effect.either(updateFeatureFlagRule(store, auth.data, updateInput)),
      )
      if (result._tag === "Left") return writeAppError(context, result.left)
      return context.json(successEnvelope(result.right), 200)
    })
  })

  app.delete("/api/v1/feature-flags/rules/:ruleId", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies)
    if (!auth.ok) return writeAppError(context, auth.error)

    return withStore(dependencies, async (store) => {
      const result = await Effect.runPromise(
        Effect.either(
          deleteFeatureFlagRule(store, auth.data, { ruleId: context.req.param("ruleId") }),
        ),
      )
      if (result._tag === "Left") return writeAppError(context, result.left)
      return context.json(successEnvelope({}), 200)
    })
  })

  return app
}

const FeatureFlagRuleConditionBodySchema = Schema.Struct({
  field: Schema.Literal(
    "user.id",
    "user.email",
    "workspace.id",
    "workspace.role",
    "workspace.slug",
  ),
  operator: Schema.Literal("contains", "equals", "notContains", "notEquals"),
  value: Schema.String,
})

const NullableStringSchema = Schema.NullOr(Schema.String)

const CreateFeatureFlagRuleBodySchema = Schema.Struct({
  conditions: Schema.optional(Schema.Array(FeatureFlagRuleConditionBodySchema)),
  description: Schema.optional(NullableStringSchema),
  enabled: Schema.optional(Schema.Boolean),
  flagKey: Schema.String,
  priority: Schema.optional(Schema.Number),
  value: Schema.Boolean,
})

const UpdateFeatureFlagRuleBodySchema = Schema.Struct({
  conditions: Schema.optional(Schema.Array(FeatureFlagRuleConditionBodySchema)),
  description: Schema.optional(NullableStringSchema),
  enabled: Schema.optional(Schema.Boolean),
  priority: Schema.optional(Schema.Number),
  value: Schema.optional(Schema.Boolean),
})

async function readJsonBody<T, I>(
  context: Context,
  schema: Schema.Schema<T, I, never>,
): Promise<{ data: T; ok: true } | { error: InvalidRequestError; ok: false }> {
  let rawBody: unknown
  try {
    rawBody = await context.req.json()
  } catch (cause) {
    return {
      error: new InvalidRequestError({
        code: "invalid_request",
        details: { cause: String(cause) },
        message: "Invalid JSON request body",
      }),
      ok: false,
    }
  }

  const decoded = Schema.decodeUnknownEither(schema)(rawBody)
  if (decoded._tag === "Left") {
    return {
      error: new InvalidRequestError({
        code: "invalid_request",
        details: { reason: decoded.left.message },
        message: "Invalid request body",
      }),
      ok: false,
    }
  }

  return { data: decoded.right, ok: true }
}

function toFeatureFlagRuleConditions(
  conditions: readonly Schema.Schema.Type<typeof FeatureFlagRuleConditionBodySchema>[],
): FeatureFlagRuleCondition[] {
  return conditions.map((condition) => ({ ...condition }))
}

async function withStore<T>(
  dependencies: FeatureFlagRouteDependencies,
  handler: (store: FeatureFlagStore) => Promise<T>,
) {
  if (dependencies.featureFlagStore) return handler(dependencies.featureFlagStore)
  const client = createDbClient()
  try {
    return await handler(createPostgresFeatureFlagStore(client))
  } finally {
    await client.end()
  }
}

async function authenticateRequest(request: Request, dependencies: FeatureFlagRouteDependencies) {
  const token = extractBearerToken(request)
  if (!token) {
    return {
      error: new AuthenticationError({
        code: "unauthenticated",
        message: "Missing bearer token",
      }),
      ok: false as const,
    }
  }

  try {
    if (dependencies.authenticateApiToken) {
      return { data: await dependencies.authenticateApiToken(token), ok: true as const }
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
  } catch (cause) {
    if (cause instanceof AuthenticationError) return { error: cause, ok: false as const }
    return {
      error: new AuthenticationError({
        code: "unauthenticated",
        details: { cause: String(cause) },
        message: "Invalid bearer token",
      }),
      ok: false as const,
    }
  }
}

function writeAppError(context: Context, error: AppError) {
  const mapped = mapAppErrorToHttp(error)
  return context.json(mapped.body, mapped.status, { "Cache-Control": "no-store" })
}
