import { Schema } from "effect"

export const SuccessEnvelopeSchema = <A, I, R>(data: Schema.Schema<A, I, R>) =>
  Schema.Struct({
    data,
    ok: Schema.Literal(true),
  })

export type SuccessEnvelope<TData> = {
  data: TData
  ok: true
}

export const ListPageSchema = Schema.Struct({
  next_cursor: Schema.NullOr(Schema.String),
})

export type ListPage = typeof ListPageSchema.Type

export const ListEnvelopeSchema = <A, I, R>(data: Schema.Schema<A, I, R>) =>
  Schema.Struct({
    data: Schema.Array(data),
    ok: Schema.Literal(true),
    page: ListPageSchema,
  })

export type ListEnvelope<TData> = {
  data: TData[]
  ok: true
  page: ListPage
}
