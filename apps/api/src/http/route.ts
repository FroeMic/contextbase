import { randomUUID } from "node:crypto"

import {
  extractBearerToken,
  requireAuthenticatedScope,
} from "@contextbase/core/domains/auth/authenticate"
import {
  type AppError,
  AuthenticationError,
  ConflictError,
  ForbiddenError,
  InternalError,
  InvalidRequestError,
  InvariantViolationError,
  mapAppErrorToHttp,
  NotFoundError,
} from "@contextbase/core/shared/errors"
import { listEnvelope, successEnvelope } from "@contextbase/core/shared/response"
import { Effect, Either, Schema } from "effect"
import type { Context, Handler } from "hono"

import type { ApiRequestContext, ApiServices, RouteDependencies } from "./context"
import { setApiErrorReportContext } from "./error-reporter"

export type RouteResponseMode = "list" | "success"

export type RouteConfig<
  TParams,
  TQuery,
  TBody,
  TSuccess,
  TParamsInput = unknown,
  TQueryInput = unknown,
  TBodyInput = unknown,
> = {
  body?: Schema.Schema<TBody, TBodyInput, never>
  bodyOptional?: boolean
  handler: (
    context: ApiRequestContext & {
      body: TBody
      params: TParams
      query: TQuery
    },
  ) => Effect.Effect<TSuccess, AppError>
  params?: Schema.Schema<TParams, TParamsInput, never>
  query?: Schema.Schema<TQuery, TQueryInput, never>
  response: RouteResponseMode
  status?: 200 | 201
}

type PagedListResult<TData> = {
  data: TData[]
  page: {
    nextCursor?: string | null
  }
}

const jsonHeaders = (requestId: string) => ({
  "Cache-Control": "no-store",
  "X-Request-Id": requestId,
})

export function route<
  TParams = Record<string, never>,
  TQuery = Record<string, never>,
  TBody = Record<string, never>,
  TSuccess = unknown,
  TParamsInput = unknown,
  TQueryInput = unknown,
  TBodyInput = unknown,
>(
  config: RouteConfig<TParams, TQuery, TBody, TSuccess, TParamsInput, TQueryInput, TBodyInput>,
  dependencies: RouteDependencies = {},
): Handler {
  return async (context) => {
    const requestId = dependencies.requestId?.() ?? randomUUID()

    const token = extractBearerToken(context.req.raw)
    if (!token) {
      return writeAppError(
        context,
        new AuthenticationError({
          code: "unauthenticated",
          message: "Missing API token",
        }),
        requestId,
      )
    }

    const auth = await authenticate(token, dependencies)
    if (!auth.ok) return writeAppError(context, auth.error, requestId)

    const scopeError = requireAuthenticatedScope(
      auth.data,
      context.req.method === "GET" || context.req.method === "HEAD"
        ? "contextbase:read"
        : "contextbase:write",
    )
    if (scopeError) return writeAppError(context, scopeError, requestId)

    const params = decodeInput(config.params, context.req.param(), "params")
    if (!params.ok) return writeAppError(context, params.error, requestId)

    const query = decodeInput(config.query, readQueryInput(context), "query")
    if (!query.ok) return writeAppError(context, query.error, requestId)

    const body = await readBody(context, config.body, { optional: config.bodyOptional ?? false })
    if (!body.ok) return writeAppError(context, body.error, requestId)

    try {
      const result = await Effect.runPromise(
        Effect.either(
          config.handler({
            auth: auth.data,
            body: body.data,
            params: params.data,
            query: query.data,
            requestId,
            services: dependencies.services ?? ({} as ApiServices),
          }),
        ),
      )

      if (Either.isLeft(result)) return writeAppError(context, result.left, requestId)

      if (config.response === "list") {
        return writeListResponse(context, result.right, requestId)
      }

      return context.json(
        successEnvelope(result.right),
        config.status ?? 200,
        jsonHeaders(requestId),
      )
    } catch (error) {
      dependencies.logger?.error("http_route_defect", {
        cause: String(error),
        requestId,
      })

      setApiErrorReportContext(context, {
        auth: {
          principalId: auth.data.principalId,
          principalKind: auth.data.principalKind,
          workspaceId: auth.data.workspaceId,
          workspaceSlug: auth.data.workspaceSlug,
        },
        error,
        errorCode: "internal_error",
        method: context.req.method,
        path: new URL(context.req.url).pathname,
        requestId,
        routeKind: "route_500_response",
        serviceName: "contextbase-api",
        status: 500,
      })

      return writeAppError(
        context,
        new InternalError({
          code: "internal_error",
          details: {},
          message: "Internal server error",
        }),
        requestId,
      )
    }
  }
}

