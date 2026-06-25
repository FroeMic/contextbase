import { index, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core"

import { createId } from "../../shared/ids"

export const workspaces = pgTable(
  "workspaces",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("wrk")),
    workspaceSlug: varchar("workspace_slug", { length: 80 }).notNull(),
    workspaceName: text("workspace_name").notNull(),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("workspaces_workspace_slug_idx").on(table.workspaceSlug),
    index("workspaces_status_idx").on(table.status),
  ],
)

export const workspaceSlugAliases = pgTable(
  "workspace_slug_aliases",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("als")),
    workspaceId: varchar("workspace_id", { length: 32 }).notNull(),
    oldSlug: varchar("old_slug", { length: 80 }).notNull(),
    newSlug: varchar("new_slug", { length: 80 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("workspace_slug_aliases_old_slug_idx").on(table.oldSlug),
    index("workspace_slug_aliases_workspace_id_idx").on(table.workspaceId),
  ],
)
