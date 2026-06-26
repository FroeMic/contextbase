import { createDbClient, type DbClient } from "@contextbase/core"
import {
  type AuthenticatedContext,
  authenticateBearerToken,
  extractBearerToken,
  requireAuthenticatedScope,
} from "@contextbase/core/domains/auth/authenticate"
import {
  type AppError,
  AuthenticationError,
  mapAppErrorToHttp,
} from "@contextbase/core/shared/errors"
import { errorEnvelope, successEnvelope } from "@contextbase/core/shared/response"
import { Effect } from "effect"
import type { Context } from "hono"
import { Hono } from "hono"

import {
  createFeatureFlagRouter,
  type FeatureFlagRouteDependencies,
} from "./domains/feature-flags/routes"
import { createFileRouter, type FileRouteDependencies } from "./domains/files/routes"
import {
  createWorkspaceInvitationRouter,
  type WorkspaceInvitationRouteDependencies,
} from "./domains/invitations/routes"
import {
  createSessionCaptureRouter,
  type SessionCaptureRouteDependencies,
} from "./domains/session-capture/routes"
import { createUserRouter, type UserRouteDependencies } from "./domains/users/routes"
import {
  createWorkspaceMemberRouter,
  type WorkspaceMemberRouteDependencies,
} from "./domains/workspace-members/routes"
import { createWorkspaceRouter, type WorkspaceRouteDependencies } from "./domains/workspaces/routes"
import {
  type ApiErrorReportContext,
  type ApiErrorReportContextValue,
  type ApiErrorReporter,
  createNoopApiErrorReporter,
  getApiErrorReportContext,
} from "./http/error-reporter"
import type { Logger } from "./http/logger"
import { requiredScopeForApiRequest } from "./http/route-policy"

const apiErrorAlreadyReportedKey = "apiErrorAlreadyReported"
type ContextVariableAccessor = {
  get: (key: string) => unknown
  set: (key: string, value: unknown) => void
}

export type CreateApiAppOptions = {
  authenticateApiToken?: (token: string) => Promise<AuthenticatedContext>
  dbClient?: DbClient
  errorReporter?: ApiErrorReporter
  featureFlagStore?: FeatureFlagRouteDependencies["featureFlagStore"]
  fileStorage?: FileRouteDependencies["fileStorage"]
  fileStore?: FileRouteDependencies["fileStore"]
  invitationStore?: WorkspaceInvitationRouteDependencies["invitationStore"]
  logger?: Logger
  sendWorkspaceInvitationEmail?: WorkspaceInvitationRouteDependencies["sendWorkspaceInvitationEmail"]
  sessionCaptureStore?: SessionCaptureRouteDependencies["sessionCaptureStore"]
  uploadsPublicBaseUrl?: FileRouteDependencies["uploadsPublicBaseUrl"]
  userStore?: UserRouteDependencies["userStore"]
  workspaceMemberStore?: WorkspaceMemberRouteDependencies["workspaceMemberStore"]
  workspaceStore?: WorkspaceRouteDependencies["workspaceStore"]
}

