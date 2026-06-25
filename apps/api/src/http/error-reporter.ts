import type { Logger } from "./logger"

export type ApiErrorReportContext = {
  auth?: {
    principalId?: string
    principalKind?: string
    workspaceId?: string
    workspaceSlug?: string
  }
  errorCode?: string
  method: string
  path: string
  requestId?: string
  routeKind?: "hono_uncaught" | "route_500_response"
  serviceName: "contextbase-api"
  status: 500
}

export type ApiErrorReportContextValue = ApiErrorReportContext & {
  error: unknown
}

export type ApiErrorReporter = {
  captureException: (error: unknown, context: ApiErrorReportContext) => Promise<void>
  flush: () => Promise<void>
}

export const apiErrorReportContextKey = "apiErrorReportContext"

type ContextVariableAccessor = {
  get: (key: string) => unknown
  set: (key: string, value: unknown) => void
}

export function getApiErrorReportContext(context: unknown): ApiErrorReportContextValue | undefined {
  return (context as ContextVariableAccessor).get(apiErrorReportContextKey) as
    | ApiErrorReportContextValue
    | undefined
}

export function setApiErrorReportContext(
  context: unknown,
  value: ApiErrorReportContextValue,
): void {
  ;(context as ContextVariableAccessor).set(apiErrorReportContextKey, value)
}

export type PostHogNodeClient = {
  captureException: (error: Error, distinctId: string, properties: Record<string, unknown>) => void
  flush: () => Promise<void>
}

export type PostHogNodeModule = {
  PostHog: new (token: string, options: { host: string }) => PostHogNodeClient
}

type PostHogReporterOptions = {
  loadPostHog?: () => Promise<PostHogNodeModule>
}

type PostHogReporterEnv = Partial<
  Record<
    | "NODE_ENV"
    | "POSTHOG_ENABLED"
    | "POSTHOG_ENVIRONMENT"
    | "POSTHOG_FLUSH_TIMEOUT_MS"
    | "POSTHOG_SERVER_HOST"
    | "POSTHOG_SERVICE_VERSION"
    | "POSTHOG_TOKEN",
    string
  >
>

const defaultServerHost = "https://eu.i.posthog.com"
const defaultFlushTimeoutMs = 500

export function createNoopApiErrorReporter(): ApiErrorReporter {
  return {
    captureException: async () => undefined,
    flush: async () => undefined,
  }
}

export async function createPostHogApiErrorReporter(
  env: PostHogReporterEnv,
  logger: Logger,
  options: PostHogReporterOptions = {},
): Promise<ApiErrorReporter> {
  if (!isTruthyEnv(env.POSTHOG_ENABLED)) return createNoopApiErrorReporter()

  const token = env.POSTHOG_TOKEN?.trim()
  if (!token) return createNoopApiErrorReporter()

  try {
    const module = await (options.loadPostHog ?? loadPostHogNode)()
    const client = new module.PostHog(token, {
      host: normalizeHost(env.POSTHOG_SERVER_HOST),
    })

    return createPostHogReporter(client, env, logger)
  } catch (error) {
    logger.warn("posthog_error_tracking_disabled", {
      cause: String(error),
    })
    return createNoopApiErrorReporter()
  }
}

function createPostHogReporter(
  client: PostHogNodeClient,
  env: PostHogReporterEnv,
  logger: Logger,
): ApiErrorReporter {
  return {
    captureException: async (error, context) => {
      try {
        client.captureException(
          normalizeError(error),
          distinctId(context),
          reportProperties(env, context),
        )
      } catch (cause) {
        logger.warn("posthog_error_capture_failed", {
          cause: String(cause),
        })
      }
    },
    flush: async () => {
      try {
        await withTimeout(client.flush(), flushTimeoutMs(env))
      } catch (cause) {
        logger.warn("posthog_error_flush_failed", {
          cause: String(cause),
        })
      }
    },
  }
}

async function loadPostHogNode(): Promise<PostHogNodeModule> {
  return import("posthog-node")
}

function reportProperties(env: PostHogReporterEnv, context: ApiErrorReportContext) {
  return withoutUndefined({
    environment: env.POSTHOG_ENVIRONMENT?.trim() || env.NODE_ENV || "production",
    error_code: context.errorCode,
    method: context.method,
    path: stripQuery(context.path),
    principal_id: context.auth?.principalId,
    principal_kind: context.auth?.principalKind,
    request_id: context.requestId,
    route_kind: context.routeKind,
    service_name: context.serviceName,
    service_version: env.POSTHOG_SERVICE_VERSION?.trim() || undefined,
    status: context.status,
    workspace_id: context.auth?.workspaceId,
    workspace_slug: context.auth?.workspaceSlug,
  })
}

function distinctId(context: ApiErrorReportContext): string {
  return context.auth?.principalId ?? context.auth?.workspaceId ?? "server:contextbase-api"
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error
  return new Error(String(error))
}

function stripQuery(path: string): string {
  if (!path.includes("?")) return path
  return path.slice(0, path.indexOf("?"))
}

function normalizeHost(host: string | undefined): string {
  const value = host?.trim()
  if (!value || value.startsWith("/")) return defaultServerHost
  return value
}

function flushTimeoutMs(env: PostHogReporterEnv): number {
  const parsed = Number.parseInt(env.POSTHOG_FLUSH_TIMEOUT_MS ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultFlushTimeoutMs
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> {
  let timeout: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<undefined>((resolve) => {
        timeout = setTimeout(() => resolve(undefined), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function withoutUndefined(input: Record<string, unknown>) {
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) output[key] = value
  }
  return output
}

function isTruthyEnv(value: string | undefined): boolean {
  return value === "true" || value === "1"
}
