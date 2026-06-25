import { Schema } from "effect"

export const ErrorCodeSchema = Schema.Literal(
  "conflict",
  "forbidden",
  "internal_error",
  "invalid_request",
  "not_found",
  "unauthenticated",
  "invariant_violation",
)

export type ErrorCode = typeof ErrorCodeSchema.Type

export const ErrorEnvelopeSchema = Schema.Struct({
  error: Schema.Struct({
    code: ErrorCodeSchema,
    details: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    message: Schema.String,
  }),
  ok: Schema.Literal(false),
})

export type ErrorEnvelope = typeof ErrorEnvelopeSchema.Type
