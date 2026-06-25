import { describe, expect, test } from "vitest"

import { schema } from "./generated-schema"

describe("generated Zero schema", () => {
  test("package exports point to the clean build entrypoint", async () => {
    const { readFile } = await import("node:fs/promises")
    const { join } = await import("node:path")

    const packageJson = JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf8")) as {
      exports: {
        ".": {
          default: string
          types: string
        }
      }
    }

    expect(packageJson.exports["."].default).toBe("./dist/packages/zero-schema/src/index.js")
    expect(packageJson.exports["."].types).toBe("./dist/packages/zero-schema/src/index.d.ts")
  })

  test("includes only client-readable Contextbase tables", () => {
    expect(Object.keys(schema.tables).sort()).toEqual([
      "capturedSessionArtifacts",
      "capturedSessionMessages",
      "capturedSessionSourceSnapshots",
      "capturedSessions",
      "fileObjects",
      "sessionCaptureSyncEvents",
      "users",
      "workspaceMemberships",
      "workspaces",
    ])
  })

  test("excludes copied product and server-only credential tables", () => {
    expect(schema.tables).not.toHaveProperty("businesses")
    expect(schema.tables).not.toHaveProperty("agents")
    expect(schema.tables).not.toHaveProperty("tasks")
    expect(schema.tables).not.toHaveProperty("contacts")
    expect(schema.tables).not.toHaveProperty("organizations")
    expect(schema.tables).not.toHaveProperty("goals")
    expect(schema.tables).not.toHaveProperty("uiDatatableState")
    expect(schema.tables).not.toHaveProperty("apiTokens")
    expect(schema.tables).not.toHaveProperty("authSessions")
    expect(schema.tables).not.toHaveProperty("waAccounts")
    expect(schema.tables).not.toHaveProperty("waMessages")
  })

  test("does not expose private copied product columns", () => {
    expect(schema.tables.workspaces.columns).not.toHaveProperty("defaultBusinessId")
    expect(schema.tables.fileObjects.columns).not.toHaveProperty("businessId")
    expect(schema.tables.fileObjects.columns).not.toHaveProperty("businessSlug")
    expect(schema.tables).not.toHaveProperty("attachments")
  })

  test("keeps workspace, user, public avatar, and membership read columns", () => {
    expect(schema.tables.workspaces.columns).toMatchObject({
      id: { type: "string" },
      workspaceName: { serverName: "workspace_name", type: "string" },
      workspaceSlug: { serverName: "workspace_slug", type: "string" },
    })
    expect(schema.tables.users.columns).toHaveProperty("avatarFileObjectId")
    expect(schema.tables.users.columns).not.toHaveProperty("passwordHash")
    expect(schema.tables.fileObjects.columns).toHaveProperty("publicAssetId")
    expect(schema.tables.fileObjects.columns).not.toHaveProperty("objectKey")
    expect(schema.tables.workspaceMemberships.columns).toHaveProperty("workspaceId")
    expect(schema.tables.workspaceMemberships.columns).toHaveProperty("principalId")
    expect(schema.tables.capturedSessions.columns).toHaveProperty("workspaceId")
    expect(schema.tables.capturedSessions.columns).toHaveProperty("kind")
    expect(schema.tables.capturedSessionMessages.columns).toHaveProperty("capturedSessionId")
    expect(schema.tables.capturedSessionArtifacts.columns).toHaveProperty("capturedSessionId")
    expect(schema.tables.capturedSessionSourceSnapshots.columns).toHaveProperty("capturedSessionId")
    expect(schema.tables.sessionCaptureSyncEvents.columns).toHaveProperty("capturedSessionId")
  })
})
