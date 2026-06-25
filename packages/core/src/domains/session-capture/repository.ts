import { and, eq } from "drizzle-orm"

import type { DbClient } from "../../db/client"
import {
  captureClients,
  capturedSessionArtifacts,
  capturedSessionMessages,
  capturedSessionSourceSnapshots,
  capturedSessions,
  captureProviders,
  sessionCaptureSyncBatches,
  sessionCaptureSyncEvents,
} from "../../db/schema"
import type {
  CaptureClientPermission,
  CaptureClientRecord,
  CapturedSessionRecord,
  CaptureProviderRecord,
  SessionCaptureStore,
} from "./service"

export function createPostgresSessionCaptureStore(client: DbClient): SessionCaptureStore {
  return {
    createCaptureClient: async (input) => {
      const [record] = await client.db
        .insert(captureClients)
        .values({
          createdByUserId: input.createdByUserId,
          label: input.label,
          permissionJson: JSON.stringify(input.permission),
          tokenHash: input.tokenHash,
          workspaceId: input.workspaceId,
          workspaceSlug: input.workspaceSlug,
        })
        .returning(captureClientSelection)

      if (!record) throw new Error("Capture client insert failed")
      return mapCaptureClient(record)
    },
    createSyncBatch: async (input) => {
      const [record] = await client.db
        .insert(sessionCaptureSyncBatches)
        .values({
          captureClientId: input.captureClientId,
          idempotencyKey: input.idempotencyKey,
          status: input.status,
          workspaceId: input.workspaceId,
          ...(input.capturedSessionId ? { capturedSessionId: input.capturedSessionId } : {}),
          ...(input.parserVersion ? { parserVersion: input.parserVersion } : {}),
          ...(input.providerId ? { providerId: input.providerId } : {}),
        })
        .onConflictDoUpdate({
          target: [
            sessionCaptureSyncBatches.captureClientId,
            sessionCaptureSyncBatches.idempotencyKey,
          ],
          set: {
            capturedSessionId: input.capturedSessionId,
            parserVersion: input.parserVersion,
            providerId: input.providerId,
            status: input.status,
          },
        })
        .returning({ id: sessionCaptureSyncBatches.id })

      if (!record) throw new Error("Sync batch insert failed")
      return record
    },
    ensureCaptureProvider: async (input) => {
      const [record] = await client.db
        .insert(captureProviders)
        .values({
          displayName: input.displayName,
          providerKey: input.providerKey,
        })
        .onConflictDoUpdate({
          target: captureProviders.providerKey,
          set: {
            displayName: input.displayName,
            status: "active",
            updatedAt: new Date(),
          },
        })
        .returning(captureProviderSelection)

      if (!record) throw new Error("Capture provider upsert failed")
      return record
    },
    findActiveCaptureClientByTokenHash: async (tokenHash) => {
      const [record] = await client.db
        .select(captureClientSelection)
        .from(captureClients)
        .where(and(eq(captureClients.tokenHash, tokenHash), eq(captureClients.status, "active")))

      return record ? mapCaptureClient(record) : null
    },
    recordSyncEvent: async (input) => {
      await client.db.insert(sessionCaptureSyncEvents).values({
        artifactCount: input.artifactCount,
        messageCount: input.messageCount,
        status: input.status,
        workspaceId: input.workspaceId,
        ...(input.captureClientId ? { captureClientId: input.captureClientId } : {}),
        ...(input.capturedSessionId ? { capturedSessionId: input.capturedSessionId } : {}),
        ...(input.errorCode ? { errorCode: input.errorCode } : {}),
        ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
        ...(input.providerId ? { providerId: input.providerId } : {}),
        ...(input.syncBatchId ? { syncBatchId: input.syncBatchId } : {}),
      })
    },
    storeSourceSnapshot: async (input) => {
      const [record] = await client.db
        .insert(capturedSessionSourceSnapshots)
        .values({
          capturedSessionId: input.capturedSessionId,
          sourceUrl: input.sourceUrl,
          workspaceId: input.workspaceId,
          ...(input.capturedAt ? { capturedAt: input.capturedAt } : {}),
          ...(input.fileObjectId ? { fileObjectId: input.fileObjectId } : {}),
          ...(input.parserVersion ? { parserVersion: input.parserVersion } : {}),
          ...(input.providerId ? { providerId: input.providerId } : {}),
          ...(input.snapshotJson ? { snapshotJson: input.snapshotJson } : {}),
          ...(input.syncBatchId ? { syncBatchId: input.syncBatchId } : {}),
        })
        .returning({ id: capturedSessionSourceSnapshots.id })

      if (!record) throw new Error("Source snapshot insert failed")
      return record
    },
    touchCaptureClient: async (captureClientId, usedAt) => {
      await client.db
        .update(captureClients)
        .set({ lastUsedAt: usedAt, updatedAt: usedAt })
        .where(eq(captureClients.id, captureClientId))
    },
    upsertCapturedArtifact: async (input) => {
      const [record] = await client.db
        .insert(capturedSessionArtifacts)
        .values({
          artifactKind: input.artifactKind,
          capturedSessionId: input.capturedSessionId,
          sourceArtifactKey: input.sourceArtifactKey,
          workspaceId: input.workspaceId,
          ...(input.capturedMessageId ? { capturedMessageId: input.capturedMessageId } : {}),
          ...(input.contentType ? { contentType: input.contentType } : {}),
          ...(input.fileObjectId ? { fileObjectId: input.fileObjectId } : {}),
          ...(input.metadataJson ? { metadataJson: input.metadataJson } : {}),
          ...(input.sourceArtifactId ? { sourceArtifactId: input.sourceArtifactId } : {}),
          ...(input.title ? { title: input.title } : {}),
        })
        .onConflictDoUpdate({
          target: [
            capturedSessionArtifacts.capturedSessionId,
            capturedSessionArtifacts.sourceArtifactKey,
          ],
          set: {
            artifactKind: input.artifactKind,
            capturedMessageId: input.capturedMessageId,
            contentType: input.contentType,
            fileObjectId: input.fileObjectId,
            metadataJson: input.metadataJson,
            sourceArtifactId: input.sourceArtifactId,
            title: input.title,
            updatedAt: new Date(),
          },
        })
        .returning({ id: capturedSessionArtifacts.id })

      if (!record) throw new Error("Captured artifact upsert failed")
      return record
    },
    upsertCapturedMessage: async (input) => {
      const [record] = await client.db
        .insert(capturedSessionMessages)
        .values({
          capturedSessionId: input.capturedSessionId,
          providerId: input.providerId,
          role: input.role,
          sequenceNumber: input.sequenceNumber,
          sourceFingerprint: input.sourceFingerprint,
          sourceMessageKey: input.sourceMessageKey,
          workspaceId: input.workspaceId,
          ...(input.contentJson ? { contentJson: input.contentJson } : {}),
          ...(input.contentText ? { contentText: input.contentText } : {}),
          ...(input.metadataJson ? { metadataJson: input.metadataJson } : {}),
          ...(input.sourceCreatedAt ? { sourceCreatedAt: input.sourceCreatedAt } : {}),
          ...(input.sourceMessageId ? { sourceMessageId: input.sourceMessageId } : {}),
        })
        .onConflictDoUpdate({
          target: [
            capturedSessionMessages.capturedSessionId,
            capturedSessionMessages.sourceMessageKey,
          ],
          set: {
            contentJson: input.contentJson,
            contentText: input.contentText,
            metadataJson: input.metadataJson,
            role: input.role,
            sequenceNumber: input.sequenceNumber,
            sourceCreatedAt: input.sourceCreatedAt,
            sourceFingerprint: input.sourceFingerprint,
            sourceMessageId: input.sourceMessageId,
            updatedAt: new Date(),
          },
        })
        .returning({ id: capturedSessionMessages.id })

      if (!record) throw new Error("Captured message upsert failed")
      return record
    },
    upsertCapturedSession: async (input) => {
      const [record] = await client.db
        .insert(capturedSessions)
        .values({
          captureClientId: input.captureClientId,
          kind: input.kind,
          lastSyncedAt: input.lastSyncedAt,
          providerId: input.providerId,
          sourceSessionKey: input.sourceSessionKey,
          sourceUrl: input.sourceUrl,
          workspaceId: input.workspaceId,
          workspaceSlug: input.workspaceSlug,
          ...(input.sourceSessionId ? { sourceSessionId: input.sourceSessionId } : {}),
          ...(input.title ? { title: input.title } : {}),
        })
        .onConflictDoUpdate({
          target: [
            capturedSessions.workspaceId,
            capturedSessions.providerId,
            capturedSessions.sourceSessionKey,
          ],
          set: {
            captureClientId: input.captureClientId,
            kind: input.kind,
            lastSyncedAt: input.lastSyncedAt,
            sourceSessionId: input.sourceSessionId,
            sourceUrl: input.sourceUrl,
            title: input.title,
            updatedAt: new Date(),
          },
        })
        .returning(capturedSessionSelection)

      if (!record) throw new Error("Captured session upsert failed")
      return mapCapturedSession(record)
    },
  }
}

