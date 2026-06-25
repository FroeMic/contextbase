import { Schema } from "effect"
import { describe, expect, test } from "vitest"

import {
  CaptureClientPairBodySchema,
  CaptureClientPairResponseSchema,
  SessionCaptureManualSyncBodySchema,
  SessionCaptureManualSyncResponseSchema,
} from "./contract.js"

describe("session capture contracts", () => {
  test("decodes capture-client pairing envelopes", () => {
    const body = Schema.decodeUnknownSync(CaptureClientPairBodySchema)({
      label: "Chrome Extension",
    })
    const response = Schema.decodeUnknownSync(CaptureClientPairResponseSchema)({
      data: {
        client: {
          id: "cpc_123",
          label: "Chrome Extension",
          permission: ["session_capture:write", "session_capture:status"],
          status: "active",
          workspaceId: "wrk_123",
          workspaceSlug: "core",
        },
        rawToken: "cbc_raw",
      },
      ok: true,
    })

    expect(body.label).toBe("Chrome Extension")
    expect(response.data.client.permission).toContain("session_capture:write")
  })

  test("decodes manual sync request and response envelopes", () => {
    const body = Schema.decodeUnknownSync(SessionCaptureManualSyncBodySchema)({
      idempotencyKey: "sync-1",
      parserVersion: "chatgpt-dom@1",
      provider: { displayName: "ChatGPT", providerKey: "chatgpt" },
      session: {
        kind: "chat",
        sourceSessionId: "chat-1",
        sourceUrl: "https://chatgpt.com/c/chat-1",
        title: "Planning",
      },
      sourceSnapshot: {
        snapshotJson: "{}",
      },
      messages: [
        {
          contentText: "Hello",
          role: "user",
          sequenceNumber: "000001",
          sourceMessageId: "msg-1",
        },
      ],
    })
    const response = Schema.decodeUnknownSync(SessionCaptureManualSyncResponseSchema)({
      data: {
        artifactCount: 0,
        capturedSessionId: "cps_123",
        messageCount: 1,
        syncBatchId: "scb_123",
        syncStatus: "accepted",
      },
      ok: true,
    })

    expect(body.session.kind).toBe("chat")
    expect(body.messages?.[0]?.role).toBe("user")
    expect(response.data.syncStatus).toBe("accepted")
  })
})
