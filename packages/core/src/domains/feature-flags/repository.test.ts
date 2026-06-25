import { getTableName } from "drizzle-orm"
import { describe, expect, test } from "vitest"

import { createPostgresFeatureFlagStore } from "./repository"

describe("postgres feature flag repository", () => {
  test("creates workspace-scoped feature flag rules with serialized rule data", async () => {
    const inserts: Array<{ tableName: string; values: unknown }> = []
    const now = new Date("2026-05-27T09:00:00.000Z")
    const fakeDb = {
      insert: (table: unknown) => {
        const tableName = getTableName(table as never)
        const chain = {
          returning: () => [
            {
              conditionsJson: JSON.stringify([
                { field: "user.email", operator: "equals", value: "michael@example.com" },
              ]),
              createdAt: now,
              createdById: "usr_123",
              deletedAt: null,
              description: "Enable dashboard editing",
              enabled: true,
              flagKey: "developer.browserFlagOverrides",
              id: "ffr_123",
              priority: 100,
              updatedAt: now,
              valueJson: "true",
              workspaceId: "wrk_123",
              workspaceSlug: "core",
            },
          ],
          values: (values: unknown) => {
            inserts.push({ tableName, values })
            return chain
          },
        }
        return chain
      },
    }

    const result = await createPostgresFeatureFlagStore({ db: fakeDb } as never).createRule?.(
      {
        createdById: "usr_123",
        workspaceId: "wrk_123",
        workspaceSlug: "core",
      },
      {
        conditions: [{ field: "user.email", operator: "equals", value: "michael@example.com" }],
        description: "Enable dashboard editing",
        enabled: true,
        flagKey: "developer.browserFlagOverrides",
        priority: 100,
        value: true,
      },
    )

    expect(result).toMatchObject({
      flagKey: "developer.browserFlagOverrides",
      id: "ffr_123",
      value: true,
      workspaceId: "wrk_123",
    })
    expect(inserts).toEqual([
      {
        tableName: "feature_flag_rules",
        values: {
          conditionsJson: JSON.stringify([
            { field: "user.email", operator: "equals", value: "michael@example.com" },
          ]),
          createdById: "usr_123",
          description: "Enable dashboard editing",
          enabled: true,
          flagKey: "developer.browserFlagOverrides",
          priority: 100,
          valueJson: "true",
          workspaceId: "wrk_123",
          workspaceSlug: "core",
        },
      },
    ])
  })

  test("lists only workspace-scoped raw rules for workspace administrators", async () => {
    let wherePredicate: unknown
    const fakeDb = {
      select: () => ({
        from: () => ({
          where: (predicate: unknown) => {
            wherePredicate = predicate
            return {
              orderBy: () => [],
            }
          },
        }),
      }),
    }

    await createPostgresFeatureFlagStore({ db: fakeDb } as never).listRules?.({
      principalId: "usr_123",
      principalKind: "user",
      role: "workspace_admin",
      workspaceId: "wrk_123",
      workspaceSlug: "core",
    })

    const whereSql = flattenSqlChunks(wherePredicate)
    expect(whereSql).toContain("workspace_id")
    expect(whereSql).toContain("=")
    expect(whereSql).not.toContain("workspace_id is null")
  })
})

function flattenSqlChunks(value: unknown): string {
  if (!value || typeof value !== "object") return ""
  const chunks = (value as { queryChunks?: unknown[] }).queryChunks
  if (!Array.isArray(chunks)) return ""

  return chunks
    .map((chunk) => {
      if (chunk && typeof chunk === "object") {
        const columnName = (chunk as { name?: unknown }).name
        if (typeof columnName === "string") return columnName
        const stringChunkValue = (chunk as { value?: unknown }).value
        if (Array.isArray(stringChunkValue)) return stringChunkValue.join("")
        return flattenSqlChunks(chunk)
      }
      return String(chunk)
    })
    .join("")
}
