import { createDbClient, type DbClient } from "@contextbase/core"
import type { StorageProvider } from "@contextbase/core/domains/files/storage"
import { createLocalDiskStorageProvider } from "@contextbase/core/domains/files/storage"
import { createS3StorageProvider } from "@contextbase/core/domains/files/storage-s3"
import { serve } from "@hono/node-server"

import { type CreateMcpAppOptions, createMcpApp } from "./app.js"

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

export type StartMcpServerOptions = {
  createDbClient?: () => DbClient
  createFileStorage?: (env: NodeJS.ProcessEnv) => StorageProvider
  createMcpApp?: (options: CreateMcpAppOptions) => { fetch: ServeOptions["fetch"] }
  env?: NodeJS.ProcessEnv
  process?: ProcessLike
  serve?: (options: ServeOptions) => ServerHandle
}

export type McpServerRuntime = {
  hostname: string
  port: number
  shutdown: (signal?: ServerSignal | "manual") => Promise<void>
}

export function startMcpServer(options: StartMcpServerOptions = {}): McpServerRuntime {
  const env = options.env ?? process.env
  const hostname = env.MCP_HOST ?? "0.0.0.0"
  const port = Number.parseInt(env.MCP_PORT ?? "3217", 10)
  const publicBaseUrl = env.MCP_PUBLIC_BASE_URL ?? `http://127.0.0.1:${port}`
  const dbClient = (options.createDbClient ?? createDbClient)()
  const fileStorage = (options.createFileStorage ?? createConfiguredStorageProvider)(env)
  const createApp = options.createMcpApp ?? createMcpApp
  const serveApp = options.serve ?? serve
  const processLike = options.process ?? process
  const app = createApp({
    authBaseUrl: env.CONTEXTBASE_AUTH_BASE_URL ?? "http://127.0.0.1:3317",
    dbClient,
    fileDownloadSecret:
      env.MCP_FILE_DOWNLOAD_SECRET ??
      env.OAUTH_TOKEN_HASH_PEPPER ??
      "contextbase-dev-file-download-secret",
    fileStorage,
    mcpResourceUrl: new URL("/mcp", publicBaseUrl).toString(),
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

function createConfiguredStorageProvider(env: NodeJS.ProcessEnv) {
  if (env.CONTEXTBASE_STORAGE_PROVIDER === "s3") {
    const bucket = env.CONTEXTBASE_STORAGE_S3_BUCKET
    const region = env.CONTEXTBASE_STORAGE_S3_REGION ?? env.AWS_REGION
    if (!bucket || !region) {
      throw new Error("S3 file storage requires CONTEXTBASE_STORAGE_S3_BUCKET and REGION")
    }
    return createS3StorageProvider({
      bucket,
      ...(env.CONTEXTBASE_STORAGE_S3_ENDPOINT
        ? { endpoint: env.CONTEXTBASE_STORAGE_S3_ENDPOINT }
        : {}),
      forcePathStyle: env.CONTEXTBASE_STORAGE_S3_FORCE_PATH_STYLE === "true",
      region,
    })
  }

  return createLocalDiskStorageProvider({
    rootDir: env.CONTEXTBASE_STORAGE_LOCAL_DIR ?? "/tmp/contextbase-files",
  })
}

function closeServer(server: ServerHandle) {
  if (!server.close) return Promise.resolve()

  return new Promise<void>((resolve) => {
    server.close?.(() => resolve())
  })
}
