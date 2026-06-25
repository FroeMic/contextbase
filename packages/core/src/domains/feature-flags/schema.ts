import { boolean, index, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core"

import { createId } from "../../shared/ids"

export const featureFlagRules = pgTable(
  "feature_flag_rules",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("ffr")),
    workspaceId: varchar("workspace_id", { length: 32 }),
    workspaceSlug: varchar("workspace_slug", { length: 80 }),
    flagKey: text("flag_key").notNull(),
    valueJson: text("value_json").notNull(),
    conditionsJson: text("conditions_json").notNull(),
    priority: integer("priority").default(0).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    description: text("description"),
    createdById: varchar("created_by_id", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("feature_flag_rules_workspace_enabled_idx").on(
      table.workspaceId,
      table.enabled,
      table.deletedAt,
    ),
    index("feature_flag_rules_flag_enabled_idx").on(table.flagKey, table.enabled, table.deletedAt),
    index("feature_flag_rules_priority_idx").on(table.priority, table.updatedAt, table.id),
  ],
)
