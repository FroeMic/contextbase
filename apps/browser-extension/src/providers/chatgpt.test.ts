import { describe, expect, test } from "vitest"

import {
  CHATGPT_PARSER_VERSION,
  detectChatGptProvider,
  extractChatGptSession,
  toManualSyncPayload,
} from "./chatgpt"

describe("ChatGPT provider adapter", () => {
  test("detects supported ChatGPT origins and rejects unsupported pages", () => {
    expect(detectChatGptProvider(new URL("https://chatgpt.com/c/abc"))).toMatchObject({
      providerKey: "chatgpt",
    })
    expect(detectChatGptProvider(new URL("https://chat.openai.com/c/abc"))).toMatchObject({
      providerKey: "chatgpt",
    })
    expect(detectChatGptProvider(new URL("https://claude.ai/chat/abc"))).toBeNull()
  })

  test("extracts the visible conversation with stable message ordering and snapshot data", () => {
    document.body.innerHTML = `
      <main>
        <h1>Parser Planning</h1>
        <article data-testid="conversation-turn-1">
          <div data-message-author-role="user" data-message-id="msg-user-1">
            <p>Hello Contextbase</p>
          </div>
        </article>
        <article data-testid="conversation-turn-2">
          <div data-message-author-role="assistant" data-message-id="msg-assistant-1">
            <p>Captured successfully.</p>
            <pre><code>console.log("artifact")</code></pre>
          </div>
        </article>
      </main>
    `

    const extracted = extractChatGptSession(document, new URL("https://chatgpt.com/c/chat-test-1"))

    expect(extracted).toMatchObject({
      parserVersion: CHATGPT_PARSER_VERSION,
      provider: { displayName: "ChatGPT", providerKey: "chatgpt" },
      session: {
        kind: "chat",
        sourceSessionId: "chat-test-1",
        sourceUrl: "https://chatgpt.com/c/chat-test-1",
        title: "Parser Planning",
      },
    })
    expect(extracted.messages).toEqual([
      {
        contentText: "Hello Contextbase",
        role: "user",
        sequenceNumber: "000001",
        sourceMessageId: "msg-user-1",
        sourceMessageKey: "msg-user-1",
      },
      {
        contentText: 'Captured successfully.\nconsole.log("artifact")',
        role: "assistant",
        sequenceNumber: "000002",
        sourceMessageId: "msg-assistant-1",
        sourceMessageKey: "msg-assistant-1",
      },
    ])
    expect(extracted.sourceSnapshot?.snapshotJson).toBeDefined()
    expect(JSON.parse(extracted.sourceSnapshot?.snapshotJson ?? "")).toMatchObject({
      messageCount: 2,
      parserVersion: CHATGPT_PARSER_VERSION,
      providerKey: "chatgpt",
    })
  })

  test("falls back when title and provider message ids are missing without collecting credentials", () => {
    localStorage.setItem("provider_token", "secret")
    document.body.innerHTML = `
      <main>
        <article data-testid="conversation-turn-1">
          <div data-message-author-role="user">No source id</div>
        </article>
      </main>
    `

    const extracted = extractChatGptSession(document, new URL("https://chatgpt.com/c/no-ids"))
    const payload = toManualSyncPayload(extracted)
    const serialized = JSON.stringify(payload)

    expect(payload.session.title).toBe("Untitled ChatGPT session")
    expect(payload.messages?.[0]).toMatchObject({
      role: "user",
      sequenceNumber: "000001",
      sourceMessageKey: "chatgpt:000001:user:No source id",
    })
    expect(serialized).not.toContain("secret")
    expect(serialized).not.toContain("provider_token")
    expect(serialized).not.toContain("cookie")
    expect(serialized).not.toContain("localStorage")
  })

  test("keeps deterministic source keys stable across repeated extraction without provider ids", () => {
    document.body.innerHTML = `
      <main>
        <article data-testid="conversation-turn-1">
          <div data-message-author-role="user">Stable prompt</div>
        </article>
      </main>
    `

    const first = extractChatGptSession(document, new URL("https://chatgpt.com/c/repeated"))
    const second = extractChatGptSession(document, new URL("https://chatgpt.com/c/repeated"))

    expect(first.messages[0]?.sourceMessageKey).toBe(second.messages[0]?.sourceMessageKey)
    expect(first.messages[0]?.sourceMessageKey).toBe("chatgpt:000001:user:Stable prompt")
  })
})
