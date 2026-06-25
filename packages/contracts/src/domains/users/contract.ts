import { Schema } from "effect"

import {
  type ListEnvelope,
  ListEnvelopeSchema,
  type SuccessEnvelope,
  SuccessEnvelopeSchema,
} from "../../shared/envelopes.js"

const NullableStringSchema = Schema.NullOr(Schema.String)
const IsoDateStringSchema = Schema.String

export const UserDtoSchema = Schema.Struct({
  displayName: Schema.String,
  email: NullableStringSchema,
  emailNormalized: NullableStringSchema,
  emailVerifiedAt: Schema.NullOr(IsoDateStringSchema),
  id: Schema.String,
  lastLoginAt: Schema.NullOr(IsoDateStringSchema),
  primaryChannelKind: NullableStringSchema,
  primaryChannelRef: NullableStringSchema,
  status: Schema.String,
})

export type UserDto = typeof UserDtoSchema.Type

export const UserCreateBodySchema = Schema.Struct({
  displayName: Schema.String,
  email: Schema.optional(NullableStringSchema),
  primaryChannelKind: Schema.optional(NullableStringSchema),
  primaryChannelRef: Schema.optional(NullableStringSchema),
  role: Schema.optional(Schema.String),
})

export type UserCreateBody = typeof UserCreateBodySchema.Type

export const UserUpdateBodySchema = Schema.Struct({
  displayName: Schema.optional(Schema.String),
  email: Schema.optional(NullableStringSchema),
  primaryChannelKind: Schema.optional(NullableStringSchema),
  primaryChannelRef: Schema.optional(NullableStringSchema),
  status: Schema.optional(Schema.String),
})

export type UserUpdateBody = typeof UserUpdateBodySchema.Type

export const UserIdParamsSchema = Schema.Struct({
  userId: Schema.String,
})

export type UserIdParams = typeof UserIdParamsSchema.Type

export const UserListQuerySchema = Schema.Struct({})
export type UserListQuery = typeof UserListQuerySchema.Type

export const UserListResponseSchema = ListEnvelopeSchema(UserDtoSchema)
export type UserListResponse = ListEnvelope<UserDto>

export const UserResponseSchema = SuccessEnvelopeSchema(UserDtoSchema)
export type UserResponse = SuccessEnvelope<UserDto>
