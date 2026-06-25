import { describe, expect, test } from "vitest"

import { sendMagicLinkEmail } from "./agentmail"

describe("AgentMail sender", () => {
  test("sends a magic-link message through the configured inbox", async () => {
    const calls: unknown[] = []
    await sendMagicLinkEmail(
      {
        apiKey: "am_key",
        fetch: async (input, init) => {
          calls.push({ input, init })
          return new Response(JSON.stringify({ ok: true }), { status: 200 })
        },
        fromName: "Vertical",
        inboxId: "inb_123",
      },
      {
        email: "m@example.com",
        expiresAt: new Date("2026-01-01T00:15:00.000Z"),
        linkUrl: "https://vertical.example.com/auth/verify?token=raw",
      },
    )

    expect(calls).toMatchObject([
      {
        init: {
          headers: {
            authorization: "Bearer am_key",
            "content-type": "application/json",
          },
          method: "POST",
        },
        input: "https://api.agentmail.to/v0/inboxes/inb_123/messages/send",
      },
    ])
    expect(JSON.parse(String((calls[0] as { init: { body: string } }).init.body))).toMatchObject({
      to: ["m@example.com"],
    })
  })
})
