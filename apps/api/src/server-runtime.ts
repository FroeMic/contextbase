import { createDbClient, type DbClient } from "@contextbase/core"
import { serve } from "@hono/node-server"

import { type CreateApiAppOptions, createApiApp } from "./app"
import {
  type ApiErrorReporter,
  createNoopApiErrorReporter,
  createPostHogApiErrorReporter,
} from "./http/error-reporter"
import { createLogger, type Logger } from "./http/logger"

type ServerSignal = "SIGINT" | "SIGTERM"

type ServerHandle = {
  close?: (callback?: () => void) => void
}

type ServeOptions = {
  fetch: (request: Request) => Response | Promise<Response>
  hostname: string
  port: number
}

type ProcessLike = {
  once: (signal: ServerSignal, listener: () => void) => void
}

export type StartApiServerOptions = {
  createApiApp?: (options: CreateApiAppOptions) => { fetch: ServeOptions["fetch"] }
  createApiErrorReporter?: (env: NodeJS.ProcessEnv, logger: Logger) => Promise<ApiErrorReporter>
  createDbClient?: () => DbClient
  env?: NodeJS.ProcessEnv
  logger?: Logger
  process?: ProcessLike
  serve?: (options: ServeOptions) => ServerHandle
}

export type ApiServerRuntime = {
  hostname: string
  port: number
  shutdown: (signal?: ServerSignal | "manual") => Promise<void>
}

export function startApiServer(options: StartApiServerOptions = {}): ApiServerRuntime {
  const env = options.env ?? process.env
  const port = Number.parseInt(env.API_PORT ?? "3017", 10)
  const hostname = env.API_HOST ?? "0.0.0.0"
  const logger = options.logger ?? createLogger()
  const createClient = options.createDbClient ?? createDbClient
  const createApp = options.createApiApp ?? createApiApp
  const createErrorReporter = options.createApiErrorReporter ?? createPostHogApiErrorReporter
  const serveApp = options.serve ?? serve
  const processLike = options.process ?? process
  const dbClient = createClient()
  const errorReporterPromise = createErrorReporter(env, logger).catch((error) => {
    logger.warn("posthog_error_tracking_disabled", {
      cause: String(error),
    })
    return createNoopApiErrorReporter()
  })
  const errorReporter = createDeferredApiErrorReporter(errorReporterPromise)

  logger.info("api_starting", { hostname, port })

  const app = createApp({ dbClient, errorReporter, logger })
  const server = serveApp({
    fetch: app.fetch,
    hostname,
    port,
  })
  let shutdownPromise: Promise<void> | null = null

  async function shutdown(signal: ServerSignal | "manual" = "manual") {
    shutdownPromise ??= (async () => {
      logger.info("api_stopping", { signal })
      await closeServer(server)
      await errorReporter.flush()
      await dbClient.end()
      logger.info("api_stopped", { signal })
    })()

    return shutdownPromise
  }

  processLike.once("SIGINT", () => {
    void shutdown("SIGINT")
  })
  processLike.once("SIGTERM", () => {
    void shutdown("SIGTERM")
  })

  logger.info("api_listening", { hostname, port })

  return {
    hostname,
    port,
    shutdown,
  }
}

function createDeferredApiErrorReporter(
  reporterPromise: Promise<ApiErrorReporter>,
): ApiErrorReporter {
  return {
    captureException: async (error, context) => {
      const reporter = await reporterPromise
      await reporter.captureException(error, context)
    },
    flush: async () => {
      const reporter = await reporterPromise
      await reporter.flush()
    },
  }
}

function closeServer(server: ServerHandle) {
  if (!server.close) return Promise.resolve()

  return new Promise<void>((resolve) => {
    server.close?.(() => resolve())
  })
}
