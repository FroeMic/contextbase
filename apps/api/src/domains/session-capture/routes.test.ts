import type {
  CaptureClientRecord,
  SessionCaptureStore,
} from "@contextbase/core/domains/session-capture/service"
import { Effect } from "effect"
import { describe, expect, test } from "vitest"

import { createApiApp } from "../../app"

const authContext = {
  principalId: "usr_admin",
  principalKind: "user",
  role: "workspace_admin",
  scopes: ["contextbase:manage" as const, "contextbase:write" as const],
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

const pairedClient: CaptureClientRecord = {
  id: "cpc_123",
  label: "Chrome",
  permission: ["session_capture:write", "session_capture:status"],
  status: "active",
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

describe("session capture routes", () => {
  test("pairs capture clients through normal workspace API auth", async () => {
    const app = createApiApp({
      authenticateApiToken: async () => authContext,
      sessionCaptureStore: {
        createCaptureClient: async (
          input: Parameters<NonNullable<SessionCaptureStore["createCaptureClient"]>>[0],
        ) => ({
          ...pairedClient,
          label: input.label,
          workspaceId: input.workspaceId,
          workspaceSlug: input.workspaceSlug,
        }),
        findActiveCaptureClientByTokenHash: async () => null,
      },
    })

    const response = await app.request("/api/v1/session-capture/clients", {
      body: JSON.stringify({ label: "Chrome" }),
      headers: {
        authorization: "Bearer api-token",
        "content-type": "application/json",
      },
      method: "POST",
    })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        client: {
          id: "cpc_123",
          permission: ["session_capture:write", "session_capture:status"],
          workspaceId: "wrk_123",
        },
        rawToken: expect.stringMatching(/^cbc_/),
      },
      ok: true,
    })
  })

  test("accepts manual sync with a capture-client token", async () => {
    const store = routeStore()
    const app = createApiApp({
      authenticateApiToken: async () => {
        throw new Error("manual sync should not use normal API token auth")
      },
      sessionCaptureStore: store,
    })

    const response = await app.request("/api/v1/session-capture/sync/manual", {
      body: JSON.stringify({
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
            sourceMessageId: "msg-1",
          },
        ],
      }),
      headers: {
        authorization: "Bearer capture-token",
        "content-type": "application/json",
      },
      method: "POST",
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        capturedSessionId: "cps_123",
        messageCount: 1,
        syncStatus: "accepted",
      },
      ok: true,
    })
  })

  test("applies repeated sync updates and appended messages through the HTTP endpoint", async () => {
    const store = statefulRouteStore()
    const app = createApiApp({ sessionCaptureStore: store })

    const first = await app.request("/api/v1/session-capture/sync/manual", {
      body: JSON.stringify({
        idempotencyKey: "sync-1",
        provider: { displayName: "ChatGPT", providerKey: "chatgpt" },
        session: {
          kind: "chat",
          sourceSessionId: "chat-1",
          sourceUrl: "https://chatgpt.com/c/chat-1",
          title: "Planning",
        },
        messages: [
          {
            contentText: "First prompt",
            role: "user",
            sequenceNumber: "000001",
            sourceMessageId: "msg-1",
          },
        ],
      }),
      headers: {
        authorization: "Bearer capture-token",
        "content-type": "application/json",
      },
      method: "POST",
    })
    const second = await app.request("/api/v1/session-capture/sync/manual", {
      body: JSON.stringify({
        idempotencyKey: "sync-2",
        provider: { displayName: "ChatGPT", providerKey: "chatgpt" },
        session: {
          kind: "chat",
          sourceSessionId: "chat-1",
          sourceUrl: "https://chatgpt.com/c/chat-1",
          title: "Planning v2",
        },
        messages: [
          {
            contentText: "Edited prompt",
            role: "user",
            sequenceNumber: "000001",
            sourceMessageId: "msg-1",
          },
          {
            contentText: "Assistant response",
            role: "assistant",
            sequenceNumber: "000002",
          },
        ],
      }),
      headers: {
        authorization: "Bearer capture-token",
        "content-type": "application/json",
      },
      method: "POST",
    })

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    await expect(second.json()).resolves.toMatchObject({
      data: {
        capturedSessionId: "cps_1",
        messageCount: 2,
        syncStatus: "accepted",
      },
      ok: true,
    })
    expect(store.messages).toHaveLength(2)
    expect(store.messages[0]).toMatchObject({
      contentText: "Edited prompt",
      sourceMessageKey: "msg-1",
    })
    expect(store.syncEvents).toHaveLength(2)
  })

  test("accepts automatic sync observation metadata through the existing sync endpoint", async () => {
    const sessions: unknown[] = []
    const app = createApiApp({
      sessionCaptureStore: {
        ...routeStore(),
        upsertCapturedSession: async (input) => {
          sessions.push(input)
          return {
            id: "cps_123",
            sourceSessionKey: input.sourceSessionKey,
          }
        },
      },
    })

    const response = await app.request("/api/v1/session-capture/sync/manual", {
      body: JSON.stringify({
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
            sourceMessageId: "msg-1",
          },
        ],
      }),
      headers: {
        authorization: "Bearer capture-token",
        "content-type": "application/json",
      },
      method: "POST",
    })

    expect(response.status).toBe(200)
    expect(
      JSON.parse((sessions[0] as { metadataJson?: string }).metadataJson ?? "{}"),
    ).toMatchObject({
      sessionCaptureObservation: {
        latestBoundarySeen: true,
        observationReason: "initial_load",
        observedMessageKeys: ["msg-1"],
        syncMode: "automatic",
      },
    })
  })

  test("rejects capture clients without write permission", async () => {
    const response = await createApiApp({
      sessionCaptureStore: {
        createCaptureClient: async () => pairedClient,
        findActiveCaptureClientByTokenHash: async () => ({
          ...pairedClient,
          permission: ["session_capture:status"],
        }),
      },
    }).request("/api/v1/session-capture/sync/manual", {
      body: JSON.stringify({
        provider: { displayName: "ChatGPT", providerKey: "chatgpt" },
        session: { kind: "chat", sourceUrl: "https://chatgpt.com/c/chat-1" },
      }),
      headers: {
        authorization: "Bearer capture-token",
        "content-type": "application/json",
      },
      method: "POST",
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "forbidden" },
      ok: false,
    })
  })

  test("uploads image files with a capture-client token", async () => {
    const uploads: unknown[] = []
    const app = createApiApp({
      fileStorage: {
        deleteObject: () => Effect.void,
        getObject: () => Effect.fail(new Error("unused") as never),
        headObject: () => Effect.succeed({ exists: true }),
        id: "local_disk",
        putObject: (input) => {
          uploads.push(input)
          return Effect.void
        },
      },
      fileStore: {
        createPendingWorkspaceFileObject: async (_context, input) => ({
          id: "file_image",
          ...input,
        }),
        finalizeWorkspaceFileUpload: async (_context, input) => input,
      },
      sessionCaptureStore: routeStore(),
    })
    const form = new FormData()
    form.set("file", new File([new Uint8Array([1, 2, 3])], "screenshot.png", { type: "image/png" }))
    form.set("sourceArtifactKey", "img-1")

    const response = await app.request("/api/v1/session-capture/files", {
      body: form,
      headers: { authorization: "Bearer capture-token" },
      method: "POST",
    })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        contentType: "image/png",
        fileObjectId: "file_image",
        originalFilename: "screenshot.png",
        storageStatus: "available",
      },
      ok: true,
    })
    expect(uploads).toEqual([
      expect.objectContaining({
        contentLength: 3,
        contentType: "image/png",
        objectKey: "workspaces/wrk_123/files/file_image/original",
      }),
    ])
  })

  test("rejects unsupported capture-client image uploads", async () => {
    const app = createApiApp({
      fileStorage: {
        deleteObject: () => Effect.void,
        getObject: () => Effect.fail(new Error("unused") as never),
        headObject: () => Effect.succeed({ exists: false }),
        id: "local_disk",
        putObject: () => Effect.void,
      },
      fileStore: {
        createPendingWorkspaceFileObject: async () => ({ id: "file_text" }),
        finalizeWorkspaceFileUpload: async (_context, input) => input,
      },
      sessionCaptureStore: routeStore(),
    })
    const form = new FormData()
    form.set("file", new File(["hello"], "note.txt", { type: "text/plain" }))

    const response = await app.request("/api/v1/session-capture/files", {
      body: form,
      headers: { authorization: "Bearer capture-token" },
      method: "POST",
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "invalid_request",
        message: "Uploaded file content type is not allowed.",
      },
      ok: false,
    })
  })

  test("rejects invalid capture-client tokens", async () => {
    const response = await createApiApp({
      sessionCaptureStore: {
        createCaptureClient: async () => pairedClient,
        findActiveCaptureClientByTokenHash: async () => null,
      },
    }).request("/api/v1/session-capture/sync/manual", {
      body: JSON.stringify({
        provider: { displayName: "ChatGPT", providerKey: "chatgpt" },
        session: { kind: "chat", sourceUrl: "https://chatgpt.com/c/chat-1" },
      }),
      headers: {
        authorization: "Bearer invalid",
        "content-type": "application/json",
      },
      method: "POST",
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "unauthenticated" },
      ok: false,
    })
  })

  test("rejects cross-workspace manual sync and invalid payloads", async () => {
    const app = createApiApp({ sessionCaptureStore: routeStore() })
    const crossWorkspace = await app.request("/api/v1/session-capture/sync/manual", {
      body: JSON.stringify({
        provider: { displayName: "ChatGPT", providerKey: "chatgpt" },
        session: {
          kind: "chat",
          sourceUrl: "https://chatgpt.com/c/chat-1",
          workspaceId: "wrk_other",
        },
      }),
      headers: {
        authorization: "Bearer capture-token",
        "content-type": "application/json",
      },
      method: "POST",
    })
    const invalidPayload = await app.request("/api/v1/session-capture/sync/manual", {
      body: JSON.stringify({ provider: { providerKey: "chatgpt" } }),
      headers: {
        authorization: "Bearer capture-token",
        "content-type": "application/json",
      },
      method: "POST",
    })

    expect(crossWorkspace.status).toBe(403)
    expect(invalidPayload.status).toBe(400)
  })
})

