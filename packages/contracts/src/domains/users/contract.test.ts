import { Schema } from "effect"
import { describe, expect, test } from "vitest"

import { UserCreateBodySchema, UserListResponseSchema, UserUpdateBodySchema } from "./contract.js"

describe("user boundary contracts", () => {
  test("decodes user bodies and list envelopes", () => {
    const create = Schema.decodeUnknownSync(UserCreateBodySchema)({
      displayName: "Michael",
      email: "m@example.com",
    })
    const update = Schema.decodeUnknownSync(UserUpdateBodySchema)({
      displayName: "New Name",
      status: "active",
    })
    const list = Schema.decodeUnknownSync(UserListResponseSchema)({
      data: [
        {
          displayName: "Michael",
          email: "m@example.com",
          emailNormalized: "m@example.com",
          emailVerifiedAt: null,
          id: "usr_123",
          lastLoginAt: null,
          primaryChannelKind: null,
          primaryChannelRef: null,
          status: "active",
        },
      ],
      ok: true,
      page: { next_cursor: null },
    })

    expect(create.email).toBe("m@example.com")
    expect(update.displayName).toBe("New Name")
    expect(list.data[0]?.id).toBe("usr_123")
  })
})
