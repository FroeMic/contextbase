import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"

import { createId } from "../../shared/ids"

export const fileObjects = pgTable(
  "file_objects",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("file")),
    workspaceId: varchar("workspace_id", { length: 32 }),
    workspaceSlug: varchar("workspace_slug", { length: 80 }),
    scopeKind: varchar("scope_kind", { length: 32 }).default("workspace").notNull(),
    ownerKind: varchar("owner_kind", { length: 32 }),
    ownerId: varchar("owner_id", { length: 32 }),
    provider: varchar("provider", { length: 32 }).notNull(),
    objectKey: text("object_key"),
    visibility: varchar("visibility", { length: 32 }).default("private").notNull(),
    usageKind: varchar("usage_kind", { length: 32 }).default("workspace_file").notNull(),
    publicAssetId: varchar("public_asset_id", { length: 32 }),
    contentType: varchar("content_type", { length: 160 }),
    byteSize: integer("byte_size"),
    sha256: varchar("sha256", { length: 64 }),
    originalFilename: text("original_filename"),
    storageStatus: varchar("storage_status", { length: 32 }).default("pending").notNull(),
    createdByKind: varchar("created_by_kind", { length: 32 }),
    createdById: varchar("created_by_id", { length: 32 }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("file_objects_workspace_status_created_idx").on(
      table.workspaceId,
      table.storageStatus,
      table.createdAt,
    ),
    index("file_objects_visibility_usage_idx").on(table.visibility, table.usageKind),
    index("file_objects_owner_scope_idx").on(table.scopeKind, table.ownerKind, table.ownerId),
    uniqueIndex("file_objects_provider_object_key_uq")
      .on(table.provider, table.objectKey)
      .where(sql`${table.objectKey} is not null`),
    uniqueIndex("file_objects_public_asset_id_uq")
      .on(table.publicAssetId)
      .where(sql`${table.publicAssetId} is not null`),
    check(
      "file_objects_storage_status_check",
      sql`${table.storageStatus} in ('pending', 'available', 'failed', 'delete_pending', 'deleted')`,
    ),
    check("file_objects_scope_kind_check", sql`${table.scopeKind} in ('user', 'workspace')`),
    check(
      "file_objects_scope_required_check",
      sql`(${table.scopeKind} = 'user' and ${table.ownerKind} = 'user' and ${table.ownerId} is not null) or (${table.scopeKind} = 'workspace' and ${table.workspaceId} is not null and ${table.workspaceSlug} is not null)`,
    ),
    check("file_objects_visibility_check", sql`${table.visibility} in ('private', 'public')`),
    check("file_objects_usage_kind_check", sql`${table.usageKind} in ('avatar', 'workspace_file')`),
    check(
      "file_objects_public_avatar_asset_check",
      sql`${table.visibility} <> 'public' or ${table.usageKind} <> 'avatar' or ${table.publicAssetId} is not null`,
    ),
    check(
      "file_objects_byte_size_positive_check",
      sql`${table.byteSize} is null or ${table.byteSize} > 0`,
    ),
    check(
      "file_objects_sha256_length_check",
      sql`${table.sha256} is null or length(${table.sha256}) = 64`,
    ),
    check(
      "file_objects_available_metadata_check",
      sql`${table.storageStatus} <> 'available' or (${table.objectKey} is not null and ${table.contentType} is not null and ${table.byteSize} is not null and ${table.sha256} is not null)`,
    ),
  ],
)