export function createApiApp(options: CreateApiAppOptions = {}) {
  const app = new Hono()
  const errorReporter = options.errorReporter ?? createNoopApiErrorReporter()
  const featureFlagDependencies: FeatureFlagRouteDependencies = {}
  const fileDependencies: FileRouteDependencies = {}
  const invitationDependencies: WorkspaceInvitationRouteDependencies = {}
  const userDependencies: UserRouteDependencies = {}
  const workspaceMemberDependencies: WorkspaceMemberRouteDependencies = {}
  const workspaceDependencies: WorkspaceRouteDependencies = {}
  const sessionCaptureDependencies: SessionCaptureRouteDependencies = {}

  if (options.authenticateApiToken) {
    featureFlagDependencies.authenticateApiToken = options.authenticateApiToken
    fileDependencies.authenticateApiToken = options.authenticateApiToken
    invitationDependencies.authenticateApiToken = options.authenticateApiToken
    userDependencies.authenticateApiToken = options.authenticateApiToken
    workspaceMemberDependencies.authenticateApiToken = options.authenticateApiToken
    workspaceDependencies.authenticateApiToken = options.authenticateApiToken
    sessionCaptureDependencies.authenticateApiToken = options.authenticateApiToken
  }

  if (options.featureFlagStore) {
    featureFlagDependencies.featureFlagStore = options.featureFlagStore
  }

  if (options.fileStore) {
    fileDependencies.fileStore = options.fileStore
    sessionCaptureDependencies.fileStore = options.fileStore
  }

  if (options.fileStorage) {
    fileDependencies.fileStorage = options.fileStorage
    sessionCaptureDependencies.fileStorage = options.fileStorage
  }

  if (options.uploadsPublicBaseUrl) {
    fileDependencies.uploadsPublicBaseUrl = options.uploadsPublicBaseUrl
  }

  if (options.invitationStore) {
    invitationDependencies.invitationStore = options.invitationStore
  }

  if (options.sendWorkspaceInvitationEmail) {
    invitationDependencies.sendWorkspaceInvitationEmail = options.sendWorkspaceInvitationEmail
  }

  if (options.dbClient) {
    fileDependencies.dbClient = options.dbClient
    sessionCaptureDependencies.dbClient = options.dbClient
  }

  if (options.userStore) {
    userDependencies.userStore = options.userStore
  }

  if (options.workspaceMemberStore) {
    workspaceMemberDependencies.workspaceMemberStore = options.workspaceMemberStore
  }

  if (options.workspaceStore) {
    workspaceDependencies.workspaceStore = options.workspaceStore
  }

  if (options.sessionCaptureStore) {
    sessionCaptureDependencies.sessionCaptureStore = options.sessionCaptureStore
  }

  if (options.logger) {
    app.use("*", async (context, next) => {
      const startedAt = Date.now()
      await next()
      options.logger?.info("http_request", {
        latencyMs: Date.now() - startedAt,
        method: context.req.method,
        path: new URL(context.req.url).pathname,
        status: context.res.status,
      })
    })
  }

  app.onError(async (error, context) => {
    await errorReporter.captureException(
      error,
      reportContext({
        method: context.req.method,
        path: new URL(context.req.url).pathname,
        routeKind: "hono_uncaught",
      }),
    )
    setContextValue(context, apiErrorAlreadyReportedKey, true)

    return context.json(errorEnvelope("internal_error", "Internal server error"), 500, {
      "Cache-Control": "no-store",
    })
  })

  app.use("*", async (context, next) => {
    await next()

    const path = new URL(context.req.url).pathname
    if (path === "/healthz" || context.res.status !== 500) return
    if (getContextValue(context, apiErrorAlreadyReportedKey)) return

    const stashed = getApiErrorReportContext(context)

    await errorReporter.captureException(
      stashed?.error ?? new Error("API route returned 500"),
      reportContext({
        auth: stashed?.auth,
        errorCode: stashed?.errorCode,
        method: stashed?.method ?? context.req.method,
        path: stashed?.path ?? path,
        requestId: stashed?.requestId ?? context.res.headers.get("x-request-id") ?? undefined,
        routeKind: "route_500_response",
      }),
    )
  })

  app.get("/healthz", (context) => {
    return context.json(
      successEnvelope({
        service: "api",
        status: "ok",
      }),
      200,
      {
        "Cache-Control": "no-store",
      },
    )
  })

  app.use("/api/v1/*", async (context, next) => {
    if (isCaptureClientAuthenticatedRoute(context.req.raw)) {
      await next()
      return
    }

    const token = extractBearerToken(context.req.raw)

    if (!token) {
      return writeAppError(
        context,
        new AuthenticationError({
          code: "unauthenticated",
          message: "Missing API token",
        }),
      )
    }

    const result = await runAuthenticator(options, token)
    if (!result.ok) return writeAppError(context, result.error)

    const scopeError = requireAuthenticatedScope(
      result.data,
      requiredScopeForApiRequest(context.req.raw),
    )
    if (scopeError) return writeAppError(context, scopeError)

    await next()
  })

  app.get("/api/v1/auth/probe", async (context) => {
    const token = extractBearerToken(context.req.raw)

    if (!token) {
      return writeAppError(
        context,
        new AuthenticationError({
          code: "unauthenticated",
          message: "Missing API token",
        }),
      )
    }

    const result = await runAuthenticator(options, token)

    if (result.ok) {
      return context.json(successEnvelope(result.data), 200)
    }

    return writeAppError(context, result.error)
  })

  app.route("/", createFeatureFlagRouter(featureFlagDependencies))
  app.route("/", createFileRouter(fileDependencies))
  app.route("/", createWorkspaceInvitationRouter(invitationDependencies))
  app.route("/", createUserRouter(userDependencies))
  app.route("/", createWorkspaceMemberRouter(workspaceMemberDependencies))
  app.route("/", createWorkspaceRouter(workspaceDependencies))
  app.route("/", createSessionCaptureRouter(sessionCaptureDependencies))

  app.notFound((context) => {
    return context.json(errorEnvelope("not_found", "Route not found"), 404, {
      "Cache-Control": "no-store",
    })
  })

  return app
}

