import { createHash } from "node:crypto"
import { createReadStream, createWriteStream } from "node:fs"
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, resolve, sep } from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { Data, Effect } from "effect"

export type StorageProviderId = "local_disk" | "s3"

export const MAX_FILE_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_FILE_UPLOAD_BODY_BYTES = MAX_FILE_UPLOAD_BYTES + 1024 * 1024

export type PutObjectInput = {
  body: BodySource
  contentLength: number
  contentType: string
  objectKey: string
}

export type BodySource = NodeJS.ReadableStream | ReadableStream<Uint8Array> | Uint8Array

export type GetObjectResult = {
  body: BodySource
  contentLength?: number
  contentType?: string
  etag?: string
  lastModified?: Date
}

export type HeadObjectResult = {
  exists: boolean
  contentLength?: number
  contentType?: string
  etag?: string
  lastModified?: Date
}

export type StorageProvider = {
  id: StorageProviderId
  deleteObject(objectKey: string): Effect.Effect<void, StorageError>
  getObject(objectKey: string): Effect.Effect<GetObjectResult, StorageError>
  headObject(objectKey: string): Effect.Effect<HeadObjectResult, StorageError>
  putObject(input: PutObjectInput): Effect.Effect<void, StorageError>
}

type StorageReason =
  | "delete_failed"
  | "get_failed"
  | "head_failed"
  | "invalid_object_key"
  | "put_failed"

export class StorageError extends Data.TaggedError("StorageError")<{
  cause?: unknown
  message: string
  reason: StorageReason
}> {}

export type FilePolicy = {
  allowedContentTypes: string[]
  maxBytes: number
}

type InvalidFileUploadReason =
  | "empty_file"
  | "file_too_large"
  | "invalid_image"
  | "unsupported_content_type"

export class InvalidFileUploadError extends Data.TaggedError("InvalidFileUploadError")<{
  contentLength?: number
  contentType?: string
  maxBytes?: number
  message: string
  reason: InvalidFileUploadReason
}> {}

export class FileUploadPayloadTooLargeError extends Data.TaggedError(
  "FileUploadPayloadTooLargeError",
)<{
  contentLength: number
  maxBodyBytes: number
  message: string
}> {}

export function buildFileObjectKey(input: { fileId: string; workspaceId: string }) {
  return `workspaces/${input.workspaceId}/files/${input.fileId}/original`
}

export function buildPublicAvatarObjectKey(input: { publicAssetId: string }) {
  return `public/avatars/${input.publicAssetId}/avatar.webp`
}

export function buildPublicAvatarAssetUrl(
  publicAssetId: string,
  publicAssetsBaseUrl: string | null | undefined,
) {
  const baseUrl = (publicAssetsBaseUrl ?? "/public").replace(/\/$/, "")
  return `${baseUrl}/avatars/${encodeURIComponent(publicAssetId)}`
}

export function sanitizeDownloadFilename(filename: string | null | undefined) {
  const baseName = (filename ?? "")
    .replaceAll("\\", "/")
    .split("/")
    .at(-1)
    ?.split("")
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code > 31 && code !== 127
    })
    .join("")
    .trim()

  return baseName && baseName.length > 0 ? baseName : "download"
}

export function normalizeContentType(contentType: string | null | undefined) {
  return (
    (contentType ?? "application/octet-stream").split(";")[0]?.trim().toLowerCase() ||
    "application/octet-stream"
  )
}

export function computeSha256Hex(input: Uint8Array | string) {
  return Effect.sync(() => createHash("sha256").update(input).digest("hex"))
}

export function oversizedFileUploadRequest(
  request: Pick<Request, "headers">,
  maxBodyBytes = MAX_FILE_UPLOAD_BODY_BYTES,
) {
  const contentLength = request.headers.get("content-length")
  if (!contentLength || !/^\d+$/.test(contentLength)) return null

  const parsed = Number.parseInt(contentLength, 10)
  if (!Number.isFinite(parsed) || parsed <= maxBodyBytes) return null

  return {
    contentLength: parsed,
    maxBodyBytes,
  }
}

