import {
  type AuthenticatedContext,
  AuthenticationError,
  type FileStore,
  type StorageProvider,
} from "@contextbase/core"
import { Effect } from "effect"
import { describe, expect, test } from "vitest"

import { handleBrowserFileRequest, handlePublicAvatarRequest } from "./browser-file-routes"

const authContext: AuthenticatedContext = {
  principalId: "usr_admin",
  principalKind: "user",
  role: "workspace_admin",
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

const fileSha256 = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"

const tinyPngAvatar = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  ),
)

describe("browser file routes", () => {
  test("rejects unauthenticated browser requests", async () => {
    const response = await handleBrowserFileRequest(
      new Request("https://contextbase.localhost/api/files/fil_123/content"),
      {
        requireSession: async () => {
          throw new AuthenticationError({
            code: "unauthenticated",
            message: "Browser session is required.",
          })
        },
      },
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "unauthenticated" },
      ok: false,
    })
  })

  test("does not route copied product file endpoints", async () => {
    for (const path of [
      "/api/files/chats/drafts",
      "/api/files/tasks/tsk_123/files",
      "/api/files/tasks/tsk_123/files/inline",
      "/api/files/contacts/cnt_123/files",
      "/api/files/organizations/org_123/files",
      "/api/settings/agents/agt_123/avatar",
      "/api/settings/businesses/biz_123/avatar",
    ]) {
      const response = await handleBrowserFileRequest(
        new Request(`https://contextbase.localhost${path}`, { method: "POST" }),
        { requireSession },
      )

      expect(response.status, path).toBe(404)
    }
  })

  test("uploads user avatars through the browser file route", async () => {
    const storedKeys: string[] = []
    const formData = new FormData()
    formData.set(
      "file",
      new File([tinyPngAvatar], "avatar.webp", {
        type: "image/webp",
      }),
    )

    const response = await handleBrowserFileRequest(
      new Request("https://contextbase.localhost/api/settings/account/avatar", {
        body: formData,
        method: "POST",
      }),
      {
        fileStorage: storageProvider(storedKeys),
        fileStore: avatarFileStore(),
        publicAssetsBaseUrl: "https://public.contextbase.test",
        requireSession,
      },
    )

    expect(response.status).toBe(201)
    expect(storedKeys[0]).toMatch(/^public\/avatars\/avt_.+\/avatar\.webp$/)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        avatarUrl: expect.stringMatching(/^https:\/\/public\.contextbase\.test\/avatars\/avt_/),
        fileId: "fil_avatar",
      },
      ok: true,
    })
  })

  test("streams file content with private browser headers", async () => {
    const response = await handleBrowserFileRequest(
      new Request("https://contextbase.localhost/api/files/fil_123/content"),
      {
        fileStorage: storageProvider([]),
        fileStore: {
          findFileContentDescriptorByIdInWorkspace: async () => ({
            byteSize: 5,
            contentType: "image/png",
            fileId: "fil_123",
            objectKey: "workspaces/wrk_123/files/fil_123/original",
            originalFilename: "screenshot.png",
            provider: "local_disk",
            sha256: fileSha256,
            workspaceId: "wrk_123",
            workspaceSlug: "core",
          }),
        },
        requireSession,
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, max-age=60")
    expect(response.headers.get("content-disposition")).toBe('inline; filename="screenshot.png"')
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4, 5]))
  })

  test("streams workspace file content without copied business session scope", async () => {
    let storageReadCalled = false
    const response = await handleBrowserFileRequest(
      new Request("https://contextbase.localhost/api/files/fil_999/content"),
      {
        fileStorage: {
          ...storageProvider([]),
          getObject: () =>
            Effect.sync(() => {
              storageReadCalled = true
              return {
                body: new Uint8Array([1, 2, 3, 4, 5]),
                contentLength: 5,
                contentType: "image/png",
              }
            }),
        },
        fileStore: {
          findFileContentDescriptorByIdInWorkspace: async () => ({
            byteSize: 5,
            contentType: "image/png",
            fileId: "fil_999",
            objectKey: "workspaces/wrk_123/files/fil_999/original",
            originalFilename: "other.png",
            provider: "local_disk",
            sha256: fileSha256,
            workspaceId: "wrk_123",
            workspaceSlug: "core",
          }),
        },
        requireSession,
      },
    )

    expect(response.status).toBe(200)
    expect(storageReadCalled).toBe(true)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4, 5]))
  })

  test("serves public avatar HEAD requests without a session", async () => {
    const response = await handlePublicAvatarRequest(
      new Request("https://contextbase.localhost/public/avatars/avt_123", { method: "HEAD" }),
      {
        fileStorage: storageProvider([]),
        fileStore: publicAvatarFileStore(),
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable")
    expect(response.headers.get("content-type")).toBe("image/webp")
    expect(response.headers.get("etag")).toBe(`"${fileSha256}"`)
    expect(response.body).toBeNull()
  })

  test("does not route copied attachment delete endpoints", async () => {
    const response = await handleBrowserFileRequest(
      new Request("https://contextbase.localhost/api/files/file-attachments/fla_123", {
        method: "DELETE",
      }),
      { requireSession },
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "not_found" },
      ok: false,
    })
  })
})

async function requireSession() {
  return {
    context: authContext,
    session: {
      activeWorkspaceId: "wrk_123",
      activeWorkspaceRole: "workspace_admin" as const,
      activeWorkspaceSlug: "core",
      email: "admin@example.com",
      expiresAt: new Date("2026-02-01T00:00:00.000Z"),
      sessionId: "ses_123",
      userId: "usr_admin",
      workspaces: [{ role: "workspace_admin", workspaceId: "wrk_123", workspaceSlug: "core" }],
    },
  }
}

function storageProvider(storedKeys: string[]): StorageProvider {
  return {
    deleteObject: () => Effect.void,
    getObject: () =>
      Effect.succeed({
        body: new Uint8Array([1, 2, 3, 4, 5]),
        contentLength: 5,
        contentType: "image/png",
      }),
    headObject: () => Effect.succeed({ exists: true }),
    id: "local_disk",
    putObject: (input) =>
      Effect.sync(() => {
        storedKeys.push(input.objectKey)
      }),
  }
}

function avatarFileStore(): FileStore {
  return {
    createPendingPublicAvatarFileObject: async () => ({ id: "fil_avatar" }),
    finalizeUserAvatarUpload: async (_context, input) => input,
  }
}

function publicAvatarFileStore(): FileStore {
  return {
    findPublicFileContentDescriptorByAssetId: async () => ({
      byteSize: 5,
      contentType: "image/webp",
      fileId: "fil_avatar",
      objectKey: "public/avatars/avt_123/avatar.webp",
      provider: "local_disk",
      publicAssetId: "avt_123",
      sha256: fileSha256,
    }),
  }
}
