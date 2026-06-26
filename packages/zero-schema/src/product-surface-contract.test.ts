import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, test } from "vitest"

import { schema } from "./generated-schema"
import { queries } from "./queries"

const copiedProductTables = [
  "activities",
  "agentRoleBindings",
  "agents",
  "approvalComments",
  "approvals",
  "artifactLinks",
  "artifacts",
  "businessDashboardLayouts",
  "businessMemberships",
  "businessRoles",
  "businesses",
  "chatConversationParticipants",
  "chatConversations",
  "chatMessageParts",
  "chatMessages",
  "chatTurnEvents",
  "chatTurns",
  "commentMentions",
  "comments",
  "contactIdentityAliases",
  "contactTableProjection",
  "contactTableProjectionVersions",
  "contacts",
  "entityRelationships",
  "entityVersions",
  "events",
  "executionBindings",
  "goalTableProjection",
  "goalTableProjectionVersions",
  "goals",
  "labels",
  "organizationIdentityAliases",
  "organizationTableProjection",
  "organizationTableProjectionVersions",
  "organizations",
  "routineRuns",
  "routines",
  "routineTriggers",
  "runtimeDeliveryAttempts",
  "runtimeEventProjections",
  "runtimeLanes",
  "runtimeQueueItems",
  "runtimeRunObservations",
  "sessionBindings",
  "taskApprovals",
  "taskClaims",
  "taskCommentMentions",
  "taskComments",
  "taskExecutionDecisions",
  "taskLabels",
  "taskMonitors",
  "taskReminders",
  "taskTableProjection",
  "taskTableProjectionLabels",
  "taskTableProjectionVersions",
  "tasks",
  "uiDatatableState",
  "uiDatatableViews",
]

const serverOnlyTables = ["apiTokens", "authMagicLinks", "authSessions"]

const expectedQueryNames = [
  "activeWorkspace",
  "capturedSessionArtifacts",
  "capturedSessionMessages",
  "capturedSessionsByWorkspace",
  "currentUser",
  "publicAvatarFile",
  "syncEventsByCapturedSession",
  "usersByWorkspace",
]

describe("Zero product surface", () => {
  test("generated schema only exposes Contextbase client-readable tables", () => {
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

    for (const table of [...copiedProductTables, ...serverOnlyTables]) {
      expect(schema.tables).not.toHaveProperty(table)
    }
  })

  test("custom query list is the Contextbase read set", () => {
    expect(
      Object.keys(queries)
        .filter((name) => name !== "~")
        .sort(),
    ).toEqual([...expectedQueryNames].sort())
  })

  test("context source has no business authorization model", () => {
    const source = readFileSync(resolve(import.meta.dirname, "context.ts"), "utf8")

    expect(source).not.toContain("accessibleBusinessIds")
    expect(source).not.toContain("BusinessScopedRow")
    expect(source).not.toContain("BusinessRouteRow")
    expect(source).not.toContain("canReadBusinessRow")
    expect(source).not.toContain("resolveActiveBusiness")
  })

  test("query source has no copied product query names", () => {
    const source = readFileSync(resolve(import.meta.dirname, "queries.ts"), "utf8")

    expect(source).not.toContain("ByBusiness")
    expect(source).not.toContain("businessSlug")
    expect(source).not.toContain("businessDashboard")
    expect(source).not.toContain("taskTable")
    expect(source).not.toContain("contactTable")
    expect(source).not.toContain("organizationTable")
    expect(source).not.toContain("datatable")
  })
})
