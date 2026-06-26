import { describe, expect, test } from "vitest"

import { queries } from "./queries"

const workspaceContext = {
  activeWorkspaceId: "wrk_demo",
  activeWorkspaceRole: "workspace_admin",
  activeWorkspaceSlug: "demo",
  capabilities: ["contextbase:read"],
  userId: "usr_demo",
}

type ZeroQueryAst = {
  limit?: number
  orderBy?: Array<[string, string]>
  where?: ZeroQueryCondition | { conditions?: Array<ZeroQueryCondition> }
}

type ZeroQueryCondition =
  | {
      left?: { name?: string }
      op?: string
      right?: { type?: string; value?: unknown }
      type: "simple"
    }
  | { type: string }

type SimpleZeroQueryCondition = Extract<ZeroQueryCondition, { type: "simple" }>

type AppQuery = {
  fn(input: { args: Record<string, unknown>; ctx: typeof workspaceContext }): {
    ast: ZeroQueryAst
  }
}

function queryAst(queryName: string, args: Record<string, unknown> = {}) {
  const query = (queries as Record<string, unknown>)[queryName] as AppQuery | undefined

  expect(query).toBeDefined()
  if (!query) {
    throw new Error(`${queryName} query is required`)
  }

  return query.fn({ args, ctx: workspaceContext }).ast
}

function simpleWhereConditions(ast: ZeroQueryAst): SimpleZeroQueryCondition[] {
  if (!ast.where) {
    return []
  }
  if (isSimpleWhereCondition(ast.where)) {
    return [ast.where]
  }
  const whereConditions = "conditions" in ast.where ? ast.where.conditions : undefined
  return whereConditions?.filter(isSimpleWhereCondition) ?? []
}

function hasSimpleWhere(ast: ZeroQueryAst, field: string, op: string, value: unknown) {
  return simpleWhereConditions(ast).some(
    (condition) =>
      condition.left?.name === field &&
      condition.op === op &&
      condition.right?.type === "literal" &&
      JSON.stringify(condition.right.value) === JSON.stringify(value),
  )
}

function isSimpleWhereCondition(
  condition: ZeroQueryCondition | { conditions?: Array<ZeroQueryCondition> },
): condition is SimpleZeroQueryCondition {
  return "type" in condition && condition.type === "simple"
}

describe("Zero custom queries", () => {
  test("exposes only retained Contextbase route-level read queries", () => {
    expect(
      Object.keys(queries)
        .filter((name) => name !== "~")
        .sort(),
    ).toEqual([
      "activeWorkspace",
      "capturedSessionArtifacts",
      "capturedSessionMessages",
      "capturedSessionsByWorkspace",
      "currentUser",
      "publicAvatarFile",
      "syncEventsByCapturedSession",
      "usersByWorkspace",
    ])
  })

  test("scopes workspace and current-user queries to authenticated context", () => {
    const workspaceAst = queryAst("activeWorkspace")
    const userAst = queryAst("currentUser")

    expect(hasSimpleWhere(workspaceAst, "id", "=", "wrk_demo")).toBe(true)
    expect(hasSimpleWhere(workspaceAst, "status", "=", "active")).toBe(true)
    expect(hasSimpleWhere(userAst, "id", "=", "usr_demo")).toBe(true)
    expect(hasSimpleWhere(userAst, "status", "=", "active")).toBe(true)
  })

  test("scopes public avatar file reads to public available avatar objects", () => {
    const ast = queryAst("publicAvatarFile", { fileId: "file_avatar" })

    expect(hasSimpleWhere(ast, "id", "=", "file_avatar")).toBe(true)
    expect(hasSimpleWhere(ast, "visibility", "=", "public")).toBe(true)
    expect(hasSimpleWhere(ast, "usageKind", "=", "avatar")).toBe(true)
    expect(hasSimpleWhere(ast, "storageStatus", "=", "available")).toBe(true)
    expect(hasSimpleWhere(ast, "deletedAt", "IS", null)).toBe(true)
  })

  test("scopes workspace member reads to active workspace users", () => {
    const ast = queryAst("usersByWorkspace", { limit: 25 })

    expect(hasSimpleWhere(ast, "workspaceId", "=", "wrk_demo")).toBe(true)
    expect(hasSimpleWhere(ast, "principalKind", "=", "user")).toBe(true)
    expect(hasSimpleWhere(ast, "status", "=", "active")).toBe(true)
    expect(ast.orderBy).toEqual([["createdAt", "desc"]])
    expect(ast.limit).toBe(25)
  })

  test("scopes captured session reads to the active workspace", () => {
    const ast = queryAst("capturedSessionsByWorkspace", { limit: 25 })

    expect(hasSimpleWhere(ast, "workspaceId", "=", "wrk_demo")).toBe(true)
    expect(hasSimpleWhere(ast, "status", "=", "active")).toBe(true)
    expect(ast.orderBy).toEqual([["lastSyncedAt", "desc"]])
    expect(ast.limit).toBe(25)
  })

  test("scopes captured artifact, message, and sync event reads to workspace-owned sessions", () => {
    const artifactsAst = queryAst("capturedSessionArtifacts", { capturedSessionId: "cps_123" })
    const messagesAst = queryAst("capturedSessionMessages", { capturedSessionId: "cps_123" })
    const eventsAst = queryAst("syncEventsByCapturedSession", { capturedSessionId: "cps_123" })

    expect(hasSimpleWhere(artifactsAst, "workspaceId", "=", "wrk_demo")).toBe(true)
    expect(hasSimpleWhere(artifactsAst, "capturedSessionId", "=", "cps_123")).toBe(true)
    expect(artifactsAst.orderBy).toEqual([
      ["createdAt", "asc"],
      ["id", "asc"],
    ])
    expect(hasSimpleWhere(messagesAst, "workspaceId", "=", "wrk_demo")).toBe(true)
    expect(hasSimpleWhere(messagesAst, "capturedSessionId", "=", "cps_123")).toBe(true)
    expect(messagesAst.orderBy).toEqual([["sequenceNumber", "asc"]])
    expect(hasSimpleWhere(eventsAst, "workspaceId", "=", "wrk_demo")).toBe(true)
    expect(hasSimpleWhere(eventsAst, "capturedSessionId", "=", "cps_123")).toBe(true)
    expect(eventsAst.orderBy).toEqual([["createdAt", "desc"]])
  })
})
