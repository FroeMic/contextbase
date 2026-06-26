import { createHash, randomBytes } from "node:crypto"

import { Effect } from "effect"

import {
  AuthenticationError,
  ForbiddenError,
  InternalError,
  InvalidRequestError,
} from "../../shared/errors"
import type { AuthenticatedContext } from "../auth/authenticate"
import { canAdministerWorkspace } from "../auth/authorization"
import { hashApiToken } from "../auth/bootstrap"

export type CaptureClientPermission = "session_capture:write" | "session_capture:status"

export type CaptureClientRecord = {
  id: string
  label: string
  permission: CaptureClientPermission[]
  status: string
  workspaceId: string
  workspaceSlug: string
}

export type CaptureClientAuthContext = {
  authKind: "capture_client"
  captureClientId: string
  permissions: CaptureClientPermission[]
  principalId: string
  principalKind: "capture_client"
  role: "capture_client"
  workspaceId: string
  workspaceSlug: string
}

export type CaptureProviderRecord = {
  displayName: string
  id: string
  providerKey: string
}

export type CapturedSessionRecord = {
  id: string
  sourceSessionKey: string
  title?: string
}

export type SessionCaptureStore = {
  createCaptureClient?: (input: {
    createdByUserId: string
    label: string
    permission: CaptureClientPermission[]
    tokenHash: string
    workspaceId: string
    workspaceSlug: string
  }) => Promise<CaptureClientRecord>
  createSyncBatch?: (input: {
    artifactCount: number
    captureClientId: string
    capturedSessionId?: string
    idempotencyKey: string
    messageCount: number
    parserVersion?: string
    providerId?: string
    status: "accepted" | "failed" | "rejected"
    workspaceId: string
  }) => Promise<{ id: string }>
  ensureCaptureProvider?: (input: {
    displayName: string
    providerKey: string
  }) => Promise<CaptureProviderRecord>
  findActiveCaptureClientByTokenHash: (tokenHash: string) => Promise<CaptureClientRecord | null>
  recordSyncEvent?: (input: {
    artifactCount: number
    captureClientId: string
    capturedSessionId?: string
    errorCode?: string
    errorMessage?: string
    messageCount: number
    providerId?: string
    status: "accepted" | "failed" | "rejected"
    syncBatchId?: string
    workspaceId: string
  }) => Promise<void>
  storeSourceSnapshot?: (input: {
    capturedAt?: Date
    capturedSessionId: string
    fileObjectId?: string
    parserVersion?: string
    providerId?: string
    snapshotJson?: string
    sourceUrl: string
    syncBatchId?: string
    workspaceId: string
  }) => Promise<{ id: string }>
  touchCaptureClient?: (captureClientId: string, usedAt: Date) => Promise<void>
  upsertCapturedArtifact?: (input: NormalizedArtifactInput) => Promise<{ id: string }>
  upsertCapturedMessage?: (input: NormalizedMessageInput) => Promise<{ id: string }>
  upsertCapturedSession?: (input: NormalizedSessionInput) => Promise<CapturedSessionRecord>
}

export type ManualSyncBatchInput = {
  artifacts?: ManualSyncArtifactInput[]
  idempotencyKey?: string
  messages?: ManualSyncMessageInput[]
  observation?: ManualSyncObservationInput
  parserVersion?: string
  provider: {
    displayName: string
    providerKey: string
  }
  session: {
    kind: "chat" | "coding" | "agent_run" | "unknown"
    sourceSessionId?: string
    sourceSessionKey?: string
    sourceUrl: string
    title?: string
    workspaceId?: string
  }
  sourceSnapshot?: {
    capturedAt?: Date
    fileObjectId?: string
    snapshotJson?: string
    sourceUrl?: string
  }
}

export type ManualSyncObservationInput = {
  latestBoundarySeen?: boolean
  latestObservedMessageKey?: string
  observationReason: "initial_load" | "mutation" | "scroll" | "manual_force" | "retry"
  observedAt?: Date
  observedMessageKeys?: string[]
  oldestBoundarySeen?: boolean
  oldestObservedMessageKey?: string
  syncMode: "manual" | "automatic"
  visibleMessageCount?: number
}

export type ManualSyncMessageInput = {
  contentJson?: string
  contentText?: string
  metadataJson?: string
  role: "user" | "assistant" | "system" | "tool" | "unknown"
  sequenceNumber: string
  sourceCreatedAt?: Date
  sourceFingerprint?: string
  sourceMessageId?: string
  sourceMessageKey?: string
}