function isCaptureClientAuthenticatedRoute(request: Request) {
  const url = new URL(request.url)
  return (
    request.method.toUpperCase() === "POST" &&
    (url.pathname === "/api/v1/session-capture/sync/manual" ||
      url.pathname === "/api/v1/session-capture/files")
  )
}

function reportContext(input: {
  auth?: ApiErrorReportContextValue["auth"] | undefined
  errorCode?: string | undefined
  method: string
  path: string
  requestId?: string | undefined
  routeKind: "hono_uncaught" | "route_500_response"
}): ApiErrorReportContext {
  const context: ApiErrorReportContext = {
    method: input.method,
    path: input.path,
    routeKind: input.routeKind,
    serviceName: "contextbase-api",
    status: 500,
  }

  if (input.auth) context.auth = input.auth
  if (input.errorCode) context.errorCode = input.errorCode
  if (input.requestId) context.requestId = input.requestId

  return context
}

function setContextValue(context: unknown, key: string, value: unknown): void {
  ;(context as ContextVariableAccessor).set(key, value)
}

function getContextValue(context: unknown, key: string): unknown {
  return (context as ContextVariableAccessor).get(key)
}

export type AppType = ReturnType<typeof createApiApp>

async function runAuthenticator(
  options: CreateApiAppOptions,
  token: string,
): Promise<
  | {
      data: AuthenticatedContext
      ok: true
    }
  | {
      error: AppError
      ok: false
    }
> {
  try {
    if (options.authenticateApiToken) {
      return {
        data: await options.authenticateApiToken(token),
        ok: true,
      }
    }

    const client = options.dbClient ?? createDbClient()

    try {
      return {
        data: await Effect.runPromise(authenticateBearerToken(client, token)),
        ok: true,
      }
    } finally {
      if (!options.dbClient) await client.end()
    }
  } catch (error) {
    return {
      error: normalizeAuthError(error),
      ok: false,
    }
  }
}

function normalizeAuthError(error: unknown): AppError {
  if (
    error instanceof AuthenticationError ||
    (typeof error === "object" && error !== null && "_tag" in error)
  ) {
    return error as AppError
  }

  return new AuthenticationError({
    code: "unauthenticated",
    details: {
      cause: String(error),
    },
    message: "Invalid API token",
  })
}

function writeAppError(context: Context, error: AppError) {
  const mapped = mapAppErrorToHttp(error)

  return context.json(mapped.body, mapped.status, {
    "Cache-Control": "no-store",
  })
}