const captureProviderSelection = {
  displayName: captureProviders.displayName,
  id: captureProviders.id,
  providerKey: captureProviders.providerKey,
} satisfies Record<keyof CaptureProviderRecord, unknown>

const captureClientSelection = {
  id: captureClients.id,
  label: captureClients.label,
  permissionJson: captureClients.permissionJson,
  status: captureClients.status,
  workspaceId: captureClients.workspaceId,
  workspaceSlug: captureClients.workspaceSlug,
}

const capturedSessionSelection = {
  id: capturedSessions.id,
  sourceSessionKey: capturedSessions.sourceSessionKey,
  title: capturedSessions.title,
}

function mapCaptureClient(row: {
  id: string
  label: string
  permissionJson: string
  status: string
  workspaceId: string
  workspaceSlug: string
}): CaptureClientRecord {
  return {
    id: row.id,
    label: row.label,
    permission: parsePermissions(row.permissionJson),
    status: row.status,
    workspaceId: row.workspaceId,
    workspaceSlug: row.workspaceSlug,
  }
}

function mapCapturedSession(row: {
  id: string
  sourceSessionKey: string
  title: string | null
}): CapturedSessionRecord {
  return {
    id: row.id,
    sourceSessionKey: row.sourceSessionKey,
    ...(row.title ? { title: row.title } : {}),
  }
}

function parsePermissions(permissionJson: string): CaptureClientPermission[] {
  const parsed = JSON.parse(permissionJson) as unknown
  if (!Array.isArray(parsed)) return []
  return parsed.filter(isCaptureClientPermission)
}

function isCaptureClientPermission(value: unknown): value is CaptureClientPermission {
  return value === "session_capture:write" || value === "session_capture:status"
}
