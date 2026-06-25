import { Schema } from "effect"

export const CliCommandOptionTypeSchema = Schema.Literal(
  "boolean",
  "date",
  "enum",
  "json",
  "number",
  "string",
)

export const CliCommandMetadataSchema = Schema.Struct({
  arguments: Schema.Array(
    Schema.Struct({
      description: Schema.String,
      name: Schema.String,
      required: Schema.Boolean,
    }),
  ),
  description: Schema.String,
  examples: Schema.Array(Schema.String),
  id: Schema.String,
  options: Schema.Array(
    Schema.Struct({
      description: Schema.String,
      name: Schema.String,
      repeatable: Schema.Boolean,
      required: Schema.Boolean,
      type: CliCommandOptionTypeSchema,
      values: Schema.optional(Schema.Array(Schema.String)),
    }),
  ),
  output: Schema.Struct({
    dryRun: Schema.Boolean,
    json: Schema.Boolean,
  }),
  path: Schema.Array(Schema.String),
  summary: Schema.String,
})

export type CliCommandMetadata = typeof CliCommandMetadataSchema.Type