function routeStore(): SessionCaptureStore {
  return {
    createCaptureClient: async () => pairedClient,
    createSyncBatch: async () => ({ id: "scb_123" }),
    ensureCaptureProvider: async () => ({
      displayName: "ChatGPT",
      id: "cpr_123",
      providerKey: "chatgpt",
    }),
    findActiveCaptureClientByTokenHash: async () => pairedClient,
    recordSyncEvent: async () => undefined,
    touchCaptureClient: async () => undefined,
    upsertCapturedMessage: async () => ({ id: "cpm_123" }),
    upsertCapturedSession: async () => ({
      id: "cps_123",
      sourceSessionKey: "chat-1",
    }),
  }
}

function statefulRouteStore() {
  const messages = new Map<string, { contentText?: string; id: string; sourceMessageKey: string }>()
  const sessions = new Map<string, { id: string; sourceSessionKey: string; title?: string }>()
  const syncEvents: unknown[] = []
  const store: SessionCaptureStore & {
    messages: Array<{ contentText?: string; id: string; sourceMessageKey: string }>
    syncEvents: unknown[]
  } = {
    messages: [],
    syncEvents,
    createCaptureClient: async () => pairedClient,
    createSyncBatch: async () => ({ id: `scb_${syncEvents.length + 1}` }),
    ensureCaptureProvider: async () => ({
      displayName: "ChatGPT",
      id: "cpr_123",
      providerKey: "chatgpt",
    }),
    findActiveCaptureClientByTokenHash: async () => pairedClient,
    recordSyncEvent: async (input) => {
      syncEvents.push(input)
    },
    touchCaptureClient: async () => undefined,
    upsertCapturedMessage: async (input) => {
      const existing = messages.get(input.sourceMessageKey)
      const message = {
        id: existing?.id ?? `cpm_${messages.size + 1}`,
        sourceMessageKey: input.sourceMessageKey,
        ...(input.contentText ? { contentText: input.contentText } : {}),
      }
      messages.set(input.sourceMessageKey, message)
      store.messages = Array.from(messages.values())
      return { id: message.id }
    },
    upsertCapturedSession: async (input) => {
      const existing = sessions.get(input.sourceSessionKey)
      const session = {
        id: existing?.id ?? `cps_${sessions.size + 1}`,
        sourceSessionKey: input.sourceSessionKey,
        ...(input.title ? { title: input.title } : {}),
      }
      sessions.set(input.sourceSessionKey, session)
      return session
    },
  }

  return store
}
