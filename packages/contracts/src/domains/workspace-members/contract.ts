import { Schema } from "effect"

import {
  type ListEnvelope,
  ListEnvelopeSchema,
  type SuccessEnvelope,
  SuccessEnvelopeSchema,
} from "../../shared/envelopes.js"

export const WorkspaceMemberRoleSchema = Schema.Literal("workspace_admin", "workspace_member")

export const WorkspaceMemberDtoSchema = Schema.Struct({
  displayName: Schema.NullOr(Schema.String),
  email: Schema.NullOr(Schema.String),
  id: Schema.String,
  principalId: Schema.String,
  principalKind: Schema.String,
  role: Schema.String,
  status: Schema.String,
  workspaceId: Schema.String,
  workspaceSlug: Schema.String,
})

export type WorkspaceMemberDto = typeof WorkspaceMemberDtoSchema.Type

export const WorkspaceMemberUpdateBodySchema = Schema.Struct({
  role: WorkspaceMemberRoleSchema,
})

export type WorkspaceMemberUpdateBody = typeof WorkspaceMemberUpdateBodySchema.Type

export const WorkspaceMemberIdParamsSchema = Schema.Struct({
  membershipId: Schema.String,
})

export type WorkspaceMemberIdParams = typeof WorkspaceMemberIdParamsSchema.Type

export const WorkspaceMemberListResponseSchema = ListEnvelopeSchema(WorkspaceMemberDtoSchema)
export type WorkspaceMemberListResponse = ListEnvelope<WorkspaceMemberDto>

export const WorkspaceMemberResponseSchema = SuccessEnvelopeSchema(WorkspaceMemberDtoSchema)
export type WorkspaceMemberResponse = SuccessEnvelope<WorkspaceMemberDto>
