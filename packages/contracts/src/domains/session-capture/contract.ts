import { Schema } from "effect"

import { type SuccessEnvelope, SuccessEnvelopeSchema } from "../../shared/envelopes.js"

export const CaptureClientPermissionSchema = Schema.Literal(
  "session_capture:write",
  "session_capture:status",
)
export type CaptureClientPermission = typeof CaptureClientPermissionSchema.Type

export const CaptureClientDtoSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  permission: Schema.Array(CaptureClientPermissionSchema),
  status: Schema.String,
  workspaceId: Schema.String,
  workspaceSlug: Schema.String,
})
export type CaptureClientDto = typeof CaptureClientDtoSchema.Type

export const CaptureClientPairBodySchema = Schema.Struct({
  label: Schema.String,
})
export type CaptureClientPairBody = typeof CaptureClientPairBodySchema.Type

export const CaptureClientPairResultSchema = Schema.Struct({
  client: CaptureClientDtoSchema,
  rawToken: Schema.String,
})
export type CaptureClientPairResult = typeof CaptureClientPairResultSchema.Type

export const CaptureClientPairResponseSchema = SuccessEnvelopeSchema(CaptureClientPairResultSchema)
export type CaptureClientPairResponse = SuccessEnvelope<CaptureClientPairResult>

export const SessionCaptureProviderInputSchema = Schema.Struct({
  displayName: Schema.String,
  providerKey: Schema.String,
})
export type SessionCaptureProviderInput = typeof SessionCaptureProviderInputSchema.Type

export const CapturedSessionKindSchema = Schema.Literal("chat", "coding", "agent_run", "unknown")
export type CapturedSessionKind = typeof CapturedSessionKindSchema.Type

export const SessionCaptureSessionInputSchema = Schema.Struct({
  kind: CapturedSessionKindSchema,
  sourceSessionId: Schema.optional(Schema.String),
  sourceSessionKey: Schema.optional(Schema.String),
  sourceUrl: Schema.String,
  title: Schema.optional(Schema.String),
  workspaceId: Schema.optional(Schema.String),
})
export type SessionCaptureSessionInput = typeof SessionCaptureSessionInputSchema.Type

export const CapturedMessageRoleSchema = Schema.Literal(
  "user",
  "assistant",
  "system",
  "tool",
  "unknown",
)
export type CapturedMessageRole = typeof CapturedMessageRoleSchema.Type

export const SessionCaptureMessageInputSchema = Schema.Struct({
  contentJson: Schema.optional(Schema.String),
  contentText: Schema.optional(Schema.String),
  metadataJson: Schema.optional(Schema.String),
  role: CapturedMessageRoleSchema,
  sequenceNumber: Schema.String,
  sourceCreatedAt: Schema.optional(Schema.String),
  sourceFingerprint: Schema.optional(Schema.String),
  sourceMessageId: Schema.optional(Schema.String),
  sourceMessageKey: Schema.optional(Schema.String),
})
export type SessionCaptureMessageInput = typeof SessionCaptureMessageInputSchema.Type

export const CapturedArtifactKindSchema = Schema.Literal(
  "code",
  "file",
  "image",
  "link",
  "attachment",
  "unknown",
)
export type CapturedArtifactKind = typeof CapturedArtifactKindSchema.Type

export const SessionCaptureArtifactInputSchema = Schema.Struct({
  artifactKind: CapturedArtifactKindSchema,
  capturedMessageId: Schema.optional(Schema.String),
  contentType: Schema.optional(Schema.String),
  fileObjectId: Schema.optional(Schema.String),
  metadataJson: Schema.optional(Schema.String),
  sourceArtifactId: Schema.optional(Schema.String),
  sourceArtifactKey: Schema.optional(Schema.String),
  title: Schema.optional(Schema.String),
})
export type SessionCaptureArtifactInput = typeof SessionCaptureArtifactInputSchema.Type

export const SessionCaptureSourceSnapshotInputSchema = Schema.Struct({
  capturedAt: Schema.optional(Schema.String),
  fileObjectId: Schema.optional(Schema.String),
  snapshotJson: Schema.optional(Schema.String),
  sourceUrl: Schema.optional(Schema.String),
})
export type SessionCaptureSourceSnapshotInput = typeof SessionCaptureSourceSnapshotInputSchema.Type

export const SessionCaptureManualSyncBodySchema = Schema.Struct({
  artifacts: Schema.optional(Schema.Array(SessionCaptureArtifactInputSchema)),
  idempotencyKey: Schema.optional(Schema.String),
  messages: Schema.optional(Schema.Array(SessionCaptureMessageInputSchema)),
  parserVersion: Schema.optional(Schema.String),
  provider: SessionCaptureProviderInputSchema,
  session: SessionCaptureSessionInputSchema,
  sourceSnapshot: Schema.optional(SessionCaptureSourceSnapshotInputSchema),
})
export type SessionCaptureManualSyncBody = typeof SessionCaptureManualSyncBodySchema.Type

export const SessionCaptureManualSyncResultSchema = Schema.Struct({
  artifactCount: Schema.Number,
  capturedSessionId: Schema.String,
  messageCount: Schema.Number,
  syncBatchId: Schema.optional(Schema.String),
  syncStatus: Schema.Literal("accepted"),
})
export type SessionCaptureManualSyncResult = typeof SessionCaptureManualSyncResultSchema.Type

export const SessionCaptureManualSyncResponseSchema = SuccessEnvelopeSchema(
  SessionCaptureManualSyncResultSchema,
)
export type SessionCaptureManualSyncResponse = SuccessEnvelope<SessionCaptureManualSyncResult>
