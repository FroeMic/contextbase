import { Schema } from "effect"

import {
  type ListEnvelope,
  ListEnvelopeSchema,
  type SuccessEnvelope,
  SuccessEnvelopeSchema,
} from "../../shared/envelopes.js"

const IsoDateStringSchema = Schema.String

export const WorkspaceInvitationRoleSchema = Schema.Literal("workspace_admin", "workspace_member")

export type WorkspaceInvitationRole = typeof WorkspaceInvitationRoleSchema.Type

export const WorkspaceInvitationDtoSchema = Schema.Struct({
  acceptedAt: Schema.NullOr(IsoDateStringSchema),
  email: Schema.String,
  emailNormalized: Schema.String,
  expiresAt: IsoDateStringSchema,
  id: Schema.String,
  invitedByUserId: Schema.String,
  revokedAt: Schema.NullOr(IsoDateStringSchema),
  role: WorkspaceInvitationRoleSchema,
  status: Schema.String,
  workspaceId: Schema.String,
  workspaceSlug: Schema.String,
})

export type WorkspaceInvitationDto = typeof WorkspaceInvitationDtoSchema.Type

export const WorkspaceInvitationCreateBodySchema = Schema.Struct({
  email: Schema.String,
  role: Schema.optional(WorkspaceInvitationRoleSchema),
})

export type WorkspaceInvitationCreateBody = typeof WorkspaceInvitationCreateBodySchema.Type

export const WorkspaceInvitationIdParamsSchema = Schema.Struct({
  invitationId: Schema.String,
})

export type WorkspaceInvitationIdParams = typeof WorkspaceInvitationIdParamsSchema.Type

export const WorkspaceInvitationListResponseSchema = ListEnvelopeSchema(
  WorkspaceInvitationDtoSchema,
)
export type WorkspaceInvitationListResponse = ListEnvelope<WorkspaceInvitationDto>

export const WorkspaceInvitationResponseSchema = SuccessEnvelopeSchema(WorkspaceInvitationDtoSchema)
export type WorkspaceInvitationResponse = SuccessEnvelope<WorkspaceInvitationDto>
