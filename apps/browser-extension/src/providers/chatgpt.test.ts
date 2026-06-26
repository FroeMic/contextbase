import { describe, expect, test } from "vitest"

import {
  CHATGPT_PARSER_VERSION,
  detectChatGptProvider,
  extractChatGptSession,
  hydrateChatGptImageArtifacts,
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
            <img src="https://images.example/screenshot.png" alt="Result screenshot" />
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
    expect(extracted.artifacts).toEqual([
      expect.objectContaining({
        artifactKind: "image",
        capturedMessageSourceKey: "msg-assistant-1",
        contentType: "image/*",
        sourceArtifactKey: "msg-assistant-1:image:https://images.example/screenshot.png",
        title: "Result screenshot",
      }),
    ])
    expect(extracted.sourceSnapshot?.snapshotJson).toBeDefined()
    expect(JSON.parse(extracted.sourceSnapshot?.snapshotJson ?? "")).toMatchObject({
      messageCount: 2,
      parserVersion: CHATGPT_PARSER_VERSION,
      providerKey: "chatgpt",
    })
  })

  test("hydrates remote visible images into uploadable artifact bytes", async () => {
    document.body.innerHTML = `
      <main>
        <article data-testid="conversation-turn-1">
          <div data-message-author-role="assistant" data-message-id="msg-assistant-1">
            <p>Here is the generated image.</p>
            <img src="https://images.example/1772517912913.webp" alt="1772517912913.webp" />
          </div>
        </article>
      </main>
    `

    const extracted = extractChatGptSession(document, new URL("https://chatgpt.com/c/chat-test-1"))
    const hydrated = await hydrateChatGptImageArtifacts(extracted, async () => {
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/webp" },
        status: 200,
      })
    })

    expect(hydrated.artifacts?.[0]).toMatchObject({
      contentType: "image/webp",
      imageData: {
        contentType: "image/webp",
        filename: "1772517912913.webp",
      },
    })
    expect(hydrated.artifacts?.[0]?.imageData?.bytes).toEqual(new Uint8Array([1, 2, 3]))

    const payload = toManualSyncPayload(hydrated)
    expect(JSON.stringify(payload)).not.toContain("imageData")
    expect(JSON.stringify(payload)).not.toContain("imageFetchUrl")
  })

  test("keeps inline image bytes out of extracted sessions for Chrome runtime messages", () => {
    document.body.innerHTML = `
      <main>
        <article data-testid="conversation-turn-1">
          <div data-message-author-role="assistant" data-message-id="msg-assistant-1">
            <img
              src="data:image/png;base64,AQID"
              alt="Generated image"
            />
          </div>
        </article>
      </main>
    `

    const extracted = extractChatGptSession(document, new URL("https://chatgpt.com/c/chat-test-1"))

    expect(extracted.artifacts?.[0]).toMatchObject({
      contentType: "image/png",
      imageFetchUrl: "data:image/png;base64,AQID",
    })
    expect(extracted.artifacts?.[0]).not.toHaveProperty("imageData")
  })

  test("keeps image-only assistant turns instead of dropping their artifacts", () => {
    document.body.innerHTML = `
      <main>
        <article data-testid="conversation-turn-1">
          <div data-message-author-role="user" data-message-id="msg-user-1">
            Generate a product mockup
          </div>
        </article>
        <article data-testid="conversation-turn-2">
          <div data-message-author-role="assistant" data-message-id="msg-image-1">
            <img src="https://images.example/1772517912913.webp" alt="1772517912913.webp" />
          </div>
        </article>
      </main>
    `

    const extracted = extractChatGptSession(document, new URL("https://chatgpt.com/c/chat-test-1"))

    expect(extracted.messages).toEqual([
      expect.objectContaining({
        contentText: "Generate a product mockup",
        role: "user",
        sequenceNumber: "000001",
        sourceMessageKey: "msg-user-1",
      }),
      expect.objectContaining({
        role: "assistant",
        sequenceNumber: "000002",
        sourceMessageKey: "msg-image-1",
      }),
    ])
    expect(extracted.messages[1]).not.toHaveProperty("contentText")
    expect(extracted.artifacts).toEqual([
      expect.objectContaining({
        artifactKind: "image",
        capturedMessageSourceKey: "msg-image-1",
        imageFetchUrl: "https://images.example/1772517912913.webp",
        title: "1772517912913.webp",
      }),
    ])
  })

  test("captures generated images rendered outside message articles", () => {
    document.body.innerHTML = `
      <main>
        <article data-testid="conversation-turn-1">
          <div data-message-author-role="user" data-message-id="msg-user-1">
            Generate a product mockup
          </div>
        </article>
        <div data-testid="canvas-thread-output">
          <img src="https://images.example/1772517912913.webp" alt="1772517912913.webp" />
        </div>
      </main>
    `

    const extracted = extractChatGptSession(document, new URL("https://chatgpt.com/c/chat-test-1"))

    expect(extracted.messages).toEqual([
      expect.objectContaining({
        contentText: "Generate a product mockup",
        role: "user",
        sequenceNumber: "000001",
        sourceMessageKey: "msg-user-1",
      }),
      expect.objectContaining({
        role: "assistant",
        sequenceNumber: "000002",
        sourceMessageKey:
          "chatgpt:assistant:generated-image:https://images.example/1772517912913.webp",
      }),
    ])
    expect(extracted.artifacts).toEqual([
      expect.objectContaining({
        artifactKind: "image",
        capturedMessageSourceKey:
          "chatgpt:assistant:generated-image:https://images.example/1772517912913.webp",
        imageFetchUrl: "https://images.example/1772517912913.webp",
        sourceArtifactKey: "chatgpt:image:https://images.example/1772517912913.webp",
        title: "1772517912913.webp",
      }),
    ])
  })

  test("captures generated images from protected ChatGPT content endpoints outside message articles", () => {
    document.body.innerHTML = `
      <main>
        <article data-testid="conversation-turn-1">
          <div data-message-author-role="user" data-message-id="msg-user-1">
            Turn this into a cartoon kangaroo
          </div>
        </article>
        <div data-testid="canvas-thread-output">
          <img
            src="https://chatgpt.com/backend-api/estuary/content?id=file_generated&ts=123&sig=abc"
            alt="Generated image"
          />
        </div>
      </main>
    `

    const extracted = extractChatGptSession(document, new URL("https://chatgpt.com/c/chat-test-1"))

    expect(extracted.messages).toEqual([
      expect.objectContaining({
        role: "user",
        sequenceNumber: "000001",
        sourceMessageKey: "msg-user-1",
      }),
      expect.objectContaining({
        role: "assistant",
        sequenceNumber: "000002",
        sourceMessageKey: "chatgpt:assistant:generated-image:chatgpt-estuary:file_generated",
      }),
    ])
    expect(extracted.artifacts).toEqual([
      expect.objectContaining({
        artifactKind: "image",
        capturedMessageSourceKey:
          "chatgpt:assistant:generated-image:chatgpt-estuary:file_generated",
        imageFetchUrl:
          "https://chatgpt.com/backend-api/estuary/content?id=file_generated&ts=123&sig=abc",
        title: "Generated image",
      }),
    ])
  })

  test("dedupes repeated generated image elements from ChatGPT output containers", () => {
    const generatedImageUrl =
      "https://chatgpt.com/backend-api/estuary/content?id=file_generated&ts=123&sig=abc"
    document.body.innerHTML = `
      <main>
        <article data-testid="conversation-turn-1">
          <div data-message-author-role="user" data-message-id="msg-user-1">
            Generate a dashboard illustration
          </div>
        </article>
        <div data-testid="canvas-thread-output">
          <img src="${generatedImageUrl}" alt="Generated image: Dashboard" />
          <img src="${generatedImageUrl}" alt="Image 2" />
          <img src="${generatedImageUrl}" alt="Image 3" />
        </div>
      </main>
    `

    const extracted = extractChatGptSession(document, new URL("https://chatgpt.com/c/chat-test-1"))

    expect(extracted.messages).toEqual([
      expect.objectContaining({ role: "user", sourceMessageKey: "msg-user-1" }),
      expect.objectContaining({
        role: "assistant",
        sourceMessageKey: "chatgpt:assistant:generated-image:chatgpt-estuary:file_generated",
      }),
    ])
    expect(extracted.artifacts).toEqual([
      expect.objectContaining({
        capturedMessageSourceKey:
          "chatgpt:assistant:generated-image:chatgpt-estuary:file_generated",
        imageFetchUrl: generatedImageUrl,
        sourceArtifactKey: "chatgpt:image:chatgpt-estuary:file_generated",
        title: "Generated image: Dashboard",
      }),
    ])
  })

  test("keeps generated image keys stable when later observations see more messages", () => {
    const generatedImageUrl =
      "https://chatgpt.com/backend-api/estuary/content?id=file_generated&ts=123&sig=abc"
    document.body.innerHTML = `
      <main>
        <article data-testid="conversation-turn-1">
          <div data-message-author-role="user" data-message-id="msg-user-1">
            Generate a dashboard illustration
          </div>
        </article>
        <div data-testid="canvas-thread-output">
          <img src="${generatedImageUrl}" alt="Generated image: Dashboard" />
        </div>
      </main>
    `

    const first = extractChatGptSession(document, new URL("https://chatgpt.com/c/chat-test-1"))

    document.body.innerHTML = `
      <main>
        <article data-testid="conversation-turn-1">
          <div data-message-author-role="user" data-message-id="msg-user-1">
            Generate a dashboard illustration
          </div>
        </article>
        <article data-testid="conversation-turn-2">
          <div data-message-author-role="assistant" data-message-id="msg-assistant-2">
            Added explanation.
          </div>
        </article>
        <div data-testid="canvas-thread-output">
          <img src="${generatedImageUrl}" alt="Generated image: Dashboard" />
        </div>
      </main>
    `

    const second = extractChatGptSession(document, new URL("https://chatgpt.com/c/chat-test-1"))

    expect(first.messages.at(-1)?.sourceMessageKey).toBe(second.messages.at(-1)?.sourceMessageKey)
    expect(first.artifacts?.[0]?.sourceArtifactKey).toBe(second.artifacts?.[0]?.sourceArtifactKey)
  })

  test("captures generated blob images outside message articles", () => {
    document.body.innerHTML = `
      <main>
        <article data-testid="conversation-turn-1">
          <div data-message-author-role="user" data-message-id="msg-user-1">
            Generate an avatar
          </div>
        </article>
        <div data-testid="canvas-thread-output">
          <img src="blob:https://chatgpt.com/generated-image" alt="Generated image" />
        </div>
      </main>
    `

    const extracted = extractChatGptSession(document, new URL("https://chatgpt.com/c/chat-test-1"))

    expect(extracted.messages).toHaveLength(2)
    expect(extracted.messages[1]).toMatchObject({
      role: "assistant",
      sequenceNumber: "000002",
      sourceMessageKey:
        "chatgpt:assistant:generated-image:blob:https://chatgpt.com/generated-image",
    })
    expect(extracted.artifacts?.[0]).toMatchObject({
      artifactKind: "image",
      imageFetchUrl: "blob:https://chatgpt.com/generated-image",
      title: "Generated image",
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
