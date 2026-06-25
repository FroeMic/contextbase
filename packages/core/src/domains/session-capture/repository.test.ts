import { getTableName } from "drizzle-orm"
import { describe, expect, test } from "vitest"

import { createPostgresSessionCaptureStore } from "./repository"

describe("postgres session capture repository", () => {
  test("creates workspace-scoped capture clients", async () => {
    const writes: Array<{ tableName: string; values: unknown }> = []
    const store = createPostgresSessionCaptureStore({
      db: insertOnlyDb(writes, {
        id: "cpc_123",
        label: "Chrome",
        permissionJson: JSON.stringify(["session_capture:write", "session_capture:status"]),
        status: "active",
        workspaceId: "wrk_123",
        workspaceSlug: "core",
      }),
    } as never)

    const client = await store.createCaptureClient?.({
      createdByUserId: "usr_123",
      label: "Chrome",
      permission: ["session_capture:write", "session_capture:status"],
      tokenHash: "hash_123",
      workspaceId: "wrk_123",
      workspaceSlug: "core",
    })

    expect(client).toMatchObject({
      id: "cpc_123",
      permission: ["session_capture:write", "session_capture:status"],
      workspaceId: "wrk_123",
    })
    expect(writes).toEqual([
      {
        tableName: "capture_clients",
        values: {
          createdByUserId: "usr_123",
          label: "Chrome",
          permissionJson: JSON.stringify(["session_capture:write", "session_capture:status"]),
          tokenHash: "hash_123",
          workspaceId: "wrk_123",
          workspaceSlug: "core",
        },
      },
    ])
  })

  test("upserts providers, sessions, messages, snapshots, and sync events", async () => {
    const writes: Array<{ tableName: string; values: unknown }> = []
    const store = createPostgresSessionCaptureStore({
      db: insertOnlyDb(writes, {
        id: "generic_id",
        providerKey: "chatgpt",
        displayName: "ChatGPT",
        sourceSessionKey: "chat-1",
        title: "Planning",
      }),
    } as never)

    await store.ensureCaptureProvider?.({ displayName: "ChatGPT", providerKey: "chatgpt" })
    await store.upsertCapturedSession?.({
      captureClientId: "cpc_123",
      kind: "chat",
      lastSyncedAt: new Date("2026-01-01T00:00:00.000Z"),
      providerId: "cpr_123",
      sourceSessionKey: "chat-1",
      sourceUrl: "https://chatgpt.com/c/chat-1",
      title: "Planning",
      workspaceId: "wrk_123",
      workspaceSlug: "core",
    })
    await store.upsertCapturedMessage?.({
      capturedSessionId: "cps_123",
      contentText: "Hello",
      providerId: "cpr_123",
      role: "user",
      sequenceNumber: "000001",
      sourceFingerprint: "fingerprint",
      sourceMessageKey: "msg-1",
      workspaceId: "wrk_123",
    })
    await store.storeSourceSnapshot?.({
      capturedSessionId: "cps_123",
      snapshotJson: "{}",
      sourceUrl: "https://chatgpt.com/c/chat-1",
      workspaceId: "wrk_123",
    })
    await store.recordSyncEvent?.({
      artifactCount: 0,
      captureClientId: "cpc_123",
      capturedSessionId: "cps_123",
      messageCount: 1,
      status: "accepted",
      workspaceId: "wrk_123",
    })

    expect(writes.map((write) => write.tableName)).toEqual([
      "capture_providers",
      "captured_sessions",
      "captured_session_messages",
      "captured_session_source_snapshots",
      "session_capture_sync_events",
    ])
    expect(writes[2]?.values).toMatchObject({
      contentText: "Hello",
      sourceMessageKey: "msg-1",
      workspaceId: "wrk_123",
    })
  })
})

function insertOnlyDb(
  writes: Array<{ tableName: string; values: unknown }>,
  returningRow: unknown,
) {
  return {
    insert: (table: unknown) => {
      const tableName = getTableName(table as never)
      const chain = {
        onConflictDoUpdate: () => chain,
        returning: () => [returningRow],
        values: (values: unknown) => {
          writes.push({ tableName, values })
          return chain
        },
      }
      return chain
    },
  }
}
