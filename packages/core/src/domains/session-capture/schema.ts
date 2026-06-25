import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"
import { createId } from "../../shared/ids"
import { fileObjects } from "../files/schema"
import { users } from "../users/schema"
import { workspaces } from "../workspaces/schema"

export const captureProviders = pgTable(
  "capture_providers",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("cpr")),
    providerKey: varchar("provider_key", { length: 80 }).notNull(),
    displayName: text("display_name").notNull(),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("capture_providers_provider_key_uq").on(table.providerKey),
    index("capture_providers_status_idx").on(table.status),
    check("capture_providers_status_check", sql`${table.status} in ('active', 'disabled')`),
  ],
)

export const captureClients = pgTable(
  "capture_clients",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("cpc")),
    workspaceId: varchar("workspace_id", { length: 32 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    workspaceSlug: varchar("workspace_slug", { length: 80 }).notNull(),
    createdByUserId: varchar("created_by_user_id", { length: 32 }).references(() => users.id, {
      onDelete: "set null",
    }),
    label: text("label").notNull(),
    tokenHash: text("token_hash").notNull(),
    permissionJson: text("permission_json")
      .default(JSON.stringify(["session_capture:write", "session_capture:status"]))
      .notNull(),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("capture_clients_token_hash_uq").on(table.tokenHash),
    index("capture_clients_workspace_status_idx").on(table.workspaceId, table.status),
    check("capture_clients_status_check", sql`${table.status} in ('active', 'revoked')`),
  ],
)

export const capturedSessions = pgTable(
  "captured_sessions",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("cps")),
    workspaceId: varchar("workspace_id", { length: 32 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    workspaceSlug: varchar("workspace_slug", { length: 80 }).notNull(),
    providerId: varchar("provider_id", { length: 32 })
      .notNull()
      .references(() => captureProviders.id),
    captureClientId: varchar("capture_client_id", { length: 32 }).references(
      () => captureClients.id,
      { onDelete: "set null" },
    ),
    kind: varchar("kind", { length: 32 }).default("unknown").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceSessionId: text("source_session_id"),
    sourceSessionKey: text("source_session_key").notNull(),
    title: text("title"),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    firstCapturedAt: timestamp("first_captured_at", { withTimezone: true }).defaultNow().notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).defaultNow().notNull(),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("captured_sessions_workspace_provider_source_uq").on(
      table.workspaceId,
      table.providerId,
      table.sourceSessionKey,
    ),
    index("captured_sessions_workspace_updated_idx").on(table.workspaceId, table.lastSyncedAt),
    check(
      "captured_sessions_kind_check",
      sql`${table.kind} in ('chat', 'coding', 'agent_run', 'unknown')`,
    ),
    check("captured_sessions_status_check", sql`${table.status} in ('active', 'archived')`),
  ],
)

export const capturedSessionMessages = pgTable(
  "captured_session_messages",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("cpm")),
    workspaceId: varchar("workspace_id", { length: 32 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    capturedSessionId: varchar("captured_session_id", { length: 32 })
      .notNull()
      .references(() => capturedSessions.id, { onDelete: "cascade" }),
    providerId: varchar("provider_id", { length: 32 })
      .notNull()
      .references(() => captureProviders.id),
    sourceMessageId: text("source_message_id"),
    sourceMessageKey: text("source_message_key").notNull(),
    sourceFingerprint: text("source_fingerprint").notNull(),
    role: varchar("role", { length: 32 }).default("unknown").notNull(),
    contentText: text("content_text"),
    contentJson: text("content_json"),
    sequenceNumber: varchar("sequence_number", { length: 48 }).notNull(),
    sourceCreatedAt: timestamp("source_created_at", { withTimezone: true }),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("captured_session_messages_source_key_uq").on(
      table.capturedSessionId,
      table.sourceMessageKey,
    ),
    index("captured_session_messages_session_order_idx").on(
      table.capturedSessionId,
      table.sequenceNumber,
    ),
    index("captured_session_messages_workspace_idx").on(table.workspaceId),
    check(
      "captured_session_messages_role_check",
      sql`${table.role} in ('user', 'assistant', 'system', 'tool', 'unknown')`,
    ),
  ],
)

