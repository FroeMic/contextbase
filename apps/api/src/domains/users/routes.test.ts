import { describe, expect, test } from "vitest"

import { createApiApp } from "../../app"

const authContext = {
  principalId: "usr_admin",
  principalKind: "user",
  role: "workspace_admin",
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

describe("user routes", () => {
  test("lists users through a success envelope", async () => {
    const response = await createApiApp({
      authenticateApiToken: async () => authContext,
      userStore: {
        findUserByIdInWorkspace: async () => null,
        listUsers: async () => [
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
      },
    }).request("/api/v1/users", {
      headers: {
        authorization: "Bearer token",
      },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          displayName: "Michael",
          email: "m@example.com",
          id: "usr_123",
          status: "active",
        },
      ],
      ok: true,
    })
  })

  test("creates a user through a success envelope", async () => {
    const response = await createApiApp({
      authenticateApiToken: async () => authContext,
      userStore: {
        createUserWithMembership: async () => ({
          displayName: "Michael",
          email: "m@example.com",
          emailNormalized: "m@example.com",
          emailVerifiedAt: null,
          id: "usr_123",
          lastLoginAt: null,
          primaryChannelKind: null,
          primaryChannelRef: null,
          status: "active",
        }),
        findUserByIdInWorkspace: async () => null,
      },
    }).request("/api/v1/users", {
      body: JSON.stringify({
        displayName: "Michael",
        email: "m@example.com",
      }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      method: "POST",
    })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        displayName: "Michael",
        email: "m@example.com",
        id: "usr_123",
      },
      ok: true,
    })
  })
})
