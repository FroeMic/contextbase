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
        captureToken: "vcc_capture",
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
          authorization: "Bearer vcc_capture",
          "content-type": "application/json",
        },
        url: "http://127.0.0.1:3017/api/v1/session-capture/sync/manual",
      },
    ])
  })

  test("returns useful sync errors without mutating configuration", async () => {
    await expect(
      syncExtractedSession(
        { apiBaseUrl: "http://127.0.0.1:3017", captureToken: "vcc_capture" },
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
        { apiBaseUrl: "http://127.0.0.1:3017", captureToken: "vcc_capture" },
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