export const capturedSessionArtifacts = pgTable(
  "captured_session_artifacts",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("cpa")),
    workspaceId: varchar("workspace_id", { length: 32 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    capturedSessionId: varchar("captured_session_id", { length: 32 })
      .notNull()
      .references(() => capturedSessions.id, { onDelete: "cascade" }),
    capturedMessageId: varchar("captured_message_id", { length: 32 }).references(
      () => capturedSessionMessages.id,
      { onDelete: "set null" },
    ),
    fileObjectId: varchar("file_object_id", { length: 32 }).references(() => fileObjects.id, {
      onDelete: "set null",
    }),
    artifactKind: varchar("artifact_kind", { length: 32 }).default("unknown").notNull(),
    sourceArtifactId: text("source_artifact_id"),
    sourceArtifactKey: text("source_artifact_key").notNull(),
    title: text("title"),
    contentType: text("content_type"),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("captured_session_artifacts_source_key_uq").on(
      table.capturedSessionId,
      table.sourceArtifactKey,
    ),
    index("captured_session_artifacts_message_idx").on(table.capturedMessageId),
    check(
      "captured_session_artifacts_kind_check",
      sql`${table.artifactKind} in ('code', 'file', 'image', 'link', 'attachment', 'unknown')`,
    ),
  ],
)

export const sessionCaptureSyncBatches = pgTable(
  "session_capture_sync_batches",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("scb")),
    workspaceId: varchar("workspace_id", { length: 32 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    captureClientId: varchar("capture_client_id", { length: 32 })
      .notNull()
      .references(() => captureClients.id, { onDelete: "cascade" }),
    capturedSessionId: varchar("captured_session_id", { length: 32 }).references(
      () => capturedSessions.id,
      { onDelete: "set null" },
    ),
    providerId: varchar("provider_id", { length: 32 }).references(() => captureProviders.id),
    idempotencyKey: text("idempotency_key").notNull(),
    parserVersion: text("parser_version"),
    status: varchar("status", { length: 32 }).default("accepted").notNull(),
    messageCount: integer("message_count").default(0).notNull(),
    artifactCount: integer("artifact_count").default(0).notNull(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("session_capture_sync_batches_client_key_uq").on(
      table.captureClientId,
      table.idempotencyKey,
    ),
    index("session_capture_sync_batches_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
    check(
      "session_capture_sync_batches_status_check",
      sql`${table.status} in ('accepted', 'rejected', 'failed')`,
    ),
  ],
)

export const capturedSessionSourceSnapshots = pgTable(
  "captured_session_source_snapshots",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("css")),
    workspaceId: varchar("workspace_id", { length: 32 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    capturedSessionId: varchar("captured_session_id", { length: 32 })
      .notNull()
      .references(() => capturedSessions.id, { onDelete: "cascade" }),
    syncBatchId: varchar("sync_batch_id", { length: 32 }).references(
      () => sessionCaptureSyncBatches.id,
      { onDelete: "set null" },
    ),
    providerId: varchar("provider_id", { length: 32 }).references(() => captureProviders.id),
    sourceUrl: text("source_url").notNull(),
    parserVersion: text("parser_version"),
    snapshotJson: text("snapshot_json"),
    fileObjectId: varchar("file_object_id", { length: 32 }).references(() => fileObjects.id, {
      onDelete: "set null",
    }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("captured_session_source_snapshots_session_created_idx").on(
      table.capturedSessionId,
      table.createdAt,
    ),
    check(
      "captured_session_source_snapshots_payload_check",
      sql`${table.snapshotJson} is not null or ${table.fileObjectId} is not null`,
    ),
  ],
)

export const sessionCaptureSyncEvents = pgTable(
  "session_capture_sync_events",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("sce")),
    workspaceId: varchar("workspace_id", { length: 32 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    captureClientId: varchar("capture_client_id", { length: 32 }).references(
      () => captureClients.id,
      { onDelete: "set null" },
    ),
    capturedSessionId: varchar("captured_session_id", { length: 32 }).references(
      () => capturedSessions.id,
      { onDelete: "set null" },
    ),
    syncBatchId: varchar("sync_batch_id", { length: 32 }).references(
      () => sessionCaptureSyncBatches.id,
      { onDelete: "set null" },
    ),
    providerId: varchar("provider_id", { length: 32 }).references(() => captureProviders.id),
    status: varchar("status", { length: 32 }).notNull(),
    messageCount: integer("message_count").default(0).notNull(),
    artifactCount: integer("artifact_count").default(0).notNull(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("session_capture_sync_events_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
    check(
      "session_capture_sync_events_status_check",
      sql`${table.status} in ('accepted', 'rejected', 'failed')`,
    ),
  ],
)
