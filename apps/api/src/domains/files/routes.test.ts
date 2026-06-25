import type { FileStore } from "@contextbase/core/domains/files/service"
import type { StorageProvider } from "@contextbase/core/domains/files/storage"
import { Effect } from "effect"
import { describe, expect, test } from "vitest"

import { createApiApp } from "../../app"

const authContext = {
  principalId: "usr_admin",
  principalKind: "user",
  role: "workspace_admin",
  scopes: ["contextbase:files" as const, "contextbase:read" as const, "contextbase:write" as const],
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

describe("file routes", () => {
  test("streams authenticated file content", async () => {
    const app = createApiApp({
      authenticateApiToken: async () => authContext,
      fileStorage: storageProvider(),
      fileStore: fileStore(),
    })

    const response = await app.request("/api/v1/files/fil_123/content", {
      headers: { authorization: "Bearer token" },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, max-age=60")
    expect(response.headers.get("content-disposition")).toBe('inline; filename="screenshot.png"')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4, 5]))
  })

  test("requires file scope for content reads", async () => {
    const app = createApiApp({
      authenticateApiToken: async () => ({
        ...authContext,
        scopes: ["contextbase:read" as const],
      }),
      fileStorage: storageProvider(),
      fileStore: fileStore(),
    })

    const response = await app.request("/api/v1/files/fil_123/content", {
      headers: { authorization: "Bearer token" },
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "forbidden" },
      ok: false,
    })
  })

  test("does not expose copied attachment and deep-link product routes", async () => {
    const app = createApiApp({
      authenticateApiToken: async () => authContext,
      fileStorage: storageProvider(),
      fileStore: fileStore(),
    })

    for (const [method, path] of [
      ["POST", "/api/v1/files"],
      ["GET", "/api/v1/attachments?ownerType=task&ownerId=tsk_123"],
      ["POST", "/api/v1/attachments/upload"],
      ["POST", "/api/v1/files/inline-upload"],
      ["POST", "/api/v1/deep-links/resolve"],
    ] as const) {
      const response = await app.request(path, {
        headers: { authorization: "Bearer token" },
        method,
      })

      expect(response.status, path).toBe(404)
    }
  })
})

function fileStore(): FileStore {
  return {
    findFileContentDescriptorByIdInWorkspace: async () => ({
      byteSize: 5,
      contentType: "image/png",
      fileId: "fil_123",
      objectKey: "workspaces/wrk_123/files/fil_123/original",
      originalFilename: "screenshot.png",
      provider: "local_disk",
      sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
      workspaceId: "wrk_123",
      workspaceSlug: "core",
    }),
  }
}

function storageProvider(): StorageProvider {
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
    putObject: () => Effect.void,
  }
}
