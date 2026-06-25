import { describe, expect, test } from "vitest"

import { schema } from "./schema"

describe("app Zero schema relationships", () => {
  test("defines workspace member and avatar file relationships", () => {
    expect(schema.relationships.workspaceMemberships.user).toMatchObject([
      {
        cardinality: "one",
        destField: ["id"],
        destSchema: "users",
        sourceField: ["principalId"],
      },
    ])
    expect(schema.relationships.users.avatarFileObject).toMatchObject([
      {
        cardinality: "one",
        destField: ["id"],
        destSchema: "fileObjects",
        sourceField: ["avatarFileObjectId"],
      },
    ])
  })

  test("does not define copied or removed product relationships", () => {
    expect(schema.relationships).not.toHaveProperty("businesses")
    expect(schema.relationships).not.toHaveProperty("tasks")
    expect(schema.relationships).not.toHaveProperty("contacts")
    expect(schema.relationships).not.toHaveProperty("organizations")
    expect(schema.relationships).not.toHaveProperty("goals")
    expect(schema.relationships).not.toHaveProperty("waAccounts")
  })
})