export async function limitFileUploadRequestBody(
  request: Request,
  maxBodyBytes = MAX_FILE_UPLOAD_BODY_BYTES,
) {
  const oversized = oversizedFileUploadRequest(request, maxBodyBytes)
  if (oversized) {
    throw new FileUploadPayloadTooLargeError({
      ...oversized,
      message: "File upload request body is too large.",
    })
  }

  if (!request.body) return request

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let contentLength = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      contentLength += value.byteLength
      if (contentLength > maxBodyBytes) {
        await reader.cancel().catch(() => undefined)
        throw new FileUploadPayloadTooLargeError({
          contentLength,
          maxBodyBytes,
          message: "File upload request body is too large.",
        })
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const body = concatUint8Arrays(chunks, contentLength)
  const headers = new Headers(request.headers)
  headers.set("content-length", String(contentLength))
  return new Request(request.url, {
    body,
    headers,
    method: request.method,
  })
}

export function validateFilePolicy(
  input: { contentLength: number; contentType: string },
  policy: FilePolicy,
) {
  const contentType = normalizeContentType(input.contentType)

  if (input.contentLength <= 0) {
    return Effect.fail(
      new InvalidFileUploadError({
        contentLength: input.contentLength,
        contentType,
        message: "Uploaded file is empty.",
        reason: "empty_file",
      }),
    )
  }

  if (input.contentLength > policy.maxBytes) {
    return Effect.fail(
      new InvalidFileUploadError({
        contentLength: input.contentLength,
        contentType,
        maxBytes: policy.maxBytes,
        message: "Uploaded file is too large.",
        reason: "file_too_large",
      }),
    )
  }

  if (
    contentType === "image/svg+xml" ||
    !isAllowedContentType(contentType, policy.allowedContentTypes)
  ) {
    return Effect.fail(
      new InvalidFileUploadError({
        contentLength: input.contentLength,
        contentType,
        message: "Uploaded file content type is not allowed.",
        reason: "unsupported_content_type",
      }),
    )
  }

  return Effect.void
}

function isAllowedContentType(contentType: string, allowedContentTypes: string[]) {
  return allowedContentTypes.some((allowed) => {
    const normalizedAllowed = normalizeContentType(allowed)
    if (normalizedAllowed.endsWith("/*")) {
      return contentType.startsWith(`${normalizedAllowed.slice(0, -1)}`)
    }
    return contentType === normalizedAllowed
  })
}

function concatUint8Arrays(chunks: Uint8Array[], contentLength: number) {
  const body = new Uint8Array(contentLength)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

type LocalDiskStorageConfig = {
  rootDir: string
}

type StoredMetadata = {
  contentLength: number
  contentType: string
}

export function createLocalDiskStorageProvider(config: LocalDiskStorageConfig): StorageProvider {
  const rootDir = resolve(config.rootDir)

  return {
    id: "local_disk",
    deleteObject: (objectKey) =>
      Effect.tryPromise({
        try: async () => {
          const filePath = resolveObjectPath(rootDir, objectKey)
          await rm(filePath, { force: true })
          await rm(metadataPath(filePath), { force: true })
        },
        catch: (cause) =>
          toStorageError("delete_failed", "Failed to delete local storage object.", cause),
      }),
    getObject: (objectKey) =>
      Effect.tryPromise({
        try: async () => {
          const filePath = resolveObjectPath(rootDir, objectKey)
          const [stats, metadata] = await Promise.all([stat(filePath), readMetadata(filePath)])
          return withoutUndefined({
            body: Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>,
            contentLength: metadata?.contentLength ?? stats.size,
            contentType: metadata?.contentType,
          })
        },
        catch: (cause) =>
          toStorageError("get_failed", "Failed to read local storage object.", cause),
      }),
    headObject: (objectKey) =>
      Effect.tryPromise({
        try: async () => {
          const filePath = resolveObjectPath(rootDir, objectKey)
          try {
            const [stats, metadata] = await Promise.all([stat(filePath), readMetadata(filePath)])
            return withoutUndefined({
              exists: true,
              contentLength: metadata?.contentLength ?? stats.size,
              contentType: metadata?.contentType,
              lastModified: stats.mtime,
            })
          } catch (error) {
            if (isNotFoundError(error)) {
              return { exists: false }
            }
            throw error
          }
        },
        catch: (cause) =>
          toStorageError("head_failed", "Failed to inspect local storage object.", cause),
      }),
    putObject: (input) =>
      Effect.tryPromise({
        try: async () => {
          const filePath = resolveObjectPath(rootDir, input.objectKey)
          await mkdir(dirname(filePath), { recursive: true })
          const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`

          if (input.body instanceof Uint8Array) {
            await writeFile(tempPath, input.body)
          } else {
            await pipeline(toNodeReadable(input.body), createWriteStream(tempPath))
          }

          await rename(tempPath, filePath)
          await writeMetadata(filePath, {
            contentLength: input.contentLength,
            contentType: normalizeContentType(input.contentType),
          })
        },
        catch: (cause) =>
          toStorageError("put_failed", "Failed to write local storage object.", cause),
      }),
  }
}

function resolveObjectPath(rootDir: string, objectKey: string) {
  validateObjectKey(objectKey)

  const filePath = resolve(rootDir, objectKey)
  const rootPrefix = rootDir.endsWith(sep) ? rootDir : `${rootDir}${sep}`
  if (filePath !== rootDir && !filePath.startsWith(rootPrefix)) {
    throw new StorageError({
      message: "Object key escapes the configured storage root.",
      reason: "invalid_object_key",
    })
  }
  return filePath
}

export function validateObjectKey(objectKey: string) {
  if (
    objectKey.length === 0 ||
    objectKey.includes("\\") ||
    objectKey.includes("\u0000") ||
    isAbsolute(objectKey) ||
    objectKey
      .split("/")
      .some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    throw new StorageError({
      message: "Object key is invalid.",
      reason: "invalid_object_key",
    })
  }
}

export function prefixedObjectKey(prefix: string | undefined, objectKey: string) {
  const normalizedPrefix = prefix?.replace(/^\/+|\/+$/g, "")
  return normalizedPrefix ? `${normalizedPrefix}/${objectKey}` : objectKey
}

function toNodeReadable(body: Exclude<BodySource, Uint8Array>) {
  if (body instanceof ReadableStream) {
    return Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0])
  }
  return body
}

function metadataPath(filePath: string) {
  return `${filePath}.metadata.json`
}

async function readMetadata(filePath: string): Promise<StoredMetadata | null> {
  try {
    return JSON.parse(await readFile(metadataPath(filePath), "utf8")) as StoredMetadata
  } catch (error) {
    if (isNotFoundError(error)) {
      return null
    }
    throw error
  }
}

async function writeMetadata(filePath: string, metadata: StoredMetadata) {
  await writeFile(metadataPath(filePath), JSON.stringify(metadata), "utf8")
}

export function isNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    ("code" in error || "name" in error || "$metadata" in error) &&
    ((error as { code?: unknown }).code === "ENOENT" ||
      (error as { name?: unknown }).name === "NotFound" ||
      (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404)
  )
}

export function toStorageError(reason: StorageReason, message: string, cause: unknown) {
  if (cause instanceof StorageError) {
    return cause
  }
  return new StorageError({ cause, message, reason })
}

export function withoutUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as {
    [K in keyof T as undefined extends T[K] ? K : K]: Exclude<T[K], undefined>
  }
}