export type ManualSyncArtifactInput = {
  artifactKind: "code" | "file" | "image" | "link" | "attachment" | "unknown"
  capturedMessageId?: string
  capturedMessageSourceKey?: string
  contentType?: string
  fileObjectId?: string
  metadataJson?: string
  sourceArtifactId?: string
  sourceArtifactKey?: string
  title?: string
}

type CaptureClientLike = CaptureClientRecord | CaptureClientAuthContext

export type NormalizedSessionInput = {
  captureClientId: string
  firstCapturedAt?: Date
  kind: ManualSyncBatchInput["session"]["kind"]
  lastSyncedAt: Date
  metadataJson?: string
  providerId: string
  sourceSessionId?: string
  sourceSessionKey: string
  sourceUrl: string
  title?: string
  workspaceId: string
  workspaceSlug: string
}

export type NormalizedMessageInput = {
  capturedSessionId: string
  contentJson?: string
  contentText?: string
  metadataJson?: string
  providerId: string
  role: ManualSyncMessageInput["role"]
  sequenceNumber: string
  sourceCreatedAt?: Date
  sourceFingerprint: string
  sourceMessageId?: string
  sourceMessageKey: string
  workspaceId: string
}

export type NormalizedArtifactInput = {
  artifactKind: ManualSyncArtifactInput["artifactKind"]
  capturedMessageId?: string
  capturedSessionId: string
  contentType?: string
  fileObjectId?: string
  metadataJson?: string
  sourceArtifactId?: string
  sourceArtifactKey: string
  title?: string
  workspaceId: string
}

export function createWorkspaceCaptureClient(
  store: SessionCaptureStore,
  context: AuthenticatedContext,
  input: { label: string; randomToken?: () => string },
): Effect.Effect<
  { client: CaptureClientRecord; rawToken: string },
  ForbiddenError | InternalError | InvalidRequestError
> {
  return Effect.tryPromise({
    try: async () => {
      if (!canAdministerWorkspace(context)) {
        throw new ForbiddenError({
          code: "forbidden",
          message: "Workspace admin access is required to pair capture clients",
        })
      }
      if (!store.createCaptureClient) {
        throw new Error("Session capture store cannot create capture clients")
      }

      const label = input.label.trim()
      if (!label) {
        throw new InvalidRequestError({
          code: "invalid_request",
          message: "Capture client label is required",
        })
      }

      const rawToken = input.randomToken?.() ?? createCaptureClientToken()
      const permission: CaptureClientPermission[] = [
        "session_capture:write",
        "session_capture:status",
      ]
      const client = await store.createCaptureClient({
        createdByUserId: context.principalId,
        label,
        permission,
        tokenHash: hashCaptureClientToken(rawToken),
        workspaceId: context.workspaceId,
        workspaceSlug: context.workspaceSlug,
      })

      return { client, rawToken }
    },
    catch: preserveCaptureError("Failed to create capture client"),
  })
}

export function authenticateCaptureClient(
  store: SessionCaptureStore,
  rawToken: string,
): Effect.Effect<CaptureClientAuthContext, AuthenticationError | ForbiddenError | InternalError> {
  return Effect.tryPromise({
    try: async () => {
      const client = await store.findActiveCaptureClientByTokenHash(
        hashCaptureClientToken(rawToken),
      )
      if (!client) {
        throw new AuthenticationError({
          code: "unauthenticated",
          message: "Invalid capture client token",
        })
      }
      if (!client.permission.includes("session_capture:write")) {
        throw new ForbiddenError({
          code: "forbidden",
          message: "Capture client is missing session capture write permission",
        })
      }

      await store.touchCaptureClient?.(client.id, new Date())

      return {
        authKind: "capture_client" as const,
        captureClientId: client.id,
        permissions: client.permission,
        principalId: client.id,
        principalKind: "capture_client" as const,
        role: "capture_client" as const,
        workspaceId: client.workspaceId,
        workspaceSlug: client.workspaceSlug,
      }
    },
    catch: preserveAuthError("Failed to authenticate capture client"),
  })
}

export function ingestManualSyncBatch(
  store: SessionCaptureStore,
  captureClient: CaptureClientLike,
  input: ManualSyncBatchInput,
): Effect.Effect<
  {
    artifactCount: number
    capturedSessionId: string
    messageCount: number
    syncBatchId?: string
    syncStatus: "accepted"
  },
  ForbiddenError | InternalError | InvalidRequestError
