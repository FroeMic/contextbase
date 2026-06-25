import type {
  UserCreateBody,
  UserListResponse,
  UserResponse,
  UserUpdateBody,
} from "@contextbase/contracts"
import { describe, expect, expectTypeOf, test } from "vitest"

import { createApiClient } from "../client"
import { createUserClient } from "./users"

describe("user api client", () => {
  test("exposes user contract envelope types", () => {
    const client = createUserClient(createApiClient({ baseUrl: "http://local.test" }))

    expectTypeOf<Parameters<typeof client.create>[0]>().toEqualTypeOf<UserCreateBody>()
    expectTypeOf<Awaited<ReturnType<typeof client.create>>>().toEqualTypeOf<UserResponse>()
    expectTypeOf<Awaited<ReturnType<typeof client.list>>>().toEqualTypeOf<UserListResponse>()
    expectTypeOf<Parameters<typeof client.update>[1]>().toEqualTypeOf<UserUpdateBody>()
  })

  test("posts user creation payloads", async () => {
    const calls: unknown[] = []
    const client = createUserClient(
      createApiClient({
        baseUrl: "http://local.test",
        fetch: async (input, init) => {
          calls.push({ input, init })

          return new Response(
            JSON.stringify({
              data: {
                displayName: "Michael",
                id: "usr_123",
                status: "active",
              },
              ok: true,
            }),
          )
        },
      }),
    )

    await client.create({
      displayName: "Michael",
      email: "m@example.com",
    })

    expect(calls).toMatchObject([
      {
        init: {
          body: JSON.stringify({
            displayName: "Michael",
            email: "m@example.com",
          }),
          method: "POST",
        },
        input: "http://local.test/api/v1/users",
      },
    ])
  })
})
