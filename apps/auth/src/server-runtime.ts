import { createDbClient, type DbClient } from "@contextbase/core"
import { createPostgresBrowserAuthStore } from "@contextbase/core/domains/auth/browser-session-repository"
import { createPostgresOAuthRepository } from "@contextbase/core/domains/oauth/repository"
import { serve } from "@hono/node-server"

import { type CreateAuthAppOptions, createAuthApp } from "./app.js"

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

export type StartAuthServerOptions = {
  createAuthApp?: (options: CreateAuthAppOptions) => { fetch: ServeOptions["fetch"] }
  createDbClient?: () => DbClient
  env?: NodeJS.ProcessEnv
  process?: ProcessLike
  serve?: (options: ServeOptions) => ServerHandle
}

export type AuthServerRuntime = {
  hostname: string
  port: number
  shutdown: (signal?: ServerSignal | "manual") => Promise<void>
}

export function startAuthServer(options: StartAuthServerOptions = {}): AuthServerRuntime {
  const env = options.env ?? process.env
  const hostname = env.AUTH_HOST ?? "0.0.0.0"
  const port = Number.parseInt(env.AUTH_PORT ?? "3317", 10)
  const dbClient = (options.createDbClient ?? createDbClient)()
  const oauthRepository = createPostgresOAuthRepository(dbClient)
  const createApp = options.createAuthApp ?? createAuthApp
  const serveApp = options.serve ?? serve
  const processLike = options.process ?? process
  const app = createApp({
    apiResourceUrl: env.CONTEXTBASE_API_RESOURCE_URL ?? "http://127.0.0.1:3017/api/v1",
    authBaseUrl: env.AUTH_PUBLIC_BASE_URL ?? `http://127.0.0.1:${port}`,
    browserAuthStore: createPostgresBrowserAuthStore(dbClient),
    mcpResourceUrl: env.CONTEXTBASE_MCP_RESOURCE_URL ?? "http://127.0.0.1:3217/mcp",
    oauthRepository,
    webBaseUrl: env.CONTEXTBASE_WEB_BASE_URL ?? "http://127.0.0.1:4017",
  })
  const server = serveApp({
    fetch: app.fetch,
    hostname,
    port,
  })
  let shutdownPromise: Promise<void> | null = null

  async function shutdown(_signal: ServerSignal | "manual" = "manual") {
    shutdownPromise ??= (async () => {
      await closeServer(server)
      await dbClient.end()
    })()

    return shutdownPromise
  }

  processLike.once("SIGINT", () => {
    void shutdown("SIGINT")
  })
  processLike.once("SIGTERM", () => {
    void shutdown("SIGTERM")
  })

  return {
    hostname,
    port,
    shutdown,
  }
}

function closeServer(server: ServerHandle) {
  if (!server.close) return Promise.resolve()

  return new Promise<void>((resolve) => {
    server.close?.(() => resolve())
  })
}
