import { Readable } from "node:stream"

import { createDbClient, type DbClient } from "@contextbase/core/db/client"
import type { AuthenticatedContext } from "@contextbase/core/domains/auth/authenticate"
import type { BrowserSessionContext } from "@contextbase/core/domains/auth/browser-session"
import { createPostgresFileStore } from "@contextbase/core/domains/files/repository"
import {
  type FileStore,
  getFileContentDescriptor,
  uploadUserAvatar,
} from "@contextbase/core/domains/files/service"
import {
  createLocalDiskStorageProvider,
  FileUploadPayloadTooLargeError,
  InvalidFileUploadError,
  limitFileUploadRequestBody,
  oversizedFileUploadRequest,
  StorageError,
  type StorageProvider,
  sanitizeDownloadFilename,
} from "@contextbase/core/domains/files/storage"
import {
  type AppError,
  InternalError,
  InvalidRequestError,
  mapAppErrorToHttp,
  NotFoundError,
} from "@contextbase/core/shared/errors"
import { successEnvelope } from "@contextbase/core/shared/response"
import { Effect, Either } from "effect"

import { requireBrowserSession } from "../../auth/server/session-context"

export type BrowserFileRouteDependencies = {
  dbClient?: DbClient
  fileStorage?: StorageProvider
  fileStore?: FileStore
  publicAssetsBaseUrl?: string
  requireSession?: (request: Request) => Promise<{
    context: AuthenticatedContext
    session: BrowserSessionContext
  }>
  uploadsPublicBaseUrl?: string
}

type BrowserFileRoute = { kind: "content"; fileId: string } | { kind: "user_avatar_upload" }

type MultipartFileInput = {
  file: {
    body: Uint8Array
    contentLength: number
    contentType: string
    originalFilename: string | null
  }
}

export async function handleBrowserFileRequest(
  request: Request,
  dependencies: BrowserFileRouteDependencies = {},
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return withBrowserFileCors(request, new Response(null, { status: 204 }))
  }

  try {
    const route = parseBrowserFileRoute(request)
    if (!route) {
      return appErrorJson(
        new NotFoundError({
          code: "not_found",
          details: { path: new URL(request.url).pathname },
          message: "File route not found.",
        }),
      )
    }

    if (route.kind === "user_avatar_upload") {
      const oversized = oversizedFileUploadRequest(request)
      if (oversized) return payloadTooLargeJson(oversized)
    }

    const { context } = await (dependencies.requireSession ?? requireBrowserSession)(request)

    if (route.kind === "user_avatar_upload") {
      return withFileStore(dependencies, async (store) => {
        const multipart = await readMultipartFile(request)
        if (!multipart.ok) {
          if ("payloadTooLarge" in multipart) return payloadTooLargeJson(multipart.payloadTooLarge)
          return appErrorJson(multipart.error)
        }

        const result = await runFileEffect(
          uploadUserAvatar(store, await getFileStorage(dependencies), context, {
            file: multipart.data.file,
            publicAssetsBaseUrl:
              dependencies.publicAssetsBaseUrl ?? process.env.CONTEXTBASE_PUBLIC_ASSETS_BASE_URL,
          }),
        )
        if (!result.ok) return appErrorJson(result.error)
        return json(successEnvelope(result.data), {
          headers: noStoreHeaders(),
          status: 201,
        })
      })
    }

    if (route.kind === "content") {
      return withFileStore(dependencies, async (store) => {
        const descriptorResult = await runFileEffect(
          getFileContentDescriptor(store, context, { fileId: route.fileId }),
        )
        if (!descriptorResult.ok) return appErrorJson(descriptorResult.error)

        const storage = await getFileStorage(dependencies)
        const storageResult = await runStorageEffect(
          storage.getObject(descriptorResult.data.objectKey),
        )
        if (!storageResult.ok) return appErrorJson(storageResult.error)

        return withBrowserFileCors(
          request,
          new Response(request.method === "HEAD" ? null : toResponseBody(storageResult.data.body), {
            headers: contentHeaders({
              byteSize: descriptorResult.data.byteSize,
              contentType: descriptorResult.data.contentType,
              originalFilename: descriptorResult.data.originalFilename,
            }),
            status: 200,
          }),
        )
      })
    }

    return appErrorJson(
      new NotFoundError({
        code: "not_found",
        details: { path: new URL(request.url).pathname },
        message: "File route not found.",
      }),
    )
  } catch (error) {
    return appErrorJson(normalizeBrowserFileError(error))
  }
}

export async function handlePublicAvatarRequest(
  request: Request,
  dependencies: BrowserFileRouteDependencies = {},
): Promise<Response> {
  try {
    const url = new URL(request.url)
    const match = url.pathname.match(/^\/public\/avatars\/([^/]+)$/)
    if (!match?.[1] || (request.method !== "GET" && request.method !== "HEAD")) {
      return appErrorJson(
        new NotFoundError({
          code: "not_found",
          details: { path: url.pathname },
          message: "Public avatar route not found.",
        }),
      )
    }

    return withFileStore(dependencies, async (store) => {
      const descriptor = await store.findPublicFileContentDescriptorByAssetId?.(match[1])
      if (!descriptor) {
        return appErrorJson(
          new NotFoundError({
            code: "not_found",
            details: { publicAssetId: match[1] },
            message: "Public avatar not found.",
          }),
        )
      }

      const storage = await getFileStorage(dependencies)
      const storageResult = await runStorageEffect(storage.getObject(descriptor.objectKey))
      if (!storageResult.ok) return appErrorJson(storageResult.error)

      return new Response(
        request.method === "HEAD" ? null : toResponseBody(storageResult.data.body),
        {
          headers: publicAvatarHeaders(descriptor),
          status: 200,
        },
      )
    })
  } catch (error) {
    return appErrorJson(normalizeBrowserFileError(error))
  }
}

