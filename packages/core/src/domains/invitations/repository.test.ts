import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

describe("workspace invitation repository", () => {
  test("persists invitation lifecycle and accepts into a browser session transactionally", () => {
    const source = readFileSync(
      join(process.cwd(), "src/domains/invitations/repository.ts"),
      "utf8",
    )

    expect(source).toContain(".insert(workspaceInvitations)")
    expect(source).toContain(".update(workspaceInvitations)")
    expect(source).toContain("revokedAt: input.now")
    expect(source).toContain("acceptedAt: input.now")
    expect(source).toContain("tx.query.workspaceMemberships.findFirst")
    expect(source).toContain("User already has a workspace membership")
    expect(source).toContain("status: true")
    expect(source).toContain('existingUser.status !== "active"')
    expect(source).toContain("Existing user account is not active")
    expect(source).toContain(".insert(workspaceMemberships)")
    expect(source).not.toContain(".onConflictDoUpdate")
    expect(source).toContain(".insert(authSessions)")
    expect(source).toContain("emailVerifiedAt: input.now")
    expect(source).not.toContain('status: "active"')
    expect(source).not.toContain("insertEventAndActivity")
    expect(source).not.toContain("businessId")
    expect(source).not.toContain("businessSlug")
    expect(source).toContain("new NotFoundError")
    expect(source).toContain("new ConflictError")
  })
})
