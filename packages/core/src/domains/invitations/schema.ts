import { index, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core"

import { createId } from "../../shared/ids"

export const workspaceInvitations = pgTable(
  "workspace_invitations",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("win")),
    workspaceId: varchar("workspace_id", { length: 32 }).notNull(),
    workspaceSlug: varchar("workspace_slug", { length: 80 }).notNull(),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    role: varchar("role", { length: 64 }).default("workspace_member").notNull(),
    invitedByUserId: varchar("invited_by_user_id", { length: 32 }).notNull(),
    tokenHash: text("token_hash").notNull(),
    status: varchar("status", { length: 32 }).default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("workspace_invitations_token_hash_idx").on(table.tokenHash),
    index("workspace_invitations_workspace_status_idx").on(table.workspaceId, table.status),
    index("workspace_invitations_email_idx").on(table.emailNormalized),
  ],
)
