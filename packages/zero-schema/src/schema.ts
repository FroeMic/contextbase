import { createBuilder, type Schema as ZeroSchema } from "@rocicorp/zero"

import { schema as generatedSchema } from "./generated-schema"

const usersRelationships = {
  avatarFileObject: one(["avatarFileObjectId"], "fileObjects", ["id"]),
} as const

const workspaceMembershipsRelationships = {
  user: one(["principalId"], "users", ["id"]),
} as const

export const schema = {
  ...generatedSchema,
  relationships: {
    ...generatedSchema.relationships,
    users: usersRelationships,
    workspaceMemberships: workspaceMembershipsRelationships,
  },
} as const satisfies ZeroSchema

export type Schema = typeof schema

export const zql = createBuilder(schema)
export const builder = zql

function one<TSourceField extends string, TDestSchema extends string, TDestField extends string>(
  sourceField: readonly TSourceField[],
  destSchema: TDestSchema,
  destField: readonly TDestField[],
) {
  return [{ cardinality: "one", destField, destSchema, sourceField }] as const
}
