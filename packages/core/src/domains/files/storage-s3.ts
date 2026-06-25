import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3"
import { Effect } from "effect"

import {
  type BodySource,
  isNotFoundError,
  normalizeContentType,
  prefixedObjectKey,
  StorageError,
  type StorageProvider,
  toStorageError,
  validateObjectKey,
  withoutUndefined,
} from "./storage"

type S3StorageConfig = {
  bucket: string
  client?: Pick<S3Client, "send">
  endpoint?: string
  forcePathStyle?: boolean
  prefix?: string
  region: string
}

export function createS3StorageProvider(config: S3StorageConfig): StorageProvider {
  const client =
    config.client ??
    new S3Client(
      withoutUndefined({
        endpoint: config.endpoint,
        forcePathStyle: config.forcePathStyle,
        region: config.region,
      }) satisfies S3ClientConfig,
    )

  return {
    id: "s3",
    deleteObject: (objectKey) =>
      Effect.tryPromise({
        try: async () => {
          validateObjectKey(objectKey)
          await client.send(
            new DeleteObjectCommand({
              Bucket: config.bucket,
              Key: prefixedObjectKey(config.prefix, objectKey),
            }),
          )
        },
        catch: (cause) => toStorageError("delete_failed", "Failed to delete S3 object.", cause),
      }),
    getObject: (objectKey) =>
      Effect.tryPromise({
        try: async () => {
          validateObjectKey(objectKey)
          const result = await client.send(
            new GetObjectCommand({
              Bucket: config.bucket,
              Key: prefixedObjectKey(config.prefix, objectKey),
            }),
          )
          return withoutUndefined({
            body: result.Body as BodySource,
            contentLength: result.ContentLength,
            contentType: result.ContentType,
            etag: result.ETag,
            lastModified: result.LastModified,
          })
        },
        catch: (cause) => toStorageError("get_failed", "Failed to read S3 object.", cause),
      }),
    headObject: (objectKey) =>
      Effect.tryPromise({
        try: async () => {
          validateObjectKey(objectKey)
          const result = await client.send(
            new HeadObjectCommand({
              Bucket: config.bucket,
              Key: prefixedObjectKey(config.prefix, objectKey),
            }),
          )
          return withoutUndefined({
            exists: true,
            contentLength: result.ContentLength,
            contentType: result.ContentType,
            etag: result.ETag,
            lastModified: result.LastModified,
          })
        },
        catch: (cause) => {
          if (isNotFoundError(cause)) {
            return new StorageError({
              cause,
              message: "S3 object was not found.",
              reason: "head_failed",
            })
          }
          return toStorageError("head_failed", "Failed to inspect S3 object.", cause)
        },
      }),
    putObject: (input) =>
      Effect.tryPromise({
        try: async () => {
          validateObjectKey(input.objectKey)
          await client.send(
            new PutObjectCommand({
              Body: input.body as Uint8Array,
              Bucket: config.bucket,
              ContentLength: input.contentLength,
              ContentType: normalizeContentType(input.contentType),
              Key: prefixedObjectKey(config.prefix, input.objectKey),
            }),
          )
        },
        catch: (cause) => toStorageError("put_failed", "Failed to write S3 object.", cause),
      }),
  }
}
