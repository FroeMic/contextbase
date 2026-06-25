import { Effect } from "effect"
import { describe, expect, test } from "vitest"

import type { AuthenticatedContext } from "../auth/authenticate"
import {
  authenticateCaptureClient,
  type CaptureClientRecord,
  createWorkspaceCaptureClient,
  ingestManualSyncBatch,
  type SessionCaptureStore,
} from "./service"

const adminContext: AuthenticatedContext = {
  principalId: "usr_admin",
  principalKind: "user",
  role: "workspace_admin",
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

describe("session capture service", () => {
  test("pairs a workspace-scoped write-limited capture client", async () => {
    const writes: unknown[] = []
    const store: SessionCaptureStore = {
      createCaptureClient: async (input) => {
        writes.push(input)
        return {
          ...pairedClient,
          id: "cpc_created",
          label: input.label,
          workspaceId: input.workspaceId,
          workspaceSlug: input.workspaceSlug,
        }
      },
      findActiveCaptureClientByTokenHash: async () => null,
    }

    const result = await Effect.runPromise(
      createWorkspaceCaptureClient(store, adminContext, {
        label: "Chrome Extension",
        randomToken: () => "cbc_raw",
      }),
    )

    expect(result.rawToken).toBe("cbc_raw")
    expect(result.client).toMatchObject({
      label: "Chrome Extension",
      permission: ["session_capture:write", "session_capture:status"],
      workspaceId: "wrk_123",
      workspaceSlug: "core",
    })
    expect(writes).toEqual([
      expect.objectContaining({
        createdByUserId: "usr_admin",
        label: "Chrome Extension",
        permission: ["session_capture:write", "session_capture:status"],
        workspaceId: "wrk_123",
        workspaceSlug: "core",
      }),
    ])
  })

  test("authenticates capture clients as write-limited workspace credentials", async () => {
    const store: SessionCaptureStore = {
      createCaptureClient: async () => pairedClient,
      findActiveCaptureClientByTokenHash: async () => pairedClient,
      touchCaptureClient: async () => undefined,
    }

    const auth = await Effect.runPromise(authenticateCaptureClient(store, "cbc_raw"))

    expect(auth).toEqual({
      authKind: "capture_client",
      captureClientId: "cpc_123",
      permissions: ["session_capture:write", "session_capture:status"],
      role: "capture_client",
      workspaceId: "wrk_123",
      workspaceSlug: "core",
    })
  })

  test("rejects capture-client writes to any workspace except the paired workspace", async () => {
    const store = createInMemoryStore()

    await expect(
      Effect.runPromise(
        Effect.either(
          ingestManualSyncBatch(store, pairedClient, {
            provider: { displayName: "ChatGPT", providerKey: "chatgpt" },
            session: {
              kind: "chat",
              sourceSessionId: "chat-1",
              sourceUrl: "https://chatgpt.com/c/chat-1",
              title: "Planning",
              workspaceId: "wrk_other",
            },
          }),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "ForbiddenError",
        code: "forbidden",
      },
    })
  })

  test("ingests repeated and edited manual sync batches idempotently", async () => {
    const store = createInMemoryStore()
    const first = await Effect.runPromise(
      ingestManualSyncBatch(store, pairedClient, {
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
          snapshotJson: JSON.stringify({ title: "Planning" }),
          sourceUrl: "https://chatgpt.com/c/chat-1",
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
    )

    const second = await Effect.runPromise(
      ingestManualSyncBatch(store, pairedClient, {
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
    )

    expect(first.capturedSessionId).toBe(second.capturedSessionId)
    expect(second).toMatchObject({
      artifactCount: 0,
      messageCount: 2,
      syncStatus: "accepted",
    })
    expect(store.messages).toHaveLength(2)
    expect(store.messages[0]).toMatchObject({
      contentText: "Edited prompt",
      sourceMessageKey: "msg-1",
    })
    expect(store.syncEvents.map((event) => event.status)).toEqual(["accepted", "accepted"])
    expect(store.sourceSnapshots).toHaveLength(1)
  })

  test("stores automatic observation metadata and writes final sync batch counts", async () => {
    const store = createInMemoryStore()

    await Effect.runPromise(
      ingestManualSyncBatch(store, pairedClient, {
        idempotencyKey: "auto-sync-1",
        observation: {
          latestBoundarySeen: true,
          latestObservedMessageKey: "msg-2",
          observationReason: "initial_load",
          observedAt: new Date("2026-06-25T16:25:00.000Z"),
          observedMessageKeys: ["msg-1", "msg-2"],
          oldestBoundarySeen: false,
          syncMode: "automatic",
          visibleMessageCount: 2,
        },
        parserVersion: "chatgpt-dom@1",
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
          {
            contentText: "Assistant response",
            role: "assistant",
            sequenceNumber: "000002",
            sourceMessageId: "msg-2",
          },
        ],
      }),
    )

    expect(JSON.parse(store.sessions[0]?.metadataJson ?? "{}")).toMatchObject({
      sessionCaptureObservation: {
        latestBoundarySeen: true,
        latestObservedMessageKey: "msg-2",
        observationReason: "initial_load",
        observedMessageKeys: ["msg-1", "msg-2"],
        oldestBoundarySeen: false,
        syncMode: "automatic",
        visibleMessageCount: 2,
      },
    })
    expect(store.syncBatches[0]).toMatchObject({
      artifactCount: 0,
      messageCount: 2,
      status: "accepted",
    })
  })
})

function createInMemoryStore() {
  const providers = new Map<string, { displayName: string; id: string; providerKey: string }>()
  const sessions = new Map<
    string,
    { id: string; metadataJson?: string; sourceSessionKey: string; title?: string }
  >()
  const messages = new Map<string, { contentText?: string; id: string; sourceMessageKey: string }>()
  const syncBatches: unknown[] = []
  const syncEvents: Array<{ status: string }> = []
  const sourceSnapshots: Array<{ snapshotJson?: string }> = []
  const store: SessionCaptureStore & {
    messages: Array<{ contentText?: string; id: string; sourceMessageKey: string }>
    sessions: Array<{ id: string; metadataJson?: string; sourceSessionKey: string; title?: string }>
    sourceSnapshots: Array<{ snapshotJson?: string }>
    syncBatches: unknown[]
    syncEvents: Array<{ status: string }>
  } = {
    messages: [],
    sessions: [],
    sourceSnapshots,
    syncBatches,
    syncEvents,
    createCaptureClient: async () => pairedClient,
    createSyncBatch: async (input) => {
      syncBatches.push(input)
      return { id: `scb_${syncBatches.length}` }
    },
    ensureCaptureProvider: async (input) => {
      const existing = providers.get(input.providerKey)
      if (existing) return existing
      const provider = { ...input, id: `cpr_${providers.size + 1}` }
      providers.set(input.providerKey, provider)
      return provider
    },
    findActiveCaptureClientByTokenHash: async () => pairedClient,
    recordSyncEvent: async (input) => {
      syncEvents.push({ status: input.status })
    },
    storeSourceSnapshot: async (input) => {
      sourceSnapshots.push({
        ...(input.snapshotJson ? { snapshotJson: input.snapshotJson } : {}),
      })
      return { id: `css_${sourceSnapshots.length}` }
    },
    touchCaptureClient: async () => undefined,
    upsertCapturedArtifact: async () => ({ id: "cpa_1" }),
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
      const inputWithMetadata = input as typeof input & { metadataJson?: string }
      const session = {
        id: existing?.id ?? `cps_${sessions.size + 1}`,
        sourceSessionKey: input.sourceSessionKey,
        ...(inputWithMetadata.metadataJson ? { metadataJson: inputWithMetadata.metadataJson } : {}),
        ...(input.title ? { title: input.title } : {}),
      }
      sessions.set(input.sourceSessionKey, session)
      store.sessions = Array.from(sessions.values())
      return session
    },
  }

  return store
}
