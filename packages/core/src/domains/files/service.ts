import { Cause, Effect, Exit, Option } from "effect"
import sharp from "sharp"

import { ForbiddenError, InternalError, NotFoundError } from "../../shared/errors"
import { createId } from "../../shared/ids"
import type { AuthenticatedContext } from "../auth/authenticate"
import {
  type BodySource,
  buildFileObjectKey,
  buildPublicAvatarAssetUrl,
  buildPublicAvatarObjectKey,
  computeSha256Hex,
  type FilePolicy,
  InvalidFileUploadError,
  MAX_FILE_UPLOAD_BYTES,
  normalizeContentType,
  StorageError,
  type StorageProvider,
  validateFilePolicy,
} from "./storage"

const AVATAR_ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
const AVATAR_IMAGE_SIZE = 512

export type FileStorageStatus = "available" | "delete_pending" | "deleted" | "failed" | "pending"
export type FileScopeKind = "user" | "workspace"
export type FileUsageKind = "avatar" | "workspace_file"

export type PublicAvatarUploadResultDto = {
  avatarUrl: string
  byteSize: number
  contentType: string
  fileId: string
  objectKey: string
  publicAssetId: string
  sha256: string
}

export type WorkspaceFileUploadResultDto = {
  byteSize: number
  contentType: string
  fileId: string
  objectKey: string
  originalFilename: string | null
  sha256: string
  storageStatus: "available"
}

export type FileContentDescriptorDto = {
  byteSize: number
  contentType: string
  fileId: string
  objectKey: string
  originalFilename: string | null
  provider: string
  sha256: string
  workspaceId: string
  workspaceSlug: string
}

export type PublicFileContentDescriptorDto = {
  byteSize: number
  contentType: string
  fileId: string
  objectKey: string
  provider: string
  publicAssetId: string
  sha256: string
}

export type FileUploadInput = {
  body: BodySource
  contentLength: number
  contentType: string
  originalFilename?: string | null
}

export type UploadUserAvatarInput = {
  file: FileUploadInput
  publicAssetsBaseUrl?: string | null
}

export type GetFileContentDescriptorInput = {
  fileId: string
}

export type ResolvedCreatePendingPublicAvatarFileObjectInput = {
  createdById: string | null
  createdByKind: string
  ownerId: string
  ownerKind: "user"
  provider: string
  publicAssetId: string
  scopeKind: "user"
}

export type ResolvedCreatePendingWorkspaceFileObjectInput = {
  createdById: string | null
  createdByKind: string
  originalFilename?: string | null
  provider: string
  workspaceId: string
  workspaceSlug: string
}

export type ResolvedFinalizePublicAvatarUploadInput = {
  byteSize: number
  contentType: string
  fileId: string
  objectKey: string
  ownerId: string
  ownerKind: "user"
  publicAssetId: string
  scopeKind: "user"
  sha256: string
}

export type ResolvedFinalizeWorkspaceFileUploadInput = {
  byteSize: number
  contentType: string
  fileId: string
  objectKey: string
  originalFilename: string | null
  sha256: string
  storageStatus: "available"
  workspaceId: string
  workspaceSlug: string
}

export type ResolvedMarkFileObjectUploadFailedInput = {
  fileId: string
  objectKey?: string
  storageStatus: "delete_pending" | "failed"
}

export type FileStore = {
  createPendingPublicAvatarFileObject?: (
    context: AuthenticatedContext,
    input: ResolvedCreatePendingPublicAvatarFileObjectInput,
  ) => Promise<{ id: string }>
  createPendingWorkspaceFileObject?: (
    context: AuthenticatedContext,
    input: ResolvedCreatePendingWorkspaceFileObjectInput,
  ) => Promise<{ id: string }>
  finalizeUserAvatarUpload?: (
    context: AuthenticatedContext,
    input: ResolvedFinalizePublicAvatarUploadInput,
  ) => Promise<ResolvedFinalizePublicAvatarUploadInput>
  finalizeWorkspaceFileUpload?: (
    context: AuthenticatedContext,
    input: ResolvedFinalizeWorkspaceFileUploadInput,
  ) => Promise<ResolvedFinalizeWorkspaceFileUploadInput>
  findFileContentDescriptorByIdInWorkspace?: (
    context: AuthenticatedContext,
    fileId: string,
  ) => Promise<FileContentDescriptorDto | null>
  findPublicFileContentDescriptorByAssetId?: (
    publicAssetId: string,
  ) => Promise<PublicFileContentDescriptorDto | null>
  markFileObjectUploadFailed?: (
    context: AuthenticatedContext,
    input: ResolvedMarkFileObjectUploadFailedInput,
  ) => Promise<void>
}

export function uploadUserAvatar(
  store: FileStore,
  storage: StorageProvider,
  context: AuthenticatedContext,
  input: UploadUserAvatarInput,
): Effect.Effect<
  PublicAvatarUploadResultDto,
  ForbiddenError | InternalError | InvalidFileUploadError | StorageError
