import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Readable } from "node:stream"
import { Effect } from "effect"
import { afterEach, describe, expect, test } from "vitest"

import {
  buildFileObjectKey,
  buildPublicAvatarAssetUrl,
  buildPublicAvatarObjectKey,
  computeSha256Hex,
  createLocalDiskStorageProvider,
  normalizeContentType,
  sanitizeDownloadFilename,
  validateFilePolicy,
} from "./storage"
import { createS3StorageProvider } from "./storage-s3"

const tempDirs: string[] = []

async function makeTempDir() {
  const dir = await mkdtemp(join(tmpdir(), "contextbase-files-"))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })))
})

describe("file storage foundation", () => {
  test("builds owner-agnostic object keys from file scope and file id", () => {
    const objectKey = buildFileObjectKey({
      fileId: "fil_123",
      workspaceId: "wrk_123",
    })

    expect(objectKey).toBe("workspaces/wrk_123/files/fil_123/original")
    expect(objectKey).not.toContain("/businesses/")
    expect(objectKey).not.toContain("biz_")
    expect(objectKey).not.toContain("tsk_")
    expect(objectKey).not.toContain("cmt_")
    expect(objectKey).not.toContain("goal_")
  })

  test("builds public immutable avatar object keys and URLs from opaque asset ids", () => {
    const objectKey = buildPublicAvatarObjectKey({ publicAssetId: "avt_abc123" })

    expect(objectKey).toBe("public/avatars/avt_abc123/avatar.webp")
    expect(objectKey).not.toContain("usr_")
    expect(objectKey).not.toContain("biz_")
    expect(objectKey).not.toContain("wrk_")

    expect(buildPublicAvatarAssetUrl("avt_abc123", "https://public.contextbase.test/")).toBe(
      "https://public.contextbase.test/avatars/avt_abc123",
    )
    expect(buildPublicAvatarAssetUrl("avt_abc123", undefined)).toBe("/public/avatars/avt_abc123")
  })

  test("sanitizes unsafe download filenames without using them as object keys", () => {
    expect(sanitizeDownloadFilename("../Quarterly Report\u0000.csv")).toBe("Quarterly Report.csv")
    expect(sanitizeDownloadFilename("")).toBe("download")
    expect(sanitizeDownloadFilename("   ")).toBe("download")
  })

  test("computes deterministic sha256 hashes", async () => {
    await expect(
      Effect.runPromise(computeSha256Hex(new TextEncoder().encode("vertical"))),
    ).resolves.toBe("34da56029403e6f793b86883b3c7205b8dafe06b25a3159f8c06fc87262c1028")
  })

  test("normalizes content types and rejects unsupported or oversized files", async () => {
    expect(normalizeContentType(" Image/PNG; charset=utf-8 ")).toBe("image/png")

    await expect(
      Effect.runPromise(
        validateFilePolicy(
          { contentLength: 512, contentType: "image/png" },
          { allowedContentTypes: ["image/*", "application/pdf"], maxBytes: 1024 },
        ),
      ),
    ).resolves.toBeUndefined()

    await expect(
      Effect.runPromise(
        Effect.flip(
          validateFilePolicy(
            { contentLength: 2048, contentType: "image/png" },
            { allowedContentTypes: ["image/*"], maxBytes: 1024 },
          ),
        ),
      ),
    ).resolves.toMatchObject({ _tag: "InvalidFileUploadError", reason: "file_too_large" })

    await expect(
      Effect.runPromise(
        Effect.flip(
          validateFilePolicy(
            { contentLength: 512, contentType: "image/svg+xml" },
            { allowedContentTypes: ["image/*"], maxBytes: 1024 },
          ),
        ),
      ),
    ).resolves.toMatchObject({ _tag: "InvalidFileUploadError", reason: "unsupported_content_type" })
  })

  test("local disk provider writes, heads, streams, and deletes under the configured root", async () => {
    const rootDir = await makeTempDir()
    const provider = createLocalDiskStorageProvider({ rootDir })
    const objectKey = buildFileObjectKey({
      fileId: "fil_123",
      workspaceId: "wrk_123",
    })

    await Effect.runPromise(
      provider.putObject({
        body: new TextEncoder().encode("hello"),
        contentLength: 5,
        contentType: "text/plain",
        objectKey,
      }),
    )

    await expect(Effect.runPromise(provider.headObject(objectKey))).resolves.toMatchObject({
      contentLength: 5,
      contentType: "text/plain",
      exists: true,
    })

    const result = await Effect.runPromise(provider.getObject(objectKey))
    await expect(readBodyText(result.body)).resolves.toBe("hello")

    await Effect.runPromise(provider.deleteObject(objectKey))
    await Effect.runPromise(provider.deleteObject(objectKey))

    await expect(Effect.runPromise(provider.headObject(objectKey))).resolves.toMatchObject({
      exists: false,
    })
    await expect(
      Effect.runPromise(Effect.flip(provider.getObject(objectKey))),
    ).resolves.toMatchObject({
      _tag: "StorageError",
      reason: "get_failed",
    })
  })

  test("local disk provider rejects path traversal keys", async () => {
    const rootDir = await makeTempDir()
    const provider = createLocalDiskStorageProvider({ rootDir })

    await expect(
      Effect.runPromise(
        Effect.flip(
          provider.putObject({
            body: new TextEncoder().encode("bad"),
            contentLength: 3,
            contentType: "text/plain",
            objectKey: "../escape.txt",
          }),
        ),
      ),
    ).resolves.toMatchObject({ _tag: "StorageError", reason: "invalid_object_key" })
  })

  test("s3 provider sends put, head, get, and delete commands with private bucket keys", async () => {
    const sent: Array<{ input: Record<string, unknown>; name: string }> = []
    const body = new TextEncoder().encode("hello")
    const client = {
      send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
        sent.push({ input: command.input, name: command.constructor.name })
        if (command.constructor.name === "HeadObjectCommand") {
          return { ContentLength: 5, ContentType: "text/plain", ETag: '"etag"' }
        }
        if (command.constructor.name === "GetObjectCommand") {
          return { Body: body, ContentLength: 5, ContentType: "text/plain", ETag: '"etag"' }
        }
        return {}
      },
    }
    const provider = createS3StorageProvider({
      bucket: "contextbase-files",
      client,
      prefix: "prod",
      region: "us-east-1",
    })
    const objectKey = buildFileObjectKey({
      fileId: "fil_123",
      workspaceId: "wrk_123",
    })

    await Effect.runPromise(
      provider.putObject({
        body,
        contentLength: 5,
        contentType: "text/plain",
        objectKey,
      }),
    )
    await Effect.runPromise(provider.headObject(objectKey))
    await Effect.runPromise(provider.getObject(objectKey))
    await Effect.runPromise(provider.deleteObject(objectKey))

    expect(sent.map((command) => command.name)).toEqual([
      "PutObjectCommand",
      "HeadObjectCommand",
      "GetObjectCommand",
      "DeleteObjectCommand",
    ])
    expect(sent.map((command) => command.input.Key)).toEqual([
      `prod/${objectKey}`,
      `prod/${objectKey}`,
      `prod/${objectKey}`,
      `prod/${objectKey}`,
    ])
    expect(sent[0]?.input).toMatchObject({
      Bucket: "contextbase-files",
      ContentLength: 5,
      ContentType: "text/plain",
    })
  })
})

async function readBodyText(body: Uint8Array | NodeJS.ReadableStream | ReadableStream<Uint8Array>) {
  if (body instanceof Uint8Array) {
    return new TextDecoder().decode(body)
  }

  const stream =
    body instanceof ReadableStream
      ? Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0])
      : body
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString("utf8")
}
