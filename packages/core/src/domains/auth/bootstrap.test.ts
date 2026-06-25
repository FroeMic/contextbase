import { Effect } from "effect"
import { describe, expect, test } from "vitest"

import {
  bootstrapWorkspaceAdmin,
  createBootstrapToken,
  hashApiToken,
  verifyApiToken,
} from "./bootstrap"

type BootstrapTestTransaction = {
  insert: () => {
    values: (value: unknown) => {
      returning: () => Promise<Array<{ id: string; workspaceSlug?: string }>>
    }
  }
  update: () => {
    set: (value: unknown) => {
      where: () => Promise<void>
    }
  }
}

describe("bootstrap token", () => {
  test("generates a printable token and stores only a hash", () => {
    const token = createBootstrapToken()
    const hash = hashApiToken(token)

    expect(token).toMatch(/^vct_[A-Za-z0-9_-]{43}$/)
    expect(hash).not.toContain(token)
    expect(verifyApiToken(token, hash)).toBe(true)
    expect(verifyApiToken(`${token}x`, hash)).toBe(false)
  })

  test("bootstraps a workspace with a user admin token and no copied business or agent", async () => {
    const inserted: unknown[] = []
    const updated: unknown[] = []
    let insertCall = 0

    const client = {
      db: {
        query: {
          workspaces: {
            findFirst: async () => null,
          },
        },
        transaction: async (fn: (tx: BootstrapTestTransaction) => Promise<unknown>) =>
          fn({
            insert: () => ({
              values: (value: unknown) => {
                inserted.push(value)
                insertCall += 1
                const call = insertCall

                return {
                  returning: async () => {
                    if (call === 1) {
                      return [{ id: "wrk_123", workspaceSlug: "alpha" }]
                    }
                    if (call === 2) {
                      return [{ id: "usr_123" }]
                    }
                    return []
                  },
                }
              },
            }),
            update: () => ({
              set: (value: unknown) => ({
                where: async () => {
                  updated.push(value)
                },
              }),
            }),
          }),
      },
    }

    const result = await Effect.runPromise(
      bootstrapWorkspaceAdmin(client as never, {
        userName: "Michael",
        workspaceName: "Alpha",
        workspaceSlug: "alpha",
      }),
    )

    expect(result.workspaceId).toBe("wrk_123")
    expect(result.userId).toBe("usr_123")
    expect(result).not.toHaveProperty("agentId")
    expect(result).not.toHaveProperty("defaultBusinessId")
    expect(result).not.toHaveProperty("defaultBusinessSlug")
    expect(
      inserted.find(
        (row) =>
          typeof row === "object" &&
          row !== null &&
          "principalKind" in row &&
          row.principalKind === "agent" &&
          "role" in row,
      ),
    ).toBeUndefined()
    expect(inserted[2]).toMatchObject({
      principalId: "usr_123",
      principalKind: "user",
      role: "workspace_admin",
      workspaceId: "wrk_123",
      workspaceSlug: "alpha",
    })
    expect(inserted[3]).toMatchObject({
      label: "workspace-local-cli",
      principalId: "usr_123",
      principalKind: "user",
      scopeJson: JSON.stringify([
        "contextbase:read",
        "contextbase:write",
        "contextbase:files",
        "contextbase:manage",
      ]),
      workspaceId: "wrk_123",
      workspaceSlug: "alpha",
    })
    expect(updated).toEqual([])
    expect(inserted).toHaveLength(4)
  })
})
