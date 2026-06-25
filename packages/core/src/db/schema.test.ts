import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { getTableColumns, getTableName } from "drizzle-orm"
import { getTableConfig } from "drizzle-orm/pg-core"
import { describe, expect, test } from "vitest"

import {
  apiTokens,
  authMagicLinks,
  authSessions,
  captureClients,
  capturedSessionArtifacts,
  capturedSessionMessages,
  capturedSessionSourceSnapshots,
  capturedSessions,
  captureProviders,
  featureFlagRules,
  fileObjects,
  oauthAccessTokens,
  oauthAuthorizationCodes,
  oauthAuthorizationRequests,
  oauthClients,
  oauthGrants,
  oauthRefreshTokens,
  onboardingSessions,
  schemaTables,
  sessionCaptureSyncBatches,
  sessionCaptureSyncEvents,
  signupEmailVerifications,
  users,
  workspaceInvitations,
  workspaceMemberships,
  workspaces,
} from "./schema"

describe("Contextbase schema", () => {
  test("exports active workspace, auth, file, OAuth, and signup tables", () => {
    expect(getTableName(workspaces)).toBe("workspaces")
    expect(getTableName(users)).toBe("users")
    expect(getTableName(workspaceMemberships)).toBe("workspace_memberships")
    expect(getTableName(apiTokens)).toBe("api_tokens")
    expect(getTableName(authMagicLinks)).toBe("auth_magic_links")
    expect(getTableName(authSessions)).toBe("auth_sessions")
    expect(getTableName(featureFlagRules)).toBe("feature_flag_rules")
    expect(getTableName(captureProviders)).toBe("capture_providers")
    expect(getTableName(captureClients)).toBe("capture_clients")
    expect(getTableName(capturedSessions)).toBe("captured_sessions")
    expect(getTableName(capturedSessionMessages)).toBe("captured_session_messages")
    expect(getTableName(capturedSessionArtifacts)).toBe("captured_session_artifacts")
    expect(getTableName(capturedSessionSourceSnapshots)).toBe("captured_session_source_snapshots")
    expect(getTableName(sessionCaptureSyncBatches)).toBe("session_capture_sync_batches")
    expect(getTableName(sessionCaptureSyncEvents)).toBe("session_capture_sync_events")
    expect(getTableName(fileObjects)).toBe("file_objects")
    expect(getTableName(workspaceInvitations)).toBe("workspace_invitations")
    expect(getTableName(oauthClients)).toBe("oauth_clients")
    expect(getTableName(oauthAuthorizationRequests)).toBe("oauth_authorization_requests")
    expect(getTableName(oauthAuthorizationCodes)).toBe("oauth_authorization_codes")
    expect(getTableName(oauthGrants)).toBe("oauth_grants")
    expect(getTableName(oauthAccessTokens)).toBe("oauth_access_tokens")
    expect(getTableName(oauthRefreshTokens)).toBe("oauth_refresh_tokens")
    expect(getTableName(onboardingSessions)).toBe("onboarding_sessions")
    expect(getTableName(signupEmailVerifications)).toBe("signup_email_verifications")
  })

  test("keeps user avatar and token fields needed by current settings", () => {
    const userColumns = getTableColumns(users)
    expect(userColumns.avatarFileObjectId.name).toBe("avatar_file_object_id")
    expect(userColumns.passwordHash.name).toBe("password_hash")
    expect(userColumns.passwordHash.notNull).toBe(false)

    const userIndexNames = getTableConfig(users).indexes.map((index) => index.config.name)
    expect(userIndexNames).toContain("users_avatar_file_object_idx")

    const tokenColumns = getTableColumns(apiTokens)
    expect(tokenColumns.scopeJson.name).toBe("scope_json")
    expect(tokenColumns.createdByUserId.name).toBe("created_by_user_id")
    expect(tokenColumns.expiresAt.name).toBe("expires_at")
    expect(tokenColumns.revokedAt.name).toBe("revoked_at")
  })

  test("keeps schema table registry limited to active Contextbase tables", () => {
    expect(schemaTables).toHaveProperty("workspaces")
    expect(schemaTables).toHaveProperty("workspaceMemberships")
    expect(schemaTables).toHaveProperty("fileObjects")
    expect(schemaTables).toHaveProperty("oauthClients")
    expect(schemaTables).toHaveProperty("captureProviders")
    expect(schemaTables).toHaveProperty("captureClients")
    expect(schemaTables).toHaveProperty("capturedSessions")
    expect(schemaTables).toHaveProperty("capturedSessionMessages")
    expect(schemaTables).toHaveProperty("capturedSessionArtifacts")
    expect(schemaTables).toHaveProperty("capturedSessionSourceSnapshots")
    expect(schemaTables).toHaveProperty("sessionCaptureSyncBatches")
    expect(schemaTables).toHaveProperty("sessionCaptureSyncEvents")

    expect(schemaTables).not.toHaveProperty("businesses")
    expect(schemaTables).not.toHaveProperty("tasks")
    expect(schemaTables).not.toHaveProperty("chatConversations")
    expect(schemaTables).not.toHaveProperty("waAccounts")
    expect(schemaTables).not.toHaveProperty("waMessages")
  })
})

describe("migration journal", () => {
  test("registers every checked-in SQL migration in the Drizzle journal", () => {
    const migrationDir = resolve(import.meta.dirname, "../../../../drizzle")
    const journal = JSON.parse(
      readFileSync(resolve(migrationDir, "meta/_journal.json"), "utf8"),
    ) as { entries: Array<{ tag: string }> }
    const journalTags = new Set(journal.entries.map((entry) => entry.tag))
    const migrationTags = readdirSync(migrationDir)
      .filter((filename) => /^\d{4}_.+\.sql$/.test(filename))
      .map((filename) => filename.replace(/\.sql$/, ""))

    expect(migrationTags.filter((tag) => !journalTags.has(tag))).toEqual([])
  })

  test("keeps the migration history as a clean Contextbase baseline", () => {
    const migrationDir = resolve(import.meta.dirname, "../../../../drizzle")
    const migrationFiles = readdirSync(migrationDir).filter((filename) =>
      /^\d{4}_.+\.sql$/.test(filename),
    )

    expect(migrationFiles).toEqual([
      "0000_contextbase_initial_schema.sql",
      "0001_puzzling_mimic.sql",
    ])

    const migrationSource = migrationFiles
      .map((filename) => readFileSync(resolve(migrationDir, filename), "utf8"))
      .join("\n")

    const normalizedMigrationSource = migrationSource.toLowerCase()
    expect(normalizedMigrationSource).not.toContain(["w", "a", "_"].join(""))
    expect(normalizedMigrationSource).not.toContain(["whats", "app"].join(""))
    expect(migrationSource).not.toMatch(/"vertical:(read|write|files|admin)"/)
  })
})
