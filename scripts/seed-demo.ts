import "dotenv/config"

import postgres from "postgres"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  log("error", "demo_seed_config_missing", { variable: "DATABASE_URL" })
  process.exit(1)
}

const sql = postgres(databaseUrl, { max: 1 })

try {
  log("info", "demo_seed_start", {})
  await seedDemo()
  log("info", "demo_seed_success", {})
} catch (error) {
  log("error", "demo_seed_failure", {
    error: error instanceof Error ? error.message : String(error),
  })
  throw error
} finally {
  await sql.end()
}

async function seedDemo() {
  const [workspace] = await sql<{ id: string; workspace_slug: string }[]>`
    insert into workspaces (id, workspace_slug, workspace_name, status, metadata_json)
    values ('wrk_demo_core', 'core', 'Core', 'active', '{"demo":true}')
    on conflict (workspace_slug) do update
      set workspace_name = excluded.workspace_name,
          status = 'active',
          updated_at = now()
    returning id, workspace_slug
  `
  if (!workspace) throw new Error("Failed to seed demo workspace")

  const [user] = await sql<{ id: string }[]>`
    insert into users (
      id,
      display_name,
      email,
      email_normalized,
      email_verified_at,
      status,
      metadata_json
    )
    values (
      'usr_demo_michael',
      'Michael',
      'you@example.com',
      'you@example.com',
      now(),
      'active',
      '{"demo":true}'
    )
    on conflict (email_normalized) do update
      set display_name = excluded.display_name,
          email = excluded.email,
          email_verified_at = coalesce(users.email_verified_at, excluded.email_verified_at),
          status = 'active',
          updated_at = now()
    returning id
  `
  if (!user) throw new Error("Failed to seed demo user")

  await sql`
    insert into workspace_memberships (
      id,
      workspace_id,
      workspace_slug,
      principal_kind,
      principal_id,
      role,
      status
    )
    values (
      'mbr_demo_core_admin',
      ${workspace.id},
      ${workspace.workspace_slug},
      'user',
      ${user.id},
      'workspace_admin',
      'active'
    )
    on conflict (workspace_id, principal_kind, principal_id) do update
      set role = excluded.role,
          status = excluded.status,
          updated_at = now()
  `
}

function log(level: "error" | "info", event: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ event, level, ...fields }))
}
