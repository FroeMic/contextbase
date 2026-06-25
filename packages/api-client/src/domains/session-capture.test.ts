import type {
  CaptureClientPairBody,
  CaptureClientPairResponse,
  SessionCaptureManualSyncBody,
  SessionCaptureManualSyncResponse,
} from "@contextbase/contracts"
import { describe, expect, expectTypeOf, test } from "vitest"

import { createApiClient } from "../client"
import { createSessionCaptureClient } from "./session-capture"

describe("session capture api client", () => {
  test("exposes session capture contract types", () => {
    const client = createSessionCaptureClient(createApiClient({ baseUrl: "http://local.test" }))

    expectTypeOf<Parameters<typeof client.pairClient>[0]>().toEqualTypeOf<CaptureClientPairBody>()
    expectTypeOf<
      Awaited<ReturnType<typeof client.pairClient>>
    >().toEqualTypeOf<CaptureClientPairResponse>()
    expectTypeOf<
      Parameters<typeof client.syncManual>[0]
    >().toEqualTypeOf<SessionCaptureManualSyncBody>()
    expectTypeOf<
      Awaited<ReturnType<typeof client.syncManual>>
    >().toEqualTypeOf<SessionCaptureManualSyncResponse>()
  })

  test("posts pairing and manual sync payloads", async () => {
    const calls: unknown[] = []
    const client = createSessionCaptureClient(
      createApiClient({
        baseUrl: "http://local.test",
        fetch: async (input, init) => {
          calls.push({ input, init })

          return new Response(
            JSON.stringify({
              data: {
                artifactCount: 0,
                capturedSessionId: "cps_123",
                messageCount: 1,
                syncStatus: "accepted",
              },
              ok: true,
            }),
          )
        },
      }),
    )

    await client.pairClient({ label: "Chrome Extension" })
    await client.syncManual({
      provider: { displayName: "ChatGPT", providerKey: "chatgpt" },
      session: {
        kind: "chat",
        sourceSessionId: "chat-1",
        sourceUrl: "https://chatgpt.com/c/chat-1",
      },
      messages: [
        {
          contentText: "Hello",
          role: "user",
          sequenceNumber: "000001",
        },
      ],
    })

    expect(calls).toMatchObject([
      {
        input: "http://local.test/api/v1/session-capture/clients",
        init: {
          body: JSON.stringify({ label: "Chrome Extension" }),
          method: "POST",
        },
      },
      {
        input: "http://local.test/api/v1/session-capture/sync/manual",
        init: {
          method: "POST",
        },
      },
    ])
  })
})
