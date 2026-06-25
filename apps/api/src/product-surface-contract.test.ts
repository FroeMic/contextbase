import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

const apiSrc = join(process.cwd(), "src")

function exists(path: string) {
  return existsSync(join(apiSrc, path))
}

function source(path: string) {
  return readFileSync(join(apiSrc, path), "utf8")
}

describe("Contextbase API product surface", () => {
  const removedRouteDomains = [
    "agents",
    "approvals",
    "artifacts",
    "businesses",
    "chats",
    "comments",
    "contacts",
    "events",
    "execution-bindings",
    "goals",
    "labels",
    "organizations",
    "routines",
    "runtime",
    "runtime-heartbeats",
    "runtime-recovery",
    "tasks",
  ]

  test("does not keep copied Vertical API route modules as active source", () => {
    for (const domain of removedRouteDomains) {
      expect(exists(`domains/${domain}`), `domains/${domain} should be removed`).toBe(false)
    }
  })

  test("api app only mounts Contextbase relevant routers", () => {
    const appSource = source("app.ts")

    for (const domain of removedRouteDomains) {
      const importFragment = `./domains/${domain}/routes`
      expect(appSource, `${importFragment} should not be imported`).not.toContain(importFragment)
    }

    for (const forbidden of [
      "createAgentRouter",
      "createApprovalRouter",
      "createArtifactRouter",
      "createBusinessRouter",
      "createChatRouter",
      "createChatRuntimeRouter",
      "createCommentRouter",
      "createContactRouter",
      "createExecutionBindingRouter",
      "createGoalRouter",
      "createLabelRouter",
      "createOrganizationRouter",
      "createRoutineRouter",
      "createRuntimeRouter",
      "createRuntimeHeartbeatRouter",
      "createRuntimeRecoveryRouter",
      "createTaskRouter",
    ]) {
      expect(appSource).not.toContain(forbidden)
    }

    for (const kept of [
      "createFeatureFlagRouter",
      "createFileRouter",
      "createWorkspaceInvitationRouter",
      "createUserRouter",
      "createWorkspaceMemberRouter",
      "createWorkspaceRouter",
    ]) {
      expect(appSource).toContain(kept)
    }
  })

  test("route policy does not encode copied product routes", () => {
    const policySource = source("http/route-policy.ts")

    for (const forbidden of [
      "/api/v1/businesses",
      "/api/v1/agents",
      "/api/v1/tasks",
      "ownerType=task",
    ]) {
      expect(policySource).not.toContain(forbidden)
    }
  })

  test("file API does not expose copied business/task/CRM owner model", () => {
    const fileRoutes = source("domains/files/routes.ts")

    for (const forbidden of [
      "businessIdOrSlug",
      'ownerType: "business"',
      'ownerType: "contact"',
      'ownerType: "goal"',
      'ownerType: "organization"',
      'ownerType: "task"',
      'ownerType: "task_comment"',
      "/tasks/",
      "/contacts/",
      "/organizations/",
      "/goals/",
    ]) {
      expect(fileRoutes).not.toContain(forbidden)
    }
  })

  test("file API uses Contextbase storage env names", () => {
    const fileRoutes = source("domains/files/routes.ts")

    for (const forbidden of ["VERTICAL_STORAGE_", "VERTICAL_PUBLIC_ASSETS_", "VERTICAL_UPLOADS_"]) {
      expect(fileRoutes).not.toContain(forbidden)
    }

    expect(fileRoutes).toContain("CONTEXTBASE_STORAGE_")
  })

  test("local smoke scripts do not exercise copied business/task/CRM flows", () => {
    const smokeScript = readFileSync(join(apiSrc, "../../../scripts/smoke-local.mjs"), "utf8")
    const seedScript = readFileSync(join(apiSrc, "../../../scripts/seed-demo.ts"), "utf8")

    for (const sourceText of [smokeScript, seedScript]) {
      for (const forbidden of [
        "businessIdOrSlug",
        "/api/v1/goals",
        'ownerType", "task',
        "runtime.missing_task_comment",
        "Enable CRM UI",
      ]) {
        expect(sourceText).not.toContain(forbidden)
      }
    }
  })

  test("api error reporting uses Contextbase service naming", () => {
    const appSource = source("app.ts")

    expect(appSource).toContain("contextbase-api")
    expect(appSource).not.toContain("vertical-api")
  })
})
