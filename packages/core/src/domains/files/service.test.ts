import { Effect } from "effect"
import { describe, expect, test } from "vitest"

import type { AuthenticatedContext } from "../auth/authenticate"
import type { FileContentDescriptorDto, FileStore } from "./service"
import { getFileContentDescriptor, uploadUserAvatar } from "./service"
import type { StorageProvider } from "./storage"

const authContext: AuthenticatedContext = {
  principalId: "usr_admin",
  principalKind: "user",
  role: "workspace_admin",
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

const contentDescriptor: FileContentDescriptorDto = {
  byteSize: 5,
  contentType: "image/png",
  fileId: "fil_123",
  objectKey: "workspaces/wrk_123/files/fil_123/original",
  originalFilename: "screenshot.png",
  provider: "local_disk",
  sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

const tinyPngAvatar = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  ),
)

describe("file service", () => {
  test("uploads a user avatar as a user-scoped public immutable asset", async () => {
    const calls: unknown[] = []
    const storedKeys: string[] = []
    const store: FileStore = {
      createPendingPublicAvatarFileObject: async (_context, input) => {
        calls.push({ input, op: "pending" })
        return { id: "fil_avatar" }
      },
      finalizeUserAvatarUpload: async (_context, input) => {
        calls.push({ input, op: "finalize" })
        return input
      },
    }
    const storage: StorageProvider = {
      id: "local_disk",
      deleteObject: () => Effect.void,
      getObject: () => Effect.die("not used"),
      headObject: () => Effect.die("not used"),
      putObject: (input) =>
        Effect.sync(() => {
          storedKeys.push(input.objectKey)
        }),
    }

    const result = await Effect.runPromise(
      uploadUserAvatar(store, storage, authContext, {
        file: {
          body: tinyPngAvatar,
          contentLength: tinyPngAvatar.byteLength,
          contentType: "image/png",
          originalFilename: "avatar.webp",
        },
        publicAssetsBaseUrl: "https://public.contextbase.test",
      }),
    )

    expect(result).toMatchObject({
      avatarUrl: expect.stringMatching(/^https:\/\/public\.contextbase\.test\/avatars\/avt_/),
      fileId: "fil_avatar",
      publicAssetId: expect.stringMatching(/^avt_/),
    })
    expect(storedKeys[0]).toMatch(/^public\/avatars\/avt_.+\/avatar\.webp$/)
    expect(calls).toMatchObject([
      {
        input: {
          ownerId: "usr_admin",
          ownerKind: "user",
          provider: "local_disk",
          scopeKind: "user",
        },
        op: "pending",
      },
      {
        input: {
          contentType: "image/webp",
          fileId: "fil_avatar",
          ownerId: "usr_admin",
          ownerKind: "user",
          scopeKind: "user",
        },
        op: "finalize",
      },
    ])
  })

  test("rejects avatar uploads from non-user principals", async () => {
    const store: FileStore = {
      createPendingPublicAvatarFileObject: async () => {
        throw new Error("pending avatar metadata should not be created")
      },
      finalizeUserAvatarUpload: async () => {
        throw new Error("avatar should not be finalized")
      },
    }
    const storage: StorageProvider = {
      id: "local_disk",
      deleteObject: () => Effect.void,
      getObject: () => Effect.die("not used"),
      headObject: () => Effect.die("not used"),
      putObject: () => Effect.die("not used"),
    }

    await expect(
      Effect.runPromise(
        Effect.either(
          uploadUserAvatar(
            store,
            storage,
            { ...authContext, principalKind: "agent" },
            {
              file: {
                body: tinyPngAvatar,
                contentLength: tinyPngAvatar.byteLength,
                contentType: "image/png",
              },
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "ForbiddenError",
        code: "forbidden",
      },
    })
  })

  test("rejects avatar uploads that cannot be decoded as images", async () => {
    const storedKeys: string[] = []
    const store: FileStore = {
      createPendingPublicAvatarFileObject: async () => {
        throw new Error("pending avatar metadata should not be created")
      },
      finalizeUserAvatarUpload: async () => {
        throw new Error("avatar should not be finalized")
      },
    }
    const storage: StorageProvider = {
      id: "local_disk",
      deleteObject: () => Effect.void,
      getObject: () => Effect.die("not used"),
      headObject: () => Effect.die("not used"),
      putObject: (input) =>
        Effect.sync(() => {
          storedKeys.push(input.objectKey)
        }),
    }

    await expect(
      Effect.runPromise(
        Effect.either(
          uploadUserAvatar(store, storage, authContext, {
            file: {
              body: new TextEncoder().encode("not a webp"),
              contentLength: 10,
              contentType: "image/webp",
              originalFilename: "avatar.webp",
            },
          }),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "InvalidFileUploadError",
        reason: "invalid_image",
      },
    })
    expect(storedKeys).toEqual([])
  })

  test("returns authenticated file content descriptors from the workspace store", async () => {
    const store: FileStore = {
      findFileContentDescriptorByIdInWorkspace: async () => contentDescriptor,
    }

    await expect(
      Effect.runPromise(getFileContentDescriptor(store, authContext, { fileId: "fil_123" })),
    ).resolves.toEqual(contentDescriptor)
  })

  test("returns not_found when a file content descriptor is unavailable", async () => {
    const store: FileStore = {
      findFileContentDescriptorByIdInWorkspace: async () => null,
    }

    await expect(
      Effect.runPromise(
        Effect.either(getFileContentDescriptor(store, authContext, { fileId: "fil_missing" })),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "NotFoundError",
        code: "not_found",
      },
    })
  })
})