async function authenticate(token: string, dependencies: RouteDependencies) {
  try {
    if (!dependencies.authenticateApiToken) {
      return {
        error: new InternalError({
          code: "internal_error",
          message: "Route authenticator is not configured",
        }),
        ok: false as const,
      }
    }

    return {
      data: await dependencies.authenticateApiToken(token),
      ok: true as const,
    }
  } catch (error) {
    return {
      error: normalizeAppError(error, {
        fallbackCode: "unauthenticated",
        fallbackMessage: "Invalid API token",
      }),
      ok: false as const,
    }
  }
}

function decodeInput<T, I>(
  schema: Schema.Schema<T, I, never> | undefined,
  input: unknown,
  inputKind: "body" | "params" | "query",
) {
  if (!schema) {
    return {
      data: {} as T,
      ok: true as const,
    }
  }

  const decoded = Schema.decodeUnknownEither(schema)(input)
  if (Either.isLeft(decoded)) {
    return {
      error: new InvalidRequestError({
        code: "invalid_request",
        details: {
          reason: decoded.left.message,
        },
        message: `Invalid request ${inputKind}`,
      }),
      ok: false as const,
    }
  }

  return {
    data: decoded.right,
    ok: true as const,
  }
}

async function readBody<T, I>(
  context: Context,
  schema: Schema.Schema<T, I, never> | undefined,
  options: { optional: boolean },
) {
  if (!schema) {
    return {
      data: {} as T,
      ok: true as const,
    }
  }

  if (options.optional && !context.req.header("content-type")?.includes("application/json")) {
    return {
      data: {} as T,
      ok: true as const,
    }
  }

  let rawBody: unknown

  try {
    rawBody = await context.req.json()
  } catch (error) {
    return {
      error: new InvalidRequestError({
        code: "invalid_request",
        details: {
          cause: String(error),
        },
        message: "Malformed JSON request body",
      }),
      ok: false as const,
    }
  }

  return decodeInput(schema, rawBody, "body")
}

function readQueryInput(context: Context) {
  const url = new URL(context.req.url)
  const query: Record<string, unknown> = {}
  const keys = new Set(url.searchParams.keys())

  for (const key of keys) {
    const values = url.searchParams
      .getAll(key)
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean)

    if (values.length === 0) continue
    query[key] =
      values.length === 1 && !arrayQueryKeys.has(key)
        ? coerceQueryValue(key, values[0] as string)
        : values.map((value) => coerceQueryValue(key, value))
  }

  return query
}

function coerceQueryValue(key: string, value: string): boolean | number | string {
  if (booleanQueryKeys.has(key)) {
    if (value === "true") return true
    if (value === "false") return false
  }

  if (numberQueryKeys.has(key)) {
    const numberValue = Number(value)
    if (Number.isFinite(numberValue)) return numberValue
  }

  return value
}

const booleanQueryKeys = new Set(["available", "blocked", "hasClaim", "includeResolved"])
const numberQueryKeys = new Set(["limit"])
const arrayQueryKeys = new Set(["label", "priority", "status", "with"])

function writeListResponse(context: Context, result: unknown, requestId: string) {
  if (isPagedListResult(result)) {
    return context.json(
      listEnvelope(result.data, { nextCursor: result.page.nextCursor ?? null }),
      200,
      jsonHeaders(requestId),
    )
  }

  return context.json(
    listEnvelope(Array.isArray(result) ? result : []),
    200,
    jsonHeaders(requestId),
  )
}

function isPagedListResult(value: unknown): value is PagedListResult<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    Array.isArray(value.data) &&
    "page" in value &&
    typeof value.page === "object" &&
    value.page !== null
  )
}

function writeAppError(context: Context, error: AppError, requestId: string) {
  const mapped = mapAppErrorToHttp(error)
  return context.json(mapped.body, mapped.status, jsonHeaders(requestId))
}

function normalizeAppError(
  error: unknown,
  fallback: {
    fallbackCode: "internal_error" | "unauthenticated"
    fallbackMessage: string
  },
): AppError {
  if (
    error instanceof AuthenticationError ||
    error instanceof ConflictError ||
    error instanceof ForbiddenError ||
    error instanceof InternalError ||
    error instanceof InvalidRequestError ||
    error instanceof InvariantViolationError ||
    error instanceof NotFoundError
  ) {
    return error
  }

  if (isAppErrorLike(error)) return error

  if (fallback.fallbackCode === "unauthenticated") {
    return new AuthenticationError({
      code: "unauthenticated",
      details: {
        cause: String(error),
      },
      message: fallback.fallbackMessage,
    })
  }

  return new InternalError({
    code: "internal_error",
    details: {
      cause: String(error),
    },
    message: fallback.fallbackMessage,
  })
}

function isAppErrorLike(error: unknown): error is AppError {
  if (typeof error !== "object" || error === null || !("_tag" in error)) return false
  const tag = String(error._tag)
  return (
    tag === "AuthenticationError" ||
    tag === "ConflictError" ||
    tag === "ForbiddenError" ||
    tag === "InternalError" ||
    tag === "InvalidRequestError" ||
    tag === "InvariantViolationError" ||
    tag === "NotFoundError"
  )
}
