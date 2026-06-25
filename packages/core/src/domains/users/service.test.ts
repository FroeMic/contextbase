import { Effect } from "effect"
import { describe, expect, test } from "vitest"

import { createUser, getUser, listUsers, updateOwnUserProfile } from "./service"

const authContext = {
  principalId: "usr_admin",
  principalKind: "user",
  role: "workspace_admin",
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

describe("user service", () => {
  test("lists workspace users without copied business scope", async () => {
    const calls: unknown[] = []

    await expect(
      Effect.runPromise(
        listUsers(
          {
            findUserByIdInWorkspace: async () => null,
            listUsers: async (context) => {
              calls.push(context)
              return []
            },
          },
          authContext,
        ),
      ),
    ).resolves.toEqual([])

    expect(calls).toEqual([authContext])
  })

  test("creates a user with workspace membership without copied event writes", async () => {
    const writes: string[] = []
    const result = await Effect.runPromise(
      createUser(
        {
          createUserWithMembership: async () => {
            writes.push("user-membership")
            return {
              displayName: "Michael",
              email: "m@example.com",
              emailNormalized: "m@example.com",
              emailVerifiedAt: null,
              id: "usr_123",
              lastLoginAt: null,
              primaryChannelKind: null,
              primaryChannelRef: null,
              status: "active",
            }
          },
          findUserByIdInWorkspace: async () => null,
        },
        authContext,
        {
          email: "m@example.com",
          displayName: "Michael",
        },
      ),
    )

    expect(result).toMatchObject({
      displayName: "Michael",
      email: "m@example.com",
      id: "usr_123",
    })
    expect(writes).toEqual(["user-membership"])
  })

  test("rejects scoped admin user creation without vertical admin", async () => {
    let created = false

    await expect(
      Effect.runPromise(
        Effect.either(
          createUser(
            {
              createUserWithMembership: async () => {
                created = true
                throw new Error("should not create")
              },
              findUserByIdInWorkspace: async () => null,
            },
            {
              ...authContext,
              scopes: ["contextbase:read", "contextbase:write"],
            },
            {
              displayName: "Blocked",
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "ForbiddenError",
        code: "forbidden",
      },
    })
    expect(created).toBe(false)
  })

  test("rejects reading a user without workspace membership", async () => {
    await expect(
      Effect.runPromise(
        Effect.either(
          getUser(
            {
              findUserByIdInWorkspace: async () => null,
            },
            authContext,
            {
              userId: "usr_other",
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "NotFoundError",
        code: "not_found",
      },
    })
  })

  test("uses direct user creation and does not require event-aware stores", async () => {
    const writes: string[] = []
    const result = await Effect.runPromise(
      createUser(
        {
          createUserWithMembership: async () => {
            writes.push("create")
            return {
              displayName: "Michael",
              email: null,
              emailNormalized: null,
              emailVerifiedAt: null,
              id: "usr_123",
              lastLoginAt: null,
              primaryChannelKind: null,
              primaryChannelRef: null,
              status: "active",
            }
          },
          findUserByIdInWorkspace: async () => null,
        },
        authContext,
        {
          displayName: "Michael",
        },
      ),
    )

    expect(result.id).toBe("usr_123")
    expect(writes).toEqual(["create"])
  })

  test("updates the signed-in user's own profile without requiring workspace admin", async () => {
    const writes: string[] = []
    const memberContext = {
      ...authContext,
      principalId: "usr_member",
      role: "workspace_member",
    }

    const result = await Effect.runPromise(
      updateOwnUserProfile(
        {
          findUserByIdInWorkspace: async (_context, userId) =>
            userId === "usr_member"
              ? {
                  displayName: "Old Name",
                  email: "member@example.com",
                  emailNormalized: "member@example.com",
                  emailVerifiedAt: null,
                  id: "usr_member",
                  lastLoginAt: null,
                  primaryChannelKind: null,
                  primaryChannelRef: null,
                  status: "active",
                }
              : null,
          updateUser: async (_context, input) => {
            writes.push(`update:${input.userId}`)
            return {
              displayName: input.displayName ?? "Old Name",
              email: "member@example.com",
              emailNormalized: "member@example.com",
              emailVerifiedAt: null,
              id: input.userId,
              lastLoginAt: null,
              primaryChannelKind: null,
              primaryChannelRef: null,
              status: "active",
            }
          },
        },
        memberContext,
        {
          displayName: "New Name",
        },
      ),
    )

    expect(result).toMatchObject({
      displayName: "New Name",
      id: "usr_member",
    })
    expect(writes).toEqual(["update:usr_member"])
  })

  test("rejects self profile updates for non-user principals", async () => {
    await expect(
      Effect.runPromise(
        Effect.either(
          updateOwnUserProfile(
            {
              findUserByIdInWorkspace: async () => null,
              updateUser: async () => {
                throw new Error("should not update")
              },
            },
            {
              ...authContext,
              principalId: "agt_builder",
              principalKind: "agent",
              role: "workspace_member",
            },
            {
              displayName: "Builder",
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "ForbiddenError",
        code: "forbidden",
      },
    })
  })
})
