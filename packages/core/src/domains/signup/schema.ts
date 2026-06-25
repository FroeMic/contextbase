import { index, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core"

import { createId } from "../../shared/ids"

export const signupEmailVerifications = pgTable(
  "signup_email_verifications",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("sev")),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("signup_email_verifications_token_hash_idx").on(table.tokenHash),
    index("signup_email_verifications_email_expires_idx").on(
      table.emailNormalized,
      table.expiresAt,
    ),
  ],
)

export const onboardingSessions = pgTable(
  "onboarding_sessions",
  {
    id: varchar("id", { length: 32 })
      .primaryKey()
      .$defaultFn(() => createId("obs")),
    userId: varchar("user_id", { length: 32 }).notNull(),
    sessionTokenHash: text("session_token_hash").notNull(),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("onboarding_sessions_token_hash_idx").on(table.sessionTokenHash),
    index("onboarding_sessions_user_status_idx").on(table.userId, table.status),
  ],
)
