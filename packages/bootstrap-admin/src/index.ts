#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { createDbClient } from "@contextbase/core"
import { bootstrapWorkspaceAdmin } from "@contextbase/core/domains/auth/bootstrap"
import { config as loadDotenv } from "dotenv"
import { Effect } from "effect"

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(PACKAGE_ROOT, "../../..")

export type BootstrapCommandArgs = {
  json: boolean
  userName: string
  workspaceName: string
  workspaceSlug: string
}

export function parseBootstrapArgs(args: string[]): BootstrapCommandArgs {
  const parsed: BootstrapCommandArgs = {
    json: false,
    userName: "Admin",
    workspaceName: "Core",
    workspaceSlug: "core",
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === "--") continue
    if (arg === "--json") {
      parsed.json = true
      continue
    }
    if (arg === "--workspace-slug") {
      parsed.workspaceSlug = requireValue(args, index)
      index += 1
      continue
    }
    if (arg === "--workspace-name") {
      parsed.workspaceName = requireValue(args, index)
      index += 1
      continue
    }
    if (arg === "--user-name") {
      parsed.userName = requireValue(args, index)
      index += 1
      continue
    }

    throw new Error(`Unknown bootstrap argument: ${arg}`)
  }

  return parsed
}

function requireValue(args: string[], index: number) {
  const value = args[index + 1]
  if (!value) throw new Error(`Missing value for ${args[index]}`)
  return value
}

export function ensureRepoRootExecution(cwd = process.cwd()) {
  if (path.resolve(cwd) !== REPO_ROOT) {
    throw new Error(`Run bootstrap from the repository root: ${REPO_ROOT}`)
  }
}

export function loadRepoEnv() {
  const envPath = path.join(REPO_ROOT, ".env")
  if (fs.existsSync(envPath)) {
    loadDotenv({ path: envPath, override: false, quiet: true })
  }
  const databaseUrl = process.env.DATABASE_URL ?? ""
  if (!databaseUrl) {
    throw new Error(`Missing DATABASE_URL in ${envPath}`)
  }
  return { databaseUrl, envPath }
}

export async function runBootstrapCommand(args: string[]) {
  ensureRepoRootExecution()
  const parsed = parseBootstrapArgs(args)
  loadRepoEnv()
  const client = createDbClient()

  try {
    const result = await Effect.runPromise(
      bootstrapWorkspaceAdmin(client, {
        userName: parsed.userName,
        workspaceName: parsed.workspaceName,
        workspaceSlug: parsed.workspaceSlug,
      }),
    )

    if (parsed.json) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      console.log(`workspace_id=${result.workspaceId}`)
      console.log(`workspace_slug=${result.workspaceSlug}`)
      console.log(`user_id=${result.userId}`)
      console.log(`api_token=${result.apiToken}`)
    }
  } finally {
    await client.end()
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  if (command !== "bootstrap") {
    throw new Error(
      "Usage: vertical-bootstrap-admin bootstrap --workspace-slug <slug> --workspace-name <name> --user-name <name> [--json]",
    )
  }
  await runBootstrapCommand(args)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
