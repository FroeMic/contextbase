import { sql } from "drizzle-orm"
import { index, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core"

import { createId } from "../../shared/ids"

export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("usr")),
    displayName: text("display_name").notNull(),
    email: text("email"),
    emailNormalized: text("email_normalized"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    passwordHash: text("password_hash"),
    avatarFileObjectId: varchar("avatar_file_object_id", { length: 32 }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    primaryChannelKind: varchar("primary_channel_kind", { length: 64 }),
    primaryChannelRef: text("primary_channel_ref"),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_email_normalized_idx").on(table.emailNormalized),
    index("users_avatar_file_object_idx")
      .on(table.avatarFileObjectId)
      .where(sql`${table.avatarFileObjectId} is not null`),
    index("users_status_idx").on(table.status),
  ],
)

export const workspaceMemberships = pgTable(
  "workspace_memberships",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("mbr")),
    workspaceId: varchar("workspace_id", { length: 32 }).notNull(),
    workspaceSlug: varchar("workspace_slug", { length: 80 }).notNull(),
    principalKind: varchar("principal_kind", { length: 32 }).notNull(),
    principalId: varchar("principal_id", { length: 32 }).notNull(),
    role: varchar("role", { length: 64 }).default("workspace_admin").notNull(),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("workspace_memberships_scope_principal_idx").on(
      table.workspaceId,
      table.principalKind,
      table.principalId,
    ),
    index("workspace_memberships_principal_idx").on(table.principalKind, table.principalId),
    index("workspace_memberships_workspace_status_idx").on(table.workspaceId, table.status),
  ],
)

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("tok")),
    workspaceId: varchar("workspace_id", { length: 32 }).notNull(),
    workspaceSlug: varchar("workspace_slug", { length: 80 }).notNull(),
    principalKind: varchar("principal_kind", { length: 32 }).default("user").notNull(),
    principalId: varchar("principal_id", { length: 32 }).notNull(),
    tokenHash: text("token_hash").notNull(),
    label: text("label").default("bootstrap").notNull(),
    scopeJson: text("scope_json")
      .default(JSON.stringify(["contextbase:read", "contextbase:write", "contextbase:files"]))
      .notNull(),
    createdByUserId: varchar("created_by_user_id", { length: 32 }),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("api_tokens_token_hash_idx").on(table.tokenHash),
    index("api_tokens_workspace_status_idx").on(table.workspaceId, table.status),
    index("api_tokens_principal_idx").on(table.principalKind, table.principalId),
  ],
)
