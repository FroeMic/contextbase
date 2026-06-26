import { describe, expect, test } from "vitest"

import type { ExtractedSession } from "./providers/types"
import { syncExtractedSession } from "./sync"

describe("manual sync", () => {
  test("posts extracted sessions to the session-capture manual sync endpoint", async () => {
    const requests: Array<{ body: unknown; headers: Record<string, string>; url: string }> = []
    const extracted: ExtractedSession = {
      messages: [
        {
          contentText: "Hello",
          role: "user",
          sequenceNumber: "000001",
          sourceMessageKey: "msg-1",
        },
      ],
      parserVersion: "chatgpt-dom@0.1.0",
      provider: { displayName: "ChatGPT", providerKey: "chatgpt" },
      session: {
        kind: "chat",
        sourceSessionId: "chat-1",
        sourceUrl: "https://chatgpt.com/c/chat-1",
      },
      sourceSnapshot: {
        snapshotJson: "{}",
        sourceUrl: "https://chatgpt.com/c/chat-1",
      },
    }

    const result = await syncExtractedSession(
      {
        apiBaseUrl: "http://127.0.0.1:3017/",
        captureToken: "cbc_capture",
      },
      extracted,
      async (url, init) => {
        requests.push({
          body: JSON.parse(String(init?.body)),
          headers: init?.headers as Record<string, string>,
          url: String(url),
        })
        return new Response(
          JSON.stringify({
            data: {
              capturedSessionId: "cps_123",
              messageCount: 1,
              syncStatus: "accepted",
            },
            ok: true,
          }),
          { status: 200 },
        )
      },
    )

    expect(result).toMatchObject({
      capturedSessionId: "cps_123",
      messageCount: 1,
      syncStatus: "accepted",
    })
    expect(requests).toEqual([
      {
        body: {
          messages: [
            {
              contentText: "Hello",
              role: "user",
              sequenceNumber: "000001",
              sourceMessageKey: "msg-1",
            },
          ],
          parserVersion: "chatgpt-dom@0.1.0",
          provider: { displayName: "ChatGPT", providerKey: "chatgpt" },
          session: {
            kind: "chat",
            sourceSessionId: "chat-1",
            sourceUrl: "https://chatgpt.com/c/chat-1",
          },
          sourceSnapshot: {
            snapshotJson: "{}",
            sourceUrl: "https://chatgpt.com/c/chat-1",
          },
        },
        headers: {
          authorization: "Bearer cbc_capture",
          "content-type": "application/json",
        },
        url: "http://127.0.0.1:3017/api/v1/session-capture/sync/manual",
      },
    ])
  })

  test("includes automatic observation metadata in sync payloads", async () => {
    const requests: Array<{ body: unknown; url: string }> = []

    await syncExtractedSession(
      {
        apiBaseUrl: "http://127.0.0.1:3017/",
        captureToken: "cbc_capture",
      },
      {
        messages: [
          {
            contentText: "Hello",
            role: "user",
            sequenceNumber: "000001",
            sourceMessageKey: "msg-1",
          },
        ],
        observation: {
          latestBoundarySeen: true,
          latestObservedMessageKey: "msg-1",
          observationReason: "initial_load",
          observedAt: "2026-06-25T16:25:00.000Z",
          observedMessageKeys: ["msg-1"],
          oldestBoundarySeen: false,
          syncMode: "automatic",
          visibleMessageCount: 1,
        },
        parserVersion: "chatgpt-dom@0.1.0",
        provider: { displayName: "ChatGPT", providerKey: "chatgpt" },
        session: {
          kind: "chat",
          sourceSessionId: "chat-1",
          sourceUrl: "https://chatgpt.com/c/chat-1",
        },
      },
      async (url, init) => {
        requests.push({
          body: JSON.parse(String(init?.body)),
          url: String(url),
        })
        return new Response(
          JSON.stringify({
            data: {
              capturedSessionId: "cps_123",
              messageCount: 1,
              syncStatus: "accepted",
            },
            ok: true,
          }),
          { status: 200 },
        )
      },
    )

    expect(requests[0]?.body).toMatchObject({
      observation: {
        latestBoundarySeen: true,
        observationReason: "initial_load",
        observedMessageKeys: ["msg-1"],
        syncMode: "automatic",
        visibleMessageCount: 1,
      },
    })
  })

  test("uploads image artifact bytes before syncing artifact references", async () => {
    const requests: Array<{ body: unknown; url: string }> = []

    await syncExtractedSession(
      {
        apiBaseUrl: "http://127.0.0.1:3017/",
        captureToken: "cbc_capture",
      },
      {
        artifacts: [
          {
            artifactKind: "image",
            capturedMessageSourceKey: "msg-1",
            contentType: "image/png",
            imageData: {
              bytes: new Uint8Array([1, 2, 3]),
              contentType: "image/png",
              filename: "screenshot.png",
            },
            sourceArtifactKey: "img-1",
            title: "Screenshot",
          },
        ],
        messages: [
          {
            contentText: "See image",
            role: "user",
            sequenceNumber: "000001",
            sourceMessageKey: "msg-1",
          },
        ],
        parserVersion: "chatgpt-dom@0.1.0",
        provider: { displayName: "ChatGPT", providerKey: "chatgpt" },
        session: {
          kind: "chat",
          sourceSessionId: "chat-1",
          sourceUrl: "https://chatgpt.com/c/chat-1",
        },
      },
      async (url, init) => {
        requests.push({
          body:
            init?.body instanceof FormData
              ? { kind: "form", sourceArtifactKey: init.body.get("sourceArtifactKey") }
              : JSON.parse(String(init?.body)),
          url: String(url),
        })

        if (String(url).endsWith("/api/v1/session-capture/files")) {
          return new Response(
            JSON.stringify({
              data: {
                contentType: "image/png",
                fileObjectId: "file_image",
                originalFilename: "screenshot.png",
                storageStatus: "available",
              },
              ok: true,
            }),
            { status: 201 },
          )
        }

        return new Response(
          JSON.stringify({
            data: {
              artifactCount: 1,
              capturedSessionId: "cps_123",
              messageCount: 1,
              syncStatus: "accepted",
            },
            ok: true,
          }),
          { status: 200 },
        )
      },
    )

    expect(requests).toEqual([
      {
        body: { kind: "form", sourceArtifactKey: "img-1" },
        url: "http://127.0.0.1:3017/api/v1/session-capture/files",
      },
      expect.objectContaining({
        body: expect.objectContaining({
          artifacts: [
            expect.objectContaining({
              capturedMessageSourceKey: "msg-1",
              fileObjectId: "file_image",
              sourceArtifactKey: "img-1",
            }),
          ],
        }),
        url: "http://127.0.0.1:3017/api/v1/session-capture/sync/manual",
      }),
    ])
  })

  test("fetches remote image artifact URLs before syncing artifact references", async () => {
    const requests: Array<{ body: unknown; url: string }> = []

    await syncExtractedSession(
      {
        apiBaseUrl: "http://127.0.0.1:3017/",
        captureToken: "cbc_capture",
      },
      {
        artifacts: [
          {
            artifactKind: "image",
            capturedMessageSourceKey: "msg-1",
            contentType: "image/*",
            imageFetchUrl: "https://images.example/1772517912913.webp",
            sourceArtifactKey: "img-1",
            title: "1772517912913.webp",
          },
        ],
        messages: [
          {
            contentText: "See image",
            role: "assistant",
            sequenceNumber: "000001",
            sourceMessageKey: "msg-1",
          },
        ],
        parserVersion: "chatgpt-dom@0.1.0",
        provider: { displayName: "ChatGPT", providerKey: "chatgpt" },
        session: {
          kind: "chat",
          sourceUrl: "https://chatgpt.com/c/chat-1",
        },
      },
      async (url, init) => {
        requests.push({
          body:
            init?.body instanceof FormData
              ? { filename: (init.body.get("file") as File).name, kind: "form" }
              : init?.body
                ? JSON.parse(String(init.body))
                : undefined,
          url: String(url),
        })

        if (String(url) === "https://images.example/1772517912913.webp") {
          return new Response(new Uint8Array([1, 2, 3]), {
            headers: { "content-type": "image/webp" },
            status: 200,
          })
        }

        if (String(url).endsWith("/api/v1/session-capture/files")) {
          return new Response(
            JSON.stringify({
              data: {
                contentType: "image/webp",
                fileObjectId: "file_image",
                originalFilename: "1772517912913.webp",
                storageStatus: "available",
              },
              ok: true,
            }),
            { status: 201 },
          )
        }

        return new Response(
          JSON.stringify({
            data: {
              artifactCount: 1,
              capturedSessionId: "cps_123",
              messageCount: 1,
              syncStatus: "accepted",
            },
            ok: true,
          }),
          { status: 200 },
        )
      },
    )

    expect(requests).toEqual([
      { body: undefined, url: "https://images.example/1772517912913.webp" },
      {
        body: { filename: "1772517912913.webp", kind: "form" },
        url: "http://127.0.0.1:3017/api/v1/session-capture/files",
      },
      expect.objectContaining({
        body: expect.objectContaining({
          artifacts: [
            expect.not.objectContaining({
              imageFetchUrl: expect.anything(),
              imageData: expect.anything(),
            }),
          ],
        }),
        url: "http://127.0.0.1:3017/api/v1/session-capture/sync/manual",
      }),
    ])
  })

  test("returns image upload errors before syncing session payloads", async () => {
    const requests: string[] = []

    await expect(
      syncExtractedSession(
        {
          apiBaseUrl: "http://127.0.0.1:3017/",
          captureToken: "cbc_capture",
        },
        {
          artifacts: [
            {
              artifactKind: "image",
              capturedMessageSourceKey: "msg-1",
              contentType: "image/png",
              imageData: {
                bytes: new Uint8Array([1, 2, 3]),
                contentType: "image/png",
                filename: "screenshot.png",
              },
              sourceArtifactKey: "img-1",
            },
          ],
          messages: [
            {
              contentText: "See image",
              role: "user",
              sequenceNumber: "000001",
              sourceMessageKey: "msg-1",
            },
          ],
          parserVersion: "chatgpt-dom@0.1.0",
          provider: { displayName: "ChatGPT", providerKey: "chatgpt" },
          session: {
            kind: "chat",
            sourceUrl: "https://chatgpt.com/c/chat-1",
          },
        },
        async (url) => {
          requests.push(String(url))
          return new Response(
            JSON.stringify({
              error: { code: "invalid_request", message: "Uploaded file is too large." },
              ok: false,
            }),
            { status: 400 },
          )
        },
      ),
    ).resolves.toEqual({
      error: "Uploaded file is too large.",
      ok: false,
      status: 400,
    })
    expect(requests).toEqual(["http://127.0.0.1:3017/api/v1/session-capture/files"])
  })

  test("returns useful sync errors without mutating configuration", async () => {
    await expect(
      syncExtractedSession(
        { apiBaseUrl: "http://127.0.0.1:3017", captureToken: "cbc_capture" },
        {
          messages: [],
          parserVersion: "chatgpt-dom@0.1.0",
          provider: { displayName: "ChatGPT", providerKey: "chatgpt" },
          session: {
            kind: "chat",
            sourceUrl: "https://chatgpt.com/c/chat-1",
          },
        },
        async () =>
          new Response(
            JSON.stringify({
              error: { code: "forbidden", message: "Nope" },
              ok: false,
            }),
            { status: 403 },
          ),
      ),
    ).resolves.toEqual({
      error: "Nope",
      ok: false,
      status: 403,
    })
  })

  test("reports network failures as sync failures", async () => {
    await expect(
      syncExtractedSession(
        { apiBaseUrl: "http://127.0.0.1:3017", captureToken: "cbc_capture" },
        {
          messages: [],
          parserVersion: "chatgpt-dom@0.1.0",
          provider: { displayName: "ChatGPT", providerKey: "chatgpt" },
          session: {
            kind: "chat",
            sourceUrl: "https://chatgpt.com/c/chat-1",
          },
        },
        async () => {
          throw new Error("Network unavailable")
        },
      ),
    ).resolves.toEqual({
      error: "Network unavailable",
      ok: false,
    })
  })
})