> {
  return Effect.tryPromise({
    try: async () => {
      const clientId = captureClientId(captureClient)
      const permissions = captureClientPermissions(captureClient)
      if (!permissions.includes("session_capture:write")) {
        throw new ForbiddenError({
          code: "forbidden",
          message: "Capture client is missing session capture write permission",
        })
      }
      if (input.session.workspaceId && input.session.workspaceId !== captureClient.workspaceId) {
        throw new ForbiddenError({
          code: "forbidden",
          details: {
            requestedWorkspaceId: input.session.workspaceId,
            workspaceId: captureClient.workspaceId,
          },
          message: "Capture client cannot write to another workspace",
        })
      }

      const now = new Date()
      const provider = await required(
        store.ensureCaptureProvider,
        "ensure capture provider",
      )({
        displayName: input.provider.displayName,
        providerKey: input.provider.providerKey,
      })
      const sourceSessionKey = normalizeSourceKey(
        input.session.sourceSessionKey,
        input.session.sourceSessionId,
        input.provider.providerKey,
        input.session.sourceUrl,
      )
      const messageCount = input.messages?.length ?? 0
      const artifactCount = input.artifacts?.length ?? 0
      const session = await required(
        store.upsertCapturedSession,
        "upsert captured session",
      )({
        captureClientId: clientId,
        kind: input.session.kind,
        lastSyncedAt: now,
        providerId: provider.id,
        sourceSessionKey,
        sourceUrl: input.session.sourceUrl,
        workspaceId: captureClient.workspaceId,
        workspaceSlug: captureClient.workspaceSlug,
        ...(input.observation ? { metadataJson: observationMetadataJson(input.observation) } : {}),
        ...(input.session.sourceSessionId
          ? { sourceSessionId: input.session.sourceSessionId }
          : {}),
        ...(input.session.title ? { title: input.session.title } : {}),
      })
      const syncBatch = await store.createSyncBatch?.({
        captureClientId: clientId,
        capturedSessionId: session.id,
        idempotencyKey:
          input.idempotencyKey ??
          stableHash([
            captureClient.workspaceId,
            provider.providerKey,
            sourceSessionKey,
            now.toISOString(),
          ]),
        artifactCount,
        messageCount,
        providerId: provider.id,
        status: "accepted",
        workspaceId: captureClient.workspaceId,
        ...(input.parserVersion ? { parserVersion: input.parserVersion } : {}),
      })

      const capturedMessageIdsBySourceKey = new Map<string, string>()
      for (const message of input.messages ?? []) {
        const sourceMessageKey = normalizeSourceKey(
          message.sourceMessageKey,
          message.sourceMessageId,
          message.role,
          message.sequenceNumber,
          message.contentText ?? message.contentJson ?? "",
        )
        const capturedMessage = await required(
          store.upsertCapturedMessage,
          "upsert captured message",
        )({
          capturedSessionId: session.id,
          providerId: provider.id,
          role: message.role,
          sequenceNumber: message.sequenceNumber,
          sourceFingerprint:
            message.sourceFingerprint ??
            stableHash([
              message.role,
              message.sequenceNumber,
              message.contentText ?? "",
              message.contentJson ?? "",
            ]),
          sourceMessageKey,
          workspaceId: captureClient.workspaceId,
          ...(message.contentJson ? { contentJson: message.contentJson } : {}),
          ...(message.contentText ? { contentText: message.contentText } : {}),
          ...(message.metadataJson ? { metadataJson: message.metadataJson } : {}),
          ...(message.sourceCreatedAt ? { sourceCreatedAt: message.sourceCreatedAt } : {}),
          ...(message.sourceMessageId ? { sourceMessageId: message.sourceMessageId } : {}),
        })
        capturedMessageIdsBySourceKey.set(sourceMessageKey, capturedMessage.id)
      }

      for (const artifact of input.artifacts ?? []) {
        const capturedMessageId =
          artifact.capturedMessageId ??
          (artifact.capturedMessageSourceKey
            ? capturedMessageIdsBySourceKey.get(artifact.capturedMessageSourceKey)
            : undefined)
        await store.upsertCapturedArtifact?.({
          artifactKind: artifact.artifactKind,
          capturedSessionId: session.id,
          sourceArtifactKey: normalizeSourceKey(
            artifact.sourceArtifactKey,
            artifact.sourceArtifactId,
            artifact.artifactKind,
            artifact.title ?? "",
          ),
          workspaceId: captureClient.workspaceId,
          ...(capturedMessageId ? { capturedMessageId } : {}),
          ...(artifact.contentType ? { contentType: artifact.contentType } : {}),
          ...(artifact.fileObjectId ? { fileObjectId: artifact.fileObjectId } : {}),
          ...(artifact.metadataJson ? { metadataJson: artifact.metadataJson } : {}),
          ...(artifact.sourceArtifactId ? { sourceArtifactId: artifact.sourceArtifactId } : {}),
          ...(artifact.title ? { title: artifact.title } : {}),
        })
      }

      if (input.sourceSnapshot) {
        await store.storeSourceSnapshot?.({
          capturedSessionId: session.id,
          providerId: provider.id,
          sourceUrl: input.sourceSnapshot.sourceUrl ?? input.session.sourceUrl,
          workspaceId: captureClient.workspaceId,
          ...(input.sourceSnapshot.capturedAt
            ? { capturedAt: input.sourceSnapshot.capturedAt }
            : {}),
          ...(input.sourceSnapshot.fileObjectId
            ? { fileObjectId: input.sourceSnapshot.fileObjectId }
            : {}),
          ...(input.parserVersion ? { parserVersion: input.parserVersion } : {}),
          ...(input.sourceSnapshot.snapshotJson
            ? { snapshotJson: input.sourceSnapshot.snapshotJson }
            : {}),
          ...(syncBatch?.id ? { syncBatchId: syncBatch.id } : {}),
        })
      }

      await store.recordSyncEvent?.({
        artifactCount,
        captureClientId: clientId,
        capturedSessionId: session.id,
        messageCount,
        providerId: provider.id,
        status: "accepted",
        workspaceId: captureClient.workspaceId,
        ...(syncBatch?.id ? { syncBatchId: syncBatch.id } : {}),
      })

      return {
        artifactCount,
        capturedSessionId: session.id,
        messageCount,
        syncStatus: "accepted" as const,
        ...(syncBatch?.id ? { syncBatchId: syncBatch.id } : {}),
      }
    },
    catch: preserveCaptureError("Failed to ingest manual sync batch"),
  })
}

