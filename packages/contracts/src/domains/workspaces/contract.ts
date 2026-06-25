import { Schema } from "effect"

import {
  type ListEnvelope,
  ListEnvelopeSchema,
  type SuccessEnvelope,
  SuccessEnvelopeSchema,
} from "../../shared/envelopes.js"

export const WorkspaceDtoSchema = Schema.Struct({
  id: Schema.String,
  status: Schema.Literal("active", "archived", "suspended"),
  workspaceName: Schema.String,
  workspaceSlug: Schema.String,
})

export type WorkspaceDto = typeof WorkspaceDtoSchema.Type

export const WorkspaceCreateBodySchema = Schema.Struct({
  workspaceName: Schema.String,
  workspaceSlug: Schema.String,
})

export type WorkspaceCreateBody = typeof WorkspaceCreateBodySchema.Type

export const WorkspaceUpdateBodySchema = Schema.Struct({
  workspaceName: Schema.optional(Schema.String),
})

export type WorkspaceUpdateBody = typeof WorkspaceUpdateBodySchema.Type

export const WorkspaceRenameSlugBodySchema = Schema.Struct({
  newSlug: Schema.String,
})

export type WorkspaceRenameSlugBody = typeof WorkspaceRenameSlugBodySchema.Type

export const WorkspaceIdOrSlugParamsSchema = Schema.Struct({
  workspaceIdOrSlug: Schema.String,
})

export type WorkspaceIdOrSlugParams = typeof WorkspaceIdOrSlugParamsSchema.Type

export const WorkspaceListQuerySchema = Schema.Struct({})
export type WorkspaceListQuery = typeof WorkspaceListQuerySchema.Type

export const WorkspaceListResponseSchema = ListEnvelopeSchema(WorkspaceDtoSchema)
export type WorkspaceListResponse = ListEnvelope<WorkspaceDto>

export const WorkspaceResponseSchema = SuccessEnvelopeSchema(WorkspaceDtoSchema)
export type WorkspaceResponse = SuccessEnvelope<WorkspaceDto>