function parseBrowserFileRoute(request: Request): BrowserFileRoute | null {
  const url = new URL(request.url)
  if (url.pathname === "/api/settings/account/avatar" && request.method === "POST") {
    return { kind: "user_avatar_upload" }
  }

  const content = url.pathname.match(/^\/api\/files\/([^/]+)\/content$/)
  if (content?.[1] && (request.method === "GET" || request.method === "HEAD")) {
    return { fileId: content[1], kind: "content" }
  }

  return null
}

async function readMultipartFile(
  request: Request,
): Promise<
  | { data: MultipartFileInput; ok: true }
  | { error: AppError; ok: false }
  | { ok: false; payloadTooLarge: { contentLength: number; maxBodyBytes: number } }
> {
  try {
    const body = await (await limitFileUploadRequestBody(request)).formData()
    const rawFile = body.get("file")
    if (!(rawFile instanceof File)) {
      return invalidRequest("Multipart field `file` is required.")
    }

    return {
      data: {
        file: {
          body: new Uint8Array(await rawFile.arrayBuffer()),
          contentLength: rawFile.size,
          contentType: rawFile.type || "application/octet-stream",
          originalFilename: rawFile.name || null,
        },
      },
      ok: true,
    }
  } catch (error) {
    if (error instanceof FileUploadPayloadTooLargeError) {
      return {
        ok: false,
        payloadTooLarge: {
          contentLength: error.contentLength,
          maxBodyBytes: error.maxBodyBytes,
        },
      }
    }
    return invalidRequest("Malformed multipart request body.", { cause: String(error) })
  }
}

async function withFileStore<T>(
  dependencies: BrowserFileRouteDependencies,
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

async function getFileStorage(
  dependencies: BrowserFileRouteDependencies,
): Promise<StorageProvider> {
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
  return { error: normalizeBrowserFileError(either.left), ok: false }
}

async function runStorageEffect<T>(
  effect: Effect.Effect<T, StorageError>,
): Promise<{ data: T; ok: true } | { error: AppError; ok: false }> {
  const either = await Effect.runPromise(Effect.either(effect))
  if (Either.isRight(either)) return { data: either.right, ok: true }
  return { error: normalizeBrowserFileError(either.left), ok: false }
}

function normalizeBrowserFileError(error: unknown): AppError {
  if (isAppError(error)) return error
  if (error instanceof InvalidFileUploadError) {
    return new InvalidRequestError({
      code: "invalid_request",
      details: {
        contentLength: error.contentLength,
        contentType: error.contentType,
        maxBytes: error.maxBytes,
        reason: error.reason,
      },
      message: error.message,
    })
  }
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

function withBrowserFileCors(request: Request, response: Response): Response {
  const origin = request.headers.get("origin")
  if (!origin || !isAllowedBrowserFileOrigin(origin, request.url)) return response

  const headers = new Headers(response.headers)
  headers.set("access-control-allow-origin", origin)
  headers.set("access-control-allow-credentials", "true")
  headers.set("access-control-allow-methods", "GET, HEAD, OPTIONS")
  headers.set("access-control-allow-headers", "content-type")
  headers.append("vary", "Origin")

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}

function isAllowedBrowserFileOrigin(origin: string, requestUrl: string): boolean {
  let parsedOrigin: URL
  let parsedRequest: URL
  try {
    parsedOrigin = new URL(origin)
    parsedRequest = new URL(requestUrl)
  } catch {
    return false
  }

  const configuredOrigins = [
    process.env.CONTEXTBASE_APP_BASE_URL,
    "https://contextbase.localhost",
    "https://contextbase.localhost",
    "https://staging.contextbase.localhost",
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => {
      try {
        return new URL(value).origin
      } catch {
        return null
      }
    })
    .filter((value): value is string => Boolean(value))

  if (configuredOrigins.includes(parsedOrigin.origin)) return true

  const uploadsPrefix = "uploads."
  if (!parsedRequest.hostname.startsWith(uploadsPrefix)) return false

  const appHost = parsedRequest.hostname.slice(uploadsPrefix.length)
  return parsedOrigin.protocol === parsedRequest.protocol && parsedOrigin.hostname === appHost
}

function appErrorJson(error: AppError): Response {
  const mapped = mapAppErrorToHttp(error)
  return json(mapped.body, { headers: noStoreHeaders(), status: mapped.status })
}

function payloadTooLargeJson(details: { contentLength: number; maxBodyBytes: number }): Response {
  return json(
    {
      error: {
        code: "payload_too_large",
        details,
        message: "File upload request body is too large.",
      },
      ok: false,
    },
    { headers: noStoreHeaders(), status: 413 },
  )
}

function invalidRequest(message: string, details: Record<string, unknown> = {}) {
  return {
    error: new InvalidRequestError({
      code: "invalid_request",
      details,
      message,
    }),
    ok: false as const,
  }
}

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set("content-type", "application/json")
  return new Response(JSON.stringify(body), { ...init, headers })
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

function publicAvatarHeaders(input: { byteSize: number; contentType: string; sha256: string }) {
  return {
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Length": String(input.byteSize),
    "Content-Type": input.contentType,
    ETag: `"${input.sha256}"`,
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
