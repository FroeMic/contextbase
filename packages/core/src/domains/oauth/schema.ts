import { sql } from "drizzle-orm"
import { index, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core"

import { createId } from "../../shared/ids"

export const oauthClients = pgTable(
  "oauth_clients",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("oac")),
    clientId: text("client_id").notNull(),
    clientName: text("client_name").notNull(),
    clientSecretHash: text("client_secret_hash"),
    clientSecretExpiresAt: timestamp("client_secret_expires_at", { withTimezone: true }),
    clientUri: text("client_uri"),
    metadataUrl: text("metadata_url"),
    grantTypesJson: text("grant_types_json")
      .default('["authorization_code","refresh_token"]')
      .notNull(),
    redirectUrisJson: text("redirect_uris_json").default("[]").notNull(),
    responseTypesJson: text("response_types_json").default('["code"]').notNull(),
    scopeJson: text("scope_json")
      .default('["contextbase:read","contextbase:write","contextbase:files","offline_access"]')
      .notNull(),
    tokenEndpointAuthMethod: varchar("token_endpoint_auth_method", { length: 64 })
      .default("none")
      .notNull(),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("oauth_clients_client_id_idx").on(table.clientId),
    index("oauth_clients_status_idx").on(table.status),
  ],
)

export const oauthAuthorizationRequests = pgTable(
  "oauth_authorization_requests",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("oar")),
    clientId: text("client_id").notNull(),
    redirectUri: text("redirect_uri").notNull(),
    resource: text("resource").notNull(),
    scopeJson: text("scope_json").default("[]").notNull(),
    state: text("state").notNull(),
    stateHash: text("state_hash").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    codeChallengeMethod: varchar("code_challenge_method", { length: 16 }).notNull(),
    status: varchar("status", { length: 32 }).default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("oauth_authorization_requests_client_status_idx").on(table.clientId, table.status),
    index("oauth_authorization_requests_expires_idx").on(table.expiresAt),
  ],
)

export const oauthAuthorizationCodes = pgTable(
  "oauth_authorization_codes",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("ocd")),
    codeHash: text("code_hash").notNull(),
    clientId: text("client_id").notNull(),
    redirectUri: text("redirect_uri").notNull(),
    resource: text("resource").notNull(),
    scopeJson: text("scope_json").default("[]").notNull(),
    codeChallengeHash: text("code_challenge_hash").notNull(),
    workspaceId: varchar("workspace_id", { length: 32 }).notNull(),
    workspaceSlug: varchar("workspace_slug", { length: 80 }).notNull(),
    userId: varchar("user_id", { length: 32 }).notNull(),
    actorKind: varchar("actor_kind", { length: 32 }).notNull(),
    actorId: varchar("actor_id", { length: 32 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("oauth_authorization_codes_code_hash_idx").on(table.codeHash),
    index("oauth_authorization_codes_client_idx").on(table.clientId),
    index("oauth_authorization_codes_workspace_idx").on(table.workspaceId),
    index("oauth_authorization_codes_expires_idx").on(table.expiresAt),
  ],
)

export const oauthGrants = pgTable(
  "oauth_grants",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("oag")),
    clientId: text("client_id").notNull(),
    clientName: text("client_name").notNull(),
    resource: text("resource").notNull(),
    workspaceId: varchar("workspace_id", { length: 32 }).notNull(),
    workspaceSlug: varchar("workspace_slug", { length: 80 }).notNull(),
    userId: varchar("user_id", { length: 32 }).notNull(),
    actorKind: varchar("actor_kind", { length: 32 }).notNull(),
    actorId: varchar("actor_id", { length: 32 }).notNull(),
    scopeJson: text("scope_json").default("[]").notNull(),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("oauth_grants_active_user_identity_idx")
      .on(
        table.clientId,
        table.resource,
        table.workspaceId,
        table.userId,
        table.actorKind,
        table.actorId,
      )
      .where(sql`${table.status} = 'active' and ${table.actorKind} = 'user'`),
    uniqueIndex("oauth_grants_active_agent_identity_idx")
      .on(table.clientId, table.resource, table.workspaceId, table.actorKind, table.actorId)
      .where(sql`${table.status} = 'active' and ${table.actorKind} = 'agent'`),
    index("oauth_grants_user_status_idx").on(table.userId, table.status),
    index("oauth_grants_workspace_status_idx").on(table.workspaceId, table.status),
  ],
)

export const oauthAccessTokens = pgTable(
  "oauth_access_tokens",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("oat")),
    tokenHash: text("token_hash").notNull(),
    grantId: varchar("grant_id", { length: 32 }).notNull(),
    workspaceId: varchar("workspace_id", { length: 32 }).notNull(),
    workspaceSlug: varchar("workspace_slug", { length: 80 }).notNull(),
    userId: varchar("user_id", { length: 32 }).notNull(),
    actorKind: varchar("actor_kind", { length: 32 }).notNull(),
    actorId: varchar("actor_id", { length: 32 }).notNull(),
    resource: text("resource").notNull(),
    scopeJson: text("scope_json").default("[]").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("oauth_access_tokens_token_hash_idx").on(table.tokenHash),
    index("oauth_access_tokens_grant_idx").on(table.grantId),
    index("oauth_access_tokens_workspace_idx").on(table.workspaceId),
    index("oauth_access_tokens_resource_expires_idx").on(table.resource, table.expiresAt),
  ],
)

export const oauthRefreshTokens = pgTable(
  "oauth_refresh_tokens",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("ort")),
    tokenHash: text("token_hash").notNull(),
    grantId: varchar("grant_id", { length: 32 }).notNull(),
    workspaceId: varchar("workspace_id", { length: 32 }).notNull(),
    workspaceSlug: varchar("workspace_slug", { length: 80 }).notNull(),
    userId: varchar("user_id", { length: 32 }).notNull(),
    actorKind: varchar("actor_kind", { length: 32 }).notNull(),
    actorId: varchar("actor_id", { length: 32 }).notNull(),
    tokenFamilyId: varchar("token_family_id", { length: 32 }).notNull(),
    parentTokenId: varchar("parent_token_id", { length: 32 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    reuseDetectedAt: timestamp("reuse_detected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("oauth_refresh_tokens_token_hash_idx").on(table.tokenHash),
    index("oauth_refresh_tokens_grant_idx").on(table.grantId),
    index("oauth_refresh_tokens_family_idx").on(table.tokenFamilyId),
    index("oauth_refresh_tokens_workspace_idx").on(table.workspaceId),
  ],
)
