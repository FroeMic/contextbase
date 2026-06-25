import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, test } from "vitest"

import { schemaTables } from "./db/schema.js"

const repoRoot = resolve(import.meta.dirname, "../../..")
const coreRoot = resolve(import.meta.dirname, "..")

const copiedProductDomains = [
  "agent-runtime-bindings",
  "agents",
  "approvals",
  "artifacts",
  "businesses",
  "chats",
  "comments",
  "contacts",
  "dashboard",
  "events",
  "execution-bindings",
  "goals",
  "labels",
  "organizations",
  "routines",
  "runtime",
  "runtime-delivery",
  "runtime-heartbeats",
  "runtime-monitors",
  "runtime-projections",
  "runtime-recovery",
  "runtime-worker",
  "tasks",
  "ui-tables",
  "versions",
]

const copiedProductSchemaKeys = [
  "agentRoleBindings",
  "agentRuntimeBindings",
  "agentRuntimePolicies",
  "agentRuntimeState",
  "agents",
  "approvalComments",
  "approvals",
  "artifactLinks",
  "artifacts",
  "activities",
  "businesses",
  "businessMemberships",
  "businessRoles",
  "businessDashboardLayouts",
  "businessSlugAliases",
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

describe("core product surface", () => {
  test("root exports do not expose copied product domains", () => {
    const indexSource = readFileSync(resolve(coreRoot, "src/index.ts"), "utf8")

    for (const domain of copiedProductDomains) {
      expect(indexSource).not.toContain(`"./domains/${domain}/`)
    }
  })

  test("package subpath exports do not expose copied product domains", () => {
    const packageJson = JSON.parse(readFileSync(resolve(coreRoot, "package.json"), "utf8")) as {
      exports: Record<string, unknown>
    }
    const exportPaths = Object.keys(packageJson.exports)

    for (const domain of copiedProductDomains) {
      expect(exportPaths).not.toEqual(
        expect.arrayContaining([expect.stringContaining(`/domains/${domain}/`)]),
      )
    }
  })

  test("canonical schemaTables excludes copied product tables", () => {
    const schemaKeys = Object.keys(schemaTables)

    for (const key of copiedProductSchemaKeys) {
      expect(schemaKeys).not.toContain(key)
    }
  })

  test("file service does not expose copied product upload workflows", () => {
    const fileServiceSource = readFileSync(
      resolve(coreRoot, "src/domains/files/service.ts"),
      "utf8",
    )

    for (const forbidden of [
      "export function uploadAgentAvatar",
      "export function uploadBusinessAvatar",
      "export function uploadFile(",
      "export function createFileAttachment",
      "export function uploadFileAttachment",
      "export function uploadInlineFile",
      "export function listFileAttachments",
      "export function uploadTaskFileAttachment",
      "export function uploadInlineTaskFile",
      "export function uploadInlineOrganizationFile",
      "export function uploadInlineContactFile",
      "export function listTaskFileAttachments",
      "export function deleteFileAttachment",
      "export function getFileObject",
      "export function getFileDeletionEligibility",
      "export function getFileReferenceOwnerScope",
      "export function listFileReferencesForOwner",
      "export function listInlineFiles",
      "export function reconcileFileReferences",
      "export function normalizeMarkdownFileLinks",
    ]) {
      expect(fileServiceSource).not.toContain(forbidden)
    }
  })

  test("files source does not carry copied business attachment/reference owner model", () => {
    const fileSources = [
      "src/domains/files/service.ts",
      "src/domains/files/schema.ts",
      "src/domains/files/repository.ts",
    ].map((relativePath) => ({
      relativePath,
      source: readFileSync(resolve(coreRoot, relativePath), "utf8"),
    }))

    for (const { relativePath, source } of fileSources) {
      for (const forbidden of [
        "businessId",
        "businessSlug",
        "fileAttachments",
        "fileReferences",
        "FileAttachmentOwnerType",
        "FileReferenceOwnerType",
        "business_brief",
        "chat_message",
        "task_comment",
        "findFileOwnerByIdInWorkspace",
      ]) {
        expect(source, `${relativePath} should not contain ${forbidden}`).not.toContain(forbidden)
      }
    }
  })

  test("file storage source uses Contextbase workspace vocabulary", () => {
    const storageSource = readFileSync(resolve(coreRoot, "src/domains/files/storage.ts"), "utf8")

    for (const forbidden of [
      "businessId",
      "/businesses/",
      "vertical-files",
      "public.vertical",
      "VERTICAL_STORAGE_",
      "VERTICAL_PUBLIC_ASSETS_",
      "VERTICAL_UPLOADS_",
    ]) {
      expect(storageSource).not.toContain(forbidden)
    }

    expect(storageSource).toContain(
      [
        "workspaces/",
        "$",
        "{input.workspaceId}",
        "/files/",
        "$",
        "{input.fileId}",
        "/original",
      ].join(""),
    )
  })

  test("baseline workspace behavior is documented in OpenSpec", () => {
    const workspaceSpecPath = resolve(repoRoot, "openspec/specs/workspaces/spec.md")

    expect(existsSync(workspaceSpecPath)).toBe(true)
  })
})
