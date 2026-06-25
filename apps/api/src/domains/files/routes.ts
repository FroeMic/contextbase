import { Readable } from "node:stream"

import { createDbClient, type DbClient } from "@contextbase/core"
import {
  type AuthenticatedContext,
  authenticateBearerToken,
  extractBearerToken,
  requireAuthenticatedScope,
} from "@contextbase/core/domains/auth/authenticate"
import { createPostgresFileStore } from "@contextbase/core/domains/files/repository"
import { type FileStore, getFileContentDescriptor } from "@contextbase/core/domains/files/service"
import {
  createLocalDiskStorageProvider,
  StorageError,
  type StorageProvider,
  sanitizeDownloadFilename,
} from "@contextbase/core/domains/files/storage"
import {
  type AppError,
  AuthenticationError,
  InternalError,
  mapAppErrorToHttp,
} from "@contextbase/core/shared/errors"
import { Effect, Either } from "effect"
import type { Context } from "hono"
import { Hono } from "hono"

export type FileRouteDependencies = {
  authenticateApiToken?: (token: string) => Promise<AuthenticatedContext>
  dbClient?: DbClient
  fileStorage?: StorageProvider
  fileStore?: FileStore
  uploadsPublicBaseUrl?: string
}

export function createFileRouter(dependencies: FileRouteDependencies = {}) {
  const app = new Hono()

  app.get("/api/v1/files/:fileId/content", async (context) => {
    const auth = await authenticateRequest(context.req.raw, dependencies, "contextbase:files")
    if (!auth.ok) return writeAppError(context, auth.error)

    return withFileStore(dependencies, async (store) => {
      const descriptor = await runFileEffect(
        getFileContentDescriptor(store, auth.data, { fileId: context.req.param("fileId") }),
      )
      if (!descriptor.ok) return writeAppError(context, descriptor.error)

      const storage = await getFileStorage(dependencies)
      const storageResult = await runStorageEffect(storage.getObject(descriptor.data.objectKey))
      if (!storageResult.ok) return writeAppError(context, storageResult.error)

      return new Response(toResponseBody(storageResult.data.body), {
        headers: contentHeaders({
          byteSize: descriptor.data.byteSize,
          contentType: descriptor.data.contentType,
          originalFilename: descriptor.data.originalFilename,
        }),
        status: 200,
      })
    })
  })

  return app
}

async function authenticateRequest(
  request: Request,
  dependencies: FileRouteDependencies,
  requiredScope: Parameters<typeof requireAuthenticatedScope>[1],
): Promise<{ data: AuthenticatedContext; ok: true } | { error: AppError; ok: false }> {
  const token = extractBearerToken(request)
  if (!token) {
    return {
      error: new AuthenticationError({
        code: "unauthenticated",
        message: "Bearer token is required.",
      }),
      ok: false,
    }
  }

  try {
    const context = dependencies.authenticateApiToken
      ? await dependencies.authenticateApiToken(token)
      : await authenticateWithDatabaseToken(token)
    const scopeError = requireAuthenticatedScope(context, requiredScope)
    if (scopeError) throw scopeError
    return { data: context, ok: true }
  } catch (error) {
    return { error: normalizeFileRouteError(error), ok: false }
  }
}

async function authenticateWithDatabaseToken(token: string) {
  const client = createDbClient()
  try {
    return await Effect.runPromise(authenticateBearerToken(client, token))
  } finally {
    await client.end()
  }
}

async function withFileStore<T>(
  dependencies: FileRouteDependencies,
  fn: (store: FileStore) => Promise<T>,
) {
  if (dependencies.fileStore) return fn(dependencies.fileStore)
  if (dependencies.dbClient) return fn(createPostgresFileStore(dependencies.dbClient))

  const client = createDbClient()
  try {
    return await fn(createPostgresFileStore(client))
  } finally {
    await client.end()
  }
}

async function getFileStorage(dependencies: FileRouteDependencies): Promise<StorageProvider> {
  return dependencies.fileStorage ?? createConfiguredStorageProvider()
}