> {
  return Effect.tryPromise({
    try: async () => {
      if (context.principalKind !== "user") {
        throw new ForbiddenError({
          code: "forbidden",
          details: { principalKind: context.principalKind },
          message: "User principal is required",
        })
      }

      if (!store.createPendingPublicAvatarFileObject || !store.finalizeUserAvatarUpload) {
        throw new Error("File store cannot upload user avatars")
      }

      const normalizedFile = await normalizeAvatarUpload(input.file)
      const publicAssetId = createId("avt")
      const pendingFile = await store.createPendingPublicAvatarFileObject(context, {
        createdById: context.principalId,
        createdByKind: context.principalKind,
        ownerId: context.principalId,
        ownerKind: "user",
        provider: storage.id,
        publicAssetId,
        scopeKind: "user",
      })
      const objectKey = buildPublicAvatarObjectKey({ publicAssetId })

      try {
        await runEffectOrThrow(
          storage.putObject({
            body: normalizedFile.body,
            contentLength: normalizedFile.contentLength,
            contentType: normalizedFile.contentType,
            objectKey,
          }),
        )
      } catch (cause) {
        await markUploadFailed(store, context, pendingFile.id, "failed")
        throw cause
      }

      const finalizeInput: ResolvedFinalizePublicAvatarUploadInput = {
        byteSize: normalizedFile.contentLength,
        contentType: normalizedFile.contentType,
        fileId: pendingFile.id,
        objectKey,
        ownerId: context.principalId,
        ownerKind: "user",
        publicAssetId,
        scopeKind: "user",
        sha256: normalizedFile.sha256,
      }

      try {
        const avatar = await store.finalizeUserAvatarUpload(context, finalizeInput)
        return {
          avatarUrl: buildPublicAvatarAssetUrl(avatar.publicAssetId, input.publicAssetsBaseUrl),
          byteSize: avatar.byteSize,
          contentType: avatar.contentType,
          fileId: avatar.fileId,
          objectKey: avatar.objectKey,
          publicAssetId: avatar.publicAssetId,
          sha256: avatar.sha256,
        }
      } catch (cause) {
        await cleanupStoredObjectAfterFinalizationFailure(
          store,
          storage,
          context,
          pendingFile.id,
          objectKey,
        )
        throw cause
      }
    },
    catch: preserveExpectedError<
      ForbiddenError | InternalError | InvalidFileUploadError | StorageError
    >("Failed to upload user avatar"),
  })
}

export function uploadWorkspaceFile(
  store: FileStore,
  storage: StorageProvider,
  context: AuthenticatedContext,
  input: {
    allowedContentTypes?: string[]
    file: FileUploadInput
    maxBytes?: number
  },
): Effect.Effect<
  WorkspaceFileUploadResultDto,
  ForbiddenError | InternalError | InvalidFileUploadError | StorageError
> {
  return Effect.tryPromise({
    try: async () => {
      if (!store.createPendingWorkspaceFileObject || !store.finalizeWorkspaceFileUpload) {
        throw new Error("File store cannot upload workspace files")
      }

      const normalizedFile = await normalizeWorkspaceFileUpload(input.file, {
        allowedContentTypes: input.allowedContentTypes ?? ["image/*"],
        maxBytes: input.maxBytes ?? MAX_FILE_UPLOAD_BYTES,
      })
      const pendingFile = await store.createPendingWorkspaceFileObject(context, {
        createdById: context.principalId,
        createdByKind: context.principalKind,
        originalFilename: normalizedFile.originalFilename,
        provider: storage.id,
        workspaceId: context.workspaceId,
        workspaceSlug: context.workspaceSlug,
      })
      const objectKey = buildFileObjectKey({
        fileId: pendingFile.id,
        workspaceId: context.workspaceId,
      })

      try {
        await runEffectOrThrow(
          storage.putObject({
            body: normalizedFile.body,
            contentLength: normalizedFile.contentLength,
            contentType: normalizedFile.contentType,
            objectKey,
          }),
        )
      } catch (cause) {
        await markUploadFailed(store, context, pendingFile.id, "failed")
        throw cause
      }

      const finalizeInput: ResolvedFinalizeWorkspaceFileUploadInput = {
        byteSize: normalizedFile.contentLength,
        contentType: normalizedFile.contentType,
        fileId: pendingFile.id,
        objectKey,
        originalFilename: normalizedFile.originalFilename,
        sha256: normalizedFile.sha256,
        storageStatus: "available",
        workspaceId: context.workspaceId,
        workspaceSlug: context.workspaceSlug,
      }

      try {
        const file = await store.finalizeWorkspaceFileUpload(context, finalizeInput)
        return {
          byteSize: file.byteSize,
          contentType: file.contentType,
          fileId: file.fileId,
          objectKey: file.objectKey,
          originalFilename: file.originalFilename,
          sha256: file.sha256,
          storageStatus: file.storageStatus,
        }
      } catch (cause) {
        await cleanupStoredObjectAfterFinalizationFailure(
          store,
          storage,
          context,
          pendingFile.id,
          objectKey,
        )
        throw cause
      }
    },
    catch: preserveExpectedError<
      ForbiddenError | InternalError | InvalidFileUploadError | StorageError
    >("Failed to upload workspace file"),
  })
}

