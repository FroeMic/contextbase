import { Buffer } from "node:buffer"

import { Schema } from "effect"

export const DEFAULT_LIST_LIMIT = 50
export const MAX_LIST_LIMIT = 100

export const CursorSchema = Schema.String

export const LimitSchema = Schema.Number.pipe(Schema.int(), Schema.between(1, MAX_LIST_LIMIT))

export const SortDirectionSchema = Schema.Literal("asc", "desc")
export type SortDirection = typeof SortDirectionSchema.Type

export const CursorPayloadSchema = Schema.Struct({
  direction: SortDirectionSchema,
  id: Schema.String,
  sort: Schema.String,
  value: Schema.Unknown,
  version: Schema.Literal(1),
})

export type CursorPayload = typeof CursorPayloadSchema.Type

export function encodeCursor(payload: CursorPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
}

export function decodeCursor(cursor: string): CursorPayload {
  return Schema.decodeUnknownSync(CursorPayloadSchema)(
    JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown,
  )
}
