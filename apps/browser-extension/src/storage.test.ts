import { describe, expect, test } from "vitest"

import {
  clearExtensionConfig,
  createMemoryStorageArea,
  getExtensionConfig,
  pairCaptureClient,
  saveCaptureTokenConfig,
} from "./storage"

describe("extension storage and pairing", () => {
  test("pairs a capture client and stores only the returned capture token", async () => {
    const storage = createMemoryStorageArea()
    const requests: Array<{ body: unknown; headers: Record<string, string>; url: string }> = []

    const result = await pairCaptureClient(
      storage,
      {
        apiBaseUrl: "http://127.0.0.1:3017",
        apiToken: "ctx_broad_api_token",
        label: "Chrome Extension",
      },
      async (url, init) => {
        requests.push({
          body: JSON.parse(String(init?.body)),
          headers: init?.headers as Record<string, string>,
          url: String(url),
        })
        return new Response(
          JSON.stringify({
            data: {
              client: {
                id: "cpc_123",
                label: "Chrome Extension",
                permission: ["session_capture:write", "session_capture:status"],
                status: "active",
                workspaceId: "wrk_123",
                workspaceSlug: "core",
              },
              rawToken: "cbc_capture_token",
            },
            ok: true,
          }),
          { status: 201 },
        )
      },
    )

    expect(result.captureToken).toBe("cbc_capture_token")
    expect(requests).toEqual([
      {
        body: { label: "Chrome Extension" },
        headers: {
          authorization: "Bearer ctx_broad_api_token",
          "content-type": "application/json",
        },
        url: "http://127.0.0.1:3017/api/v1/session-capture/clients",
      },
    ])
    await expect(getExtensionConfig(storage)).resolves.toMatchObject({
      apiBaseUrl: "http://127.0.0.1:3017",
      captureToken: "cbc_capture_token",
      client: {
        id: "cpc_123",
        workspaceSlug: "core",
      },
    })
    expect(JSON.stringify(storage.dump())).not.toContain("ctx_broad_api_token")
  })

  test("supports pasted capture-token configuration and clearing stored state", async () => {
    const storage = createMemoryStorageArea()

    await saveCaptureTokenConfig(storage, {
      apiBaseUrl: "http://127.0.0.1:3017/",
      captureToken: "cbc_existing",
    })
    await expect(getExtensionConfig(storage)).resolves.toMatchObject({
      apiBaseUrl: "http://127.0.0.1:3017",
      captureToken: "cbc_existing",
    })

    await clearExtensionConfig(storage)

    await expect(getExtensionConfig(storage)).resolves.toBeNull()
    expect(storage.dump()).toEqual({})
  })
})