async function createConfiguredStorageProvider(
  env: NodeJS.ProcessEnv = process.env,
): Promise<StorageProvider> {
  const provider = env.CONTEXTBASE_STORAGE_PROVIDER ?? "local_disk"
  if (provider === "s3") {
    const bucket = env.CONTEXTBASE_STORAGE_S3_BUCKET
    const region = env.CONTEXTBASE_STORAGE_S3_REGION
    if (!bucket || !region) {
      throw new Error("S3 file storage requires CONTEXTBASE_STORAGE_S3_BUCKET and REGION")
    }
    const storageS3Module = "@contextbase/core/domains/files/storage-s3"
    const { createS3StorageProvider } = await import(/* @vite-ignore */ storageS3Module)
    return createS3StorageProvider({
      bucket,
      forcePathStyle: env.CONTEXTBASE_STORAGE_S3_FORCE_PATH_STYLE === "true",
      region,
      ...(env.CONTEXTBASE_STORAGE_S3_ENDPOINT
        ? { endpoint: env.CONTEXTBASE_STORAGE_S3_ENDPOINT }
        : {}),
      ...(env.CONTEXTBASE_STORAGE_S3_PREFIX ? { prefix: env.CONTEXTBASE_STORAGE_S3_PREFIX } : {}),
    })
  }

  return createLocalDiskStorageProvider({
    rootDir: env.CONTEXTBASE_STORAGE_LOCAL_DIR ?? "/data/uploads",
  })
}

async function runFileEffect<T>(
  effect: Effect.Effect<T, unknown>,
): Promise<{ data: T; ok: true } | { error: AppError; ok: false }> {
  const either = await Effect.runPromise(Effect.either(effect))
  if (Either.isRight(either)) return { data: either.right, ok: true }
  return { error: normalizeFileRouteError(either.left), ok: false }
}

async function runStorageEffect<T>(
  effect: Effect.Effect<T, StorageError>,
): Promise<{ data: T; ok: true } | { error: AppError; ok: false }> {
  const either = await Effect.runPromise(Effect.either(effect))
  if (Either.isRight(either)) return { data: either.right, ok: true }
  return { error: normalizeFileRouteError(either.left), ok: false }
}

function normalizeFileRouteError(error: unknown): AppError {
  if (isAppError(error)) return error
  if (error instanceof StorageError) {
    return new InternalError({
      code: "internal_error",
      details: { reason: error.reason },
      message: "File storage operation failed.",
    })
  }
  return new InternalError({
    code: "internal_error",
    details: { cause: String(error) },
    message: "Internal server error",
  })
}

function writeAppError(context: Context, error: AppError): Response {
  const mapped = mapAppErrorToHttp(error)
  return context.json(mapped.body, mapped.status, noStoreHeaders())
}

function contentHeaders(input: {
  byteSize: number
  contentType: string
  originalFilename: string | null
}) {
  const disposition = isInlineSafeContentType(input.contentType) ? "inline" : "attachment"
  return {
    "Cache-Control": "private, max-age=60",
    "Content-Disposition": `${disposition}; filename="${sanitizeDownloadFilename(
      input.originalFilename,
    )}"`,
    "Content-Length": String(input.byteSize),
    "Content-Type": input.contentType,
    "X-Content-Type-Options": "nosniff",
  }
}

function isInlineSafeContentType(contentType: string) {
  return (
    contentType.startsWith("image/") ||
    contentType === "application/pdf" ||
    contentType === "application/json" ||
    contentType === "text/csv" ||
    contentType === "text/markdown" ||
    contentType === "text/plain"
  )
}

function toResponseBody(body: unknown): ConstructorParameters<typeof Response>[0] {
  if (body instanceof Uint8Array) {
    const copy = new Uint8Array(body.byteLength)
    copy.set(body)
    return copy.buffer
  }
  if (body instanceof ReadableStream) return body
  if (body instanceof Readable) return Readable.toWeb(body) as ReadableStream<Uint8Array>
  throw new Error("Unsupported storage response body")
}

function isAppError(error: unknown): error is AppError {
  return (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    "code" in error &&
    "message" in error
  )
}

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store",
  }
}
