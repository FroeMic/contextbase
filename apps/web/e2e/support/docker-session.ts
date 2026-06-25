import { execFileSync } from "node:child_process"
import { createHash, randomBytes } from "node:crypto"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import type { Page } from "@playwright/test"

const e2eBaseURL =
  process.env.E2E_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_WEB_PORT ?? "4017"}`

export async function installDockerBrowserSession(
  page: Page,
  options: { resetTableKeys?: readonly string[] } = {},
): Promise<{ userId: string; workspaceId: string }> {
  const sessionToken = `pw_${randomBytes(24).toString("hex")}`
  const sessionHash = createHash("sha256").update(sessionToken, "utf8").digest("hex")
  const suffix = randomBytes(8).toString("hex")
  const sessionId = `ses_pw_${suffix}`
  const userId = `usr_pw_${suffix}`
  const workspaceId = queryDockerPostgres(
    `select w.id
     from workspaces w
     where w.workspace_slug = 'core'
     limit 1;`,
  ).trim()

  if (!workspaceId) {
    throw new Error("Demo workspace not found. Run docker compose migrate and seed first.")
  }

  queryDockerPostgres(
    `insert into users (id, display_name, email, email_normalized, status)
     values ('${userId}', 'Playwright User', 'pw-${suffix}@interaction42.com', 'pw-${suffix}@interaction42.com', 'active')
     on conflict (id) do nothing;`,
  )
  queryDockerPostgres(
    `insert into workspace_memberships (id, workspace_id, workspace_slug, principal_kind, principal_id, role, status)
     values ('mbr_pw_${suffix}', '${workspaceId}', 'core', 'user', '${userId}', 'workspace_admin', 'active')
     on conflict (workspace_id, principal_kind, principal_id) do update set
       role = excluded.role,
       status = excluded.status,
       updated_at = now();`,
  )
  if (options.resetTableKeys?.length) {
    const tableKeys = options.resetTableKeys
      .map((tableKey) => `'${tableKey.replaceAll("'", "''")}'`)
      .join(", ")
    queryDockerPostgres(
      `delete from ui_datatable_state where principal_id = '${userId}' and table_key in (${tableKeys});`,
    )
  }

  queryDockerPostgres(
    `insert into auth_sessions (id, user_id, active_workspace_id, active_workspace_slug, session_token_hash, status, expires_at)
     values ('${sessionId}', '${userId}', '${workspaceId}', 'core', '${sessionHash}', 'active', now() + interval '1 day')
     on conflict (session_token_hash) do nothing;`,
  )

  await page.context().addCookies([
    {
      httpOnly: true,
      name: "contextbase_session",
      sameSite: "Lax",
      url: e2eBaseURL,
      value: sessionToken,
    },
  ])

  return { userId, workspaceId }
}

export function queryDockerPostgres(sql: string) {
  const composeFiles = (process.env.E2E_DOCKER_COMPOSE_FILES ?? "")
    .split(":")
    .filter(Boolean)
    .flatMap((file) => ["-f", file])
  const composeProject = process.env.E2E_DOCKER_COMPOSE_PROJECT
    ? ["-p", process.env.E2E_DOCKER_COMPOSE_PROJECT]
    : []

  return execFileSync(
    "docker",
    [
      "compose",
      ...composeFiles,
      ...composeProject,
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      "contextbase",
      "-d",
      "contextbase",
      "-At",
      "-c",
      sql,
    ],
    {
      cwd: repoRoot(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  )
}

function repoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../..")
}
