import { and, eq, isNull } from "drizzle-orm"

import type { DbClient } from "../../db/client"
import { fileObjects } from "../../db/schema"
import type { FileStorageStatus, FileStore } from "./service"

export function createPostgresFileStore(client: DbClient): FileStore {
  return {
    createPendingPublicAvatarFileObject: async (_context, input) => {
      const [file] = await client.db
        .insert(fileObjects)
        .values({
          createdById: input.createdById,
          createdByKind: input.createdByKind,
          originalFilename: null,
          ownerId: input.ownerId,
          ownerKind: input.ownerKind,
          provider: input.provider,
          publicAssetId: input.publicAssetId,
          scopeKind: input.scopeKind,
          usageKind: "avatar",
          visibility: "public",
          workspaceId: null,
          workspaceSlug: null,
        })
        .returning({ id: fileObjects.id })
      if (!file) throw new Error("Avatar file object insert failed")
      return file
    },
    finalizeUserAvatarUpload: async (_context, input) =>
      client.db.transaction(async (tx) => {
        const [file] = await tx
          .update(fileObjects)
          .set({
            byteSize: input.byteSize,
            contentType: input.contentType,
            objectKey: input.objectKey,
            sha256: input.sha256,
            storageStatus: "available",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(fileObjects.id, input.fileId),
              eq(fileObjects.scopeKind, "user"),
              eq(fileObjects.ownerKind, "user"),
              eq(fileObjects.ownerId, input.ownerId),
              eq(fileObjects.storageStatus, "pending"),
            ),
          )
          .returning({ id: fileObjects.id })
        if (!file) throw new Error("User avatar finalization failed")

        return input
      }),
    findFileContentDescriptorByIdInWorkspace: async (context, fileId) => {
      const [file] = await client.db
        .select(fileObjectSelection)
        .from(fileObjects)
        .where(
          and(
            eq(fileObjects.id, fileId),
            eq(fileObjects.workspaceId, context.workspaceId),
            eq(fileObjects.storageStatus, "available"),
            isNull(fileObjects.deletedAt),
          ),
        )
      return file ? mapFileContentDescriptorRow(file) : null
    },
    findPublicFileContentDescriptorByAssetId: async (publicAssetId) => {
      const [file] = await client.db
        .select({
          byteSize: fileObjects.byteSize,
          contentType: fileObjects.contentType,
          fileId: fileObjects.id,
          objectKey: fileObjects.objectKey,
          provider: fileObjects.provider,
          publicAssetId: fileObjects.publicAssetId,
          sha256: fileObjects.sha256,
        })
        .from(fileObjects)
        .where(
          and(
            eq(fileObjects.publicAssetId, publicAssetId),
            eq(fileObjects.visibility, "public"),
            eq(fileObjects.usageKind, "avatar"),
            eq(fileObjects.storageStatus, "available"),
            isNull(fileObjects.deletedAt),
          ),
        )
      if (
        !file ||
        file.byteSize === null ||
        file.contentType === null ||
        file.objectKey === null ||
        file.publicAssetId === null ||
        file.sha256 === null
      ) {
        return null
      }
      return {
        byteSize: file.byteSize,
        contentType: file.contentType,
        fileId: file.fileId,
        objectKey: file.objectKey,
        provider: file.provider,
        publicAssetId: file.publicAssetId,
        sha256: file.sha256,
      }
    },
    markFileObjectUploadFailed: async (_context, input) => {
      await client.db
        .update(fileObjects)
        .set(
          input.objectKey
            ? {
                objectKey: input.objectKey,
                storageStatus: input.storageStatus,
                updatedAt: new Date(),
              }
            : {
                storageStatus: input.storageStatus,
                updatedAt: new Date(),
              },
        )
        .where(eq(fileObjects.id, input.fileId))
    },
  }
}

const fileObjectSelection = {
  byteSize: fileObjects.byteSize,
  contentType: fileObjects.contentType,
  id: fileObjects.id,
  objectKey: fileObjects.objectKey,
  originalFilename: fileObjects.originalFilename,
  provider: fileObjects.provider,
  sha256: fileObjects.sha256,
  storageStatus: fileObjects.storageStatus,
  workspaceId: fileObjects.workspaceId,
  workspaceSlug: fileObjects.workspaceSlug,
}

type FileObjectRow = {
  byteSize: number | null
  contentType: string | null
  id: string
  objectKey: string | null
  originalFilename: string | null
  provider: string
  sha256: string | null
  storageStatus: string
  workspaceId: string | null
  workspaceSlug: string | null
}

function mapFileContentDescriptorRow(row: FileObjectRow) {
  if (
    row.byteSize === null ||
    row.contentType === null ||
    row.objectKey === null ||
    row.sha256 === null ||
    row.workspaceId === null ||
    row.workspaceSlug === null
  ) {
    throw new Error("Available file object is missing required metadata")
  }

  return {
    byteSize: row.byteSize,
    contentType: row.contentType,
    fileId: row.id,
    objectKey: row.objectKey,
    originalFilename: row.originalFilename,
    provider: row.provider,
    sha256: row.sha256,
    workspaceId: row.workspaceId,
    workspaceSlug: row.workspaceSlug,
  }
}

export function mapFileStorageStatus(status: string): FileStorageStatus {
  return status as FileStorageStatus
}