function observationMetadataJson(observation: ManualSyncObservationInput) {
  return JSON.stringify({
    sessionCaptureObservation: {
      observationReason: observation.observationReason,
      syncMode: observation.syncMode,
      ...(observation.latestBoundarySeen !== undefined
        ? { latestBoundarySeen: observation.latestBoundarySeen }
        : {}),
      ...(observation.latestObservedMessageKey
        ? { latestObservedMessageKey: observation.latestObservedMessageKey }
        : {}),
      ...(observation.observedAt ? { observedAt: observation.observedAt.toISOString() } : {}),
      ...(observation.observedMessageKeys
        ? { observedMessageKeys: observation.observedMessageKeys }
        : {}),
      ...(observation.oldestBoundarySeen !== undefined
        ? { oldestBoundarySeen: observation.oldestBoundarySeen }
        : {}),
      ...(observation.oldestObservedMessageKey
        ? { oldestObservedMessageKey: observation.oldestObservedMessageKey }
        : {}),
      ...(observation.visibleMessageCount !== undefined
        ? { visibleMessageCount: observation.visibleMessageCount }
        : {}),
    },
  })
}

function captureClientId(captureClient: CaptureClientLike) {
  return "captureClientId" in captureClient ? captureClient.captureClientId : captureClient.id
}

function captureClientPermissions(captureClient: CaptureClientLike) {
  return "permissions" in captureClient ? captureClient.permissions : captureClient.permission
}

export function createCaptureClientToken() {
  return `cbc_${randomBytes(32).toString("base64url")}`
}

export function hashCaptureClientToken(token: string) {
  return hashApiToken(token)
}

function normalizeSourceKey(...parts: Array<string | undefined>) {
  const existing = parts.find((part) => part && part.trim().length > 0)
  if (existing) return existing
  return stableHash(parts.map((part) => part ?? ""))
}

function stableHash(parts: readonly string[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex")
}

function required<T>(fn: T | undefined, label: string): T {
  if (!fn) throw new Error(`Session capture store cannot ${label}`)
  return fn
}

function preserveCaptureError(message: string) {
  return (cause: unknown) => {
    if (
      cause instanceof ForbiddenError ||
      cause instanceof InternalError ||
      cause instanceof InvalidRequestError
    ) {
      return cause
    }
    return new InternalError({
      code: "internal_error",
      details: { cause: String(cause) },
      message,
    })
  }
}

function preserveAuthError(message: string) {
  return (cause: unknown) => {
    if (
      cause instanceof AuthenticationError ||
      cause instanceof ForbiddenError ||
      cause instanceof InternalError
    ) {
      return cause
    }
    return new InternalError({
      code: "internal_error",
      details: { cause: String(cause) },
      message,
    })
  }
}
