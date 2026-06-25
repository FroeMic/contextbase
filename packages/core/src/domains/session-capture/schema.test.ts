import { getTableColumns, getTableName } from "drizzle-orm"
import { getTableConfig } from "drizzle-orm/pg-core"
import { describe, expect, test } from "vitest"

import {
  captureClients,
  capturedSessionArtifacts,
  capturedSessionMessages,
  capturedSessionSourceSnapshots,
  capturedSessions,
  captureProviders,
  sessionCaptureSyncBatches,
  sessionCaptureSyncEvents,
} from "./schema"

describe("session capture schema", () => {
  test("defines provider-neutral session capture tables", () => {
    expect(getTableName(captureProviders)).toBe("capture_providers")
    expect(getTableName(captureClients)).toBe("capture_clients")
    expect(getTableName(capturedSessions)).toBe("captured_sessions")
    expect(getTableName(capturedSessionMessages)).toBe("captured_session_messages")
    expect(getTableName(capturedSessionArtifacts)).toBe("captured_session_artifacts")
    expect(getTableName(capturedSessionSourceSnapshots)).toBe("captured_session_source_snapshots")
    expect(getTableName(sessionCaptureSyncBatches)).toBe("session_capture_sync_batches")
    expect(getTableName(sessionCaptureSyncEvents)).toBe("session_capture_sync_events")
  })

  test("keeps workspace ownership and capture-client scope explicit", () => {
    const clientColumns = getTableColumns(captureClients)
    expect(clientColumns.workspaceId.name).toBe("workspace_id")
    expect(clientColumns.workspaceSlug.name).toBe("workspace_slug")
    expect(clientColumns.tokenHash.name).toBe("token_hash")
    expect(clientColumns.permissionJson.name).toBe("permission_json")

    const sessionColumns = getTableColumns(capturedSessions)
    expect(sessionColumns.workspaceId.name).toBe("workspace_id")
    expect(sessionColumns.workspaceSlug.name).toBe("workspace_slug")
    expect(sessionColumns.captureClientId.name).toBe("capture_client_id")
    expect(sessionColumns.providerId.name).toBe("provider_id")
  })

  test("defines idempotency and enum guardrails", () => {
    const sessionIndexNames = getTableConfig(capturedSessions).indexes.map(
      (index) => index.config.name,
    )
    expect(sessionIndexNames).toContain("captured_sessions_workspace_provider_source_uq")

    const messageIndexNames = getTableConfig(capturedSessionMessages).indexes.map(
      (index) => index.config.name,
    )
    expect(messageIndexNames).toContain("captured_session_messages_source_key_uq")
    expect(messageIndexNames).toContain("captured_session_messages_session_order_idx")

    const clientIndexNames = getTableConfig(captureClients).indexes.map(
      (index) => index.config.name,
    )
    expect(clientIndexNames).toContain("capture_clients_token_hash_uq")

    const sessionCheckNames = getTableConfig(capturedSessions).checks.map((check) => check.name)
    expect(sessionCheckNames).toContain("captured_sessions_kind_check")

    const messageCheckNames = getTableConfig(capturedSessionMessages).checks.map(
      (check) => check.name,
    )
    expect(messageCheckNames).toContain("captured_session_messages_role_check")
  })

  test("tracks timestamps for captured records and sync outcomes", () => {
    const sessionColumns = getTableColumns(capturedSessions)
    expect(sessionColumns.firstCapturedAt.notNull).toBe(true)
    expect(sessionColumns.lastSyncedAt.notNull).toBe(true)
    expect(sessionColumns.createdAt.notNull).toBe(true)
    expect(sessionColumns.updatedAt.notNull).toBe(true)

    const snapshotColumns = getTableColumns(capturedSessionSourceSnapshots)
    expect(snapshotColumns.capturedAt.notNull).toBe(true)
    expect(snapshotColumns.createdAt.notNull).toBe(true)

    const syncEventColumns = getTableColumns(sessionCaptureSyncEvents)
    expect(syncEventColumns.createdAt.notNull).toBe(true)
    expect(syncEventColumns.status.notNull).toBe(true)
  })
})
