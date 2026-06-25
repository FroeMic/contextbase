import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

describe("signup repository", () => {
  test("consumes signup verifications as single-use unexpired tokens", () => {
    const source = readFileSync(join(process.cwd(), "src/domains/signup/repository.ts"), "utf8")

    expect(source).toContain(".update(signupEmailVerifications)")
    expect(source).toContain("isNull(signupEmailVerifications.consumedAt)")
    expect(source).toContain("gt(signupEmailVerifications.expiresAt, input.now)")
    expect(source).toContain(".returning({")
  })

  test("creates verified users and onboarding sessions in one transaction", () => {
    const source = readFileSync(join(process.cwd(), "src/domains/signup/repository.ts"), "utf8")

    expect(source).toContain("consumeSignupVerificationWithOnboardingSession")
    expect(source).toContain("client.db.transaction")
    expect(source).toContain("tx.query.users.findFirst")
    expect(source).toContain("status: true")
    expect(source).toContain('existingUser.status !== "active"')
    expect(source).toContain("Existing user account is not active")
    expect(source).toContain("hasExistingWorkspaceMembership")
    expect(source).toContain("User already has a workspace membership")
    expect(source.indexOf("hasExistingWorkspaceMembership")).toBeLessThan(
      source.indexOf(".insert(onboardingSessions)"),
    )
    expect(source).toContain(".insert(users)")
    expect(source).toContain("emailVerifiedAt: input.now")
    expect(source).not.toContain('status: "active"')
    expect(source).toContain(".insert(onboardingSessions)")
    expect(source).toContain("sessionTokenHash: input.sessionTokenHash")
  })

  test("completes onboarding context and replaces the onboarding session transactionally", () => {
    const source = readFileSync(join(process.cwd(), "src/domains/signup/repository.ts"), "utf8")

    expect(source).toContain("findActiveOnboardingSessionByTokenHash")
    expect(source.indexOf(".update(onboardingSessions)")).toBeLessThan(
      source.indexOf(".insert(workspaces)"),
    )
    expect(source).toContain('eq(onboardingSessions.status, "active")')
    expect(source).toContain("gt(onboardingSessions.expiresAt, input.now)")
    expect(source).toContain("isNull(onboardingSessions.completedAt)")
    expect(source).toContain("isNull(onboardingSessions.revokedAt)")
    expect(source).toContain("hasExistingOnboardingWorkspaceMembership")
    expect(source).toContain("User already has a workspace membership")
    expect(source.indexOf("hasExistingOnboardingWorkspaceMembership")).toBeLessThan(
      source.indexOf(".insert(workspaces)"),
    )
    expect(source).toContain(".insert(workspaces)")
    expect(source).toContain(".insert(workspaceMemberships)")
    expect(source).toContain(".insert(authSessions)")
    expect(source).toContain(".update(onboardingSessions)")
    expect(source).toContain("completedAt: input.now")
    expect(source).not.toContain(".insert(businesses)")
    expect(source).not.toContain(".insert(agents)")
    expect(source).not.toContain("defaultBusinessId")
  })

  test("does not write copied business events, activities, or brief versions during onboarding", () => {
    const source = readFileSync(join(process.cwd(), "src/domains/signup/repository.ts"), "utf8")

    expect(source).not.toContain("insertEventAndActivity")
    expect(source).not.toContain("insertEntityVersionInTransaction")
    expect(source).not.toContain("buildBusinessBriefVersionInput")
    expect(source).not.toContain("businessId")
    expect(source).not.toContain("businessSlug")
    expect(source).not.toContain('eventType: "business.created"')
  })

  test("creates the initial workspace without a copied event/activity write", () => {
    const source = readFileSync(join(process.cwd(), "src/domains/signup/repository.ts"), "utf8")

    expect(source).toContain(".insert(workspaces)")
    expect(source).not.toContain('entityType: "workspace"')
    expect(source).not.toContain('eventType: "workspace.created"')
    expect(source).not.toContain('eventType: "business.created"')
  })

  test("maps duplicate onboarding slugs to typed conflicts", () => {
    const source = readFileSync(join(process.cwd(), "src/domains/signup/repository.ts"), "utf8")

    expect(source).toContain("new ConflictError")
    expect(source).toContain("isOnboardingSlugUniqueViolation")
    expect(source).toContain("workspaces_workspace_slug_idx")
  })
})
