import { getTableName } from "drizzle-orm"
import { describe, expect, test } from "vitest"

import type { AuthenticatedContext } from "../auth/authenticate"
import { createPostgresFileStore } from "./repository"

const authContext: AuthenticatedContext = {
  principalId: "usr_admin",
  principalKind: "user",
  role: "workspace_admin",
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

const availableFileObjectRow = {
  byteSize: 5,
  contentType: "image/png",
  id: "fil_123",
  objectKey: "workspaces/wrk_123/files/fil_123/original",
  originalFilename: "screenshot.png",
  provider: "local_disk",
  sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  storageStatus: "available",
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

describe("postgres file repository", () => {
  test("creates pending public avatar file objects with user scope metadata", async () => {
    const inserts: Array<{ tableName: string; values: unknown }> = []
    const fakeDb = {
      insert: (table: unknown) => {
        const tableName = getTableName(table as never)
        const chain = {
          returning: () => [{ id: "fil_avatar" }],
          values: (values: unknown) => {
            inserts.push({ tableName, values })
            return chain
          },
        }
        return chain
      },
    }

    await createPostgresFileStore({
      db: fakeDb,
    } as never).createPendingPublicAvatarFileObject?.(authContext, {
      createdById: "usr_admin",
      createdByKind: "user",
      ownerId: "usr_admin",
      ownerKind: "user",
      provider: "local_disk",
      publicAssetId: "avt_123",
      scopeKind: "user",
    })

    expect(inserts).toEqual([
      {
        tableName: "file_objects",
        values: {
          createdById: "usr_admin",
          createdByKind: "user",
          originalFilename: null,
          ownerId: "usr_admin",
          ownerKind: "user",
          provider: "local_disk",
          publicAssetId: "avt_123",
          scopeKind: "user",
          usageKind: "avatar",
          visibility: "public",
          workspaceId: null,
          workspaceSlug: null,
        },
      },
    ])
  })

  test("finalizes user avatars", async () => {
    const tableActions: Array<{ action: string; tableName: string; values?: unknown }> = []
    const fakeTx = {
      update: (table: unknown) => {
        const tableName = getTableName(table as never)
        const chain = {
          returning: () => [{ id: "fil_avatar" }],
          set: (values: unknown) => {
            tableActions.push({ action: "update", tableName, values })
            return chain
          },
          where: () => chain,
        }
        return chain
      },
    }
    const client = {
      db: {
        transaction: async <T>(fn: (tx: typeof fakeTx) => Promise<T>) => fn(fakeTx),
      },
    }

    const result = await createPostgresFileStore(client as never).finalizeUserAvatarUpload?.(
      authContext,
      {
        byteSize: 68,
        contentType: "image/webp",
        fileId: "fil_avatar",
        objectKey: "public/avatars/avt_123/avatar.webp",
        ownerId: "usr_admin",
        ownerKind: "user",
        publicAssetId: "avt_123",
        scopeKind: "user",
        sha256: "a".repeat(64),
      },
    )

    expect(result).toMatchObject({ fileId: "fil_avatar", publicAssetId: "avt_123" })
    expect(tableActions).toMatchObject([
      {
        action: "update",
        tableName: "file_objects",
        values: {
          byteSize: 68,
          contentType: "image/webp",
          objectKey: "public/avatars/avt_123/avatar.webp",
          sha256: "a".repeat(64),
          storageStatus: "available",
        },
      },
    ])
  })

  test("finds authenticated workspace file content descriptors", async () => {
    const fakeDb = {
      select: () => ({
        from: () => ({
          where: () => [availableFileObjectRow],
        }),
      }),
    }

    const result = await createPostgresFileStore({
      db: fakeDb,
    } as never).findFileContentDescriptorByIdInWorkspace?.(authContext, "fil_123")

    expect(result).toEqual({
      byteSize: 5,
      contentType: "image/png",
      fileId: "fil_123",
      objectKey: "workspaces/wrk_123/files/fil_123/original",
      originalFilename: "screenshot.png",
      provider: "local_disk",
      sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
      workspaceId: "wrk_123",
      workspaceSlug: "core",
    })
  })

  test("finds public avatar descriptors", async () => {
    const fakeDb = {
      select: () => ({
        from: () => ({
          where: () => [
            {
              byteSize: 68,
              contentType: "image/webp",
              fileId: "fil_avatar",
              objectKey: "public/avatars/avt_123/avatar.webp",
              provider: "local_disk",
              publicAssetId: "avt_123",
              sha256: "a".repeat(64),
            },
          ],
        }),
      }),
    }

    const result = await createPostgresFileStore({
      db: fakeDb,
    } as never).findPublicFileContentDescriptorByAssetId?.("avt_123")

    expect(result).toEqual({
      byteSize: 68,
      contentType: "image/webp",
      fileId: "fil_avatar",
      objectKey: "public/avatars/avt_123/avatar.webp",
      provider: "local_disk",
      publicAssetId: "avt_123",
      sha256: "a".repeat(64),
    })
  })

  test("marks file object uploads as failed", async () => {
    const tableActions: Array<{ tableName: string; values: unknown }> = []
    const fakeDb = {
      update: (table: unknown) => {
        const tableName = getTableName(table as never)
        const chain = {
          set: (values: unknown) => {
            tableActions.push({ tableName, values })
            return chain
          },
          where: () => undefined,
        }
        return chain
      },
    }

    await createPostgresFileStore({
      db: fakeDb,
    } as never).markFileObjectUploadFailed?.(authContext, {
      fileId: "fil_avatar",
      objectKey: "public/avatars/avt_123/avatar.webp",
      storageStatus: "delete_pending",
    })

    expect(tableActions).toMatchObject([
      {
        tableName: "file_objects",
        values: {
          objectKey: "public/avatars/avt_123/avatar.webp",
          storageStatus: "delete_pending",
        },
      },
    ])
  })
})
