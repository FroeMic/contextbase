import { index, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core"

import { createId } from "../../shared/ids"

export const authMagicLinks = pgTable(
  "auth_magic_links",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("aml")),
    userId: varchar("user_id", { length: 32 }).notNull(),
    workspaceId: varchar("workspace_id", { length: 32 }).notNull(),
    workspaceSlug: varchar("workspace_slug", { length: 80 }).notNull(),
    emailNormalized: text("email_normalized").notNull(),
    tokenHash: text("token_hash").notNull(),
    redirectTo: text("redirect_to"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("auth_magic_links_token_hash_idx").on(table.tokenHash),
    index("auth_magic_links_user_workspace_idx").on(table.userId, table.workspaceId),
    index("auth_magic_links_email_expires_idx").on(table.emailNormalized, table.expiresAt),
  ],
)

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("ses")),
    userId: varchar("user_id", { length: 32 }).notNull(),
    activeWorkspaceId: varchar("active_workspace_id", { length: 32 }).notNull(),
    activeWorkspaceSlug: varchar("active_workspace_slug", { length: 80 }).notNull(),
    sessionTokenHash: text("session_token_hash").notNull(),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 128 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("auth_sessions_token_hash_idx").on(table.sessionTokenHash),
    index("auth_sessions_user_status_idx").on(table.userId, table.status),
    index("auth_sessions_workspace_status_idx").on(table.activeWorkspaceId, table.status),
  ],
)