export function getFileContentDescriptor(
  store: FileStore,
  context: AuthenticatedContext,
  input: GetFileContentDescriptorInput,
): Effect.Effect<FileContentDescriptorDto, InternalError | NotFoundError> {
  return Effect.tryPromise({
    try: async () => {
      const descriptor = await store.findFileContentDescriptorByIdInWorkspace?.(
        context,
        input.fileId,
      )
      if (!descriptor) {
        throw new NotFoundError({
          code: "not_found",
          details: { fileId: input.fileId },
          message: "File not found in workspace",
        })
      }
      return descriptor
    },
    catch: preserveExpectedError<InternalError | NotFoundError>(
      "Failed to get file content descriptor",
    ),
  })
}

async function normalizeAvatarUpload(file: FileUploadInput) {
  const contentType = normalizeContentType(file.contentType)
  await runEffectOrThrow(
    validateFilePolicy(
      { contentLength: file.contentLength, contentType },
      { allowedContentTypes: AVATAR_ALLOWED_CONTENT_TYPES, maxBytes: MAX_FILE_UPLOAD_BYTES },
    ),
  )

  let normalizedBody: Uint8Array
  try {
    normalizedBody = await sharp(file.body as Uint8Array, { failOn: "warning" })
      .rotate()
      .resize(AVATAR_IMAGE_SIZE, AVATAR_IMAGE_SIZE, { fit: "cover" })
      .webp({ quality: 90 })
      .toBuffer()
  } catch {
    throw new InvalidFileUploadError({
      contentLength: file.contentLength,
      contentType,
      message: "Uploaded avatar could not be decoded as an image.",
      reason: "invalid_image",
    })
  }

  const sha256 = await runEffectOrThrow(computeSha256Hex(normalizedBody))
  return {
    body: normalizedBody,
    contentLength: normalizedBody.byteLength,
    contentType: "image/webp",
    originalFilename: null,
    sha256,
  }
}

async function normalizeWorkspaceFileUpload(file: FileUploadInput, policy: FilePolicy) {
  const contentType = normalizeContentType(file.contentType)
  await runEffectOrThrow(
    validateFilePolicy({ contentLength: file.contentLength, contentType }, policy),
  )
  const body = file.body as Uint8Array
  const sha256 = await runEffectOrThrow(computeSha256Hex(body))

  return {
    body,
    contentLength: file.contentLength,
    contentType,
    originalFilename: file.originalFilename ?? null,
    sha256,
  }
}

async function markUploadFailed(
  store: FileStore,
  context: AuthenticatedContext,
  fileId: string,
  storageStatus: "delete_pending" | "failed",
  objectKey?: string,
) {
  await store.markFileObjectUploadFailed?.(context, {
    fileId,
    ...(objectKey ? { objectKey } : {}),
    storageStatus,
  })
}

async function cleanupStoredObjectAfterFinalizationFailure(
  store: FileStore,
  storage: StorageProvider,
  context: AuthenticatedContext,
  fileId: string,
  objectKey: string,
) {
  let storageStatus: "delete_pending" | "failed" = "failed"
  let retryObjectKey: string | undefined
  try {
    await runEffectOrThrow(storage.deleteObject(objectKey))
  } catch {
    storageStatus = "delete_pending"
    retryObjectKey = objectKey
  }
  await markUploadFailed(store, context, fileId, storageStatus, retryObjectKey)
}

async function runEffectOrThrow<A, E>(effect: Effect.Effect<A, E>) {
  const exit = await Effect.runPromiseExit(effect)
  if (Exit.isSuccess(exit)) return exit.value

  const failure = Cause.failureOption(exit.cause)
  if (Option.isSome(failure)) throw failure.value
  throw new Error(Cause.pretty(exit.cause))
}

type ExpectedFileError =
  | ForbiddenError
  | InternalError
  | InvalidFileUploadError
  | NotFoundError
  | StorageError

function preserveExpectedError<E extends ExpectedFileError>(message: string) {
  return (cause: unknown): E | InternalError => {
    if (
      cause instanceof InternalError ||
      cause instanceof ForbiddenError ||
      cause instanceof InvalidFileUploadError ||
      cause instanceof NotFoundError ||
      cause instanceof StorageError
    ) {
      return cause as E
    }
    return new InternalError({
      code: "internal_error",
      details: { cause: String(cause) },
      message,
    })
  }
}
