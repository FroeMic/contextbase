#!/usr/bin/env node

import { execFileSync } from "node:child_process"

const DEFAULT_API_URL = "http://localhost:3017"
const apiUrl = process.env.CONTEXTBASE_API_URL ?? DEFAULT_API_URL
const apiToken = process.env.CONTEXTBASE_API_TOKEN ?? null

const state = {
  apiUrl,
  cliCommandCount: 0,
  workspaceCount: null,
}

await runSmoke()

async function runSmoke() {
  await step("healthz", async () => {
    await request("GET", "/healthz", null)
  })

  await step("public CLI command inventory", async () => {
    const commandMetadata = runCli(["commands", "--json"], false)
    const groups = new Set(commandMetadata.data.map((metadata) => metadata.path[0]))
    for (const disabled of ["runtime", "claim", "projects", "company"]) {
      if (groups.has(disabled)) throw new Error(`Disabled CLI group was registered: ${disabled}`)
    }
    state.cliCommandCount = commandMetadata.data.length
  })

  if (apiToken) {
    await step("workspace API read", async () => {
      const response = await request("GET", "/api/v1/workspaces", apiToken)
      state.workspaceCount = response.data.length
    })

    await step("authenticated CLI read", async () => {
      runCli(["workspaces", "list", "--json"], true)
    })
  }

  console.log(JSON.stringify({ status: "ok", ...state }, null, 2))
}

async function step(name, fn) {
  try {
    await fn()
  } catch (error) {
    console.error(`Smoke failed at step: ${name}`)
    throw error
  }
}

async function request(method, path, token) {
  const url = new URL(path, apiUrl).toString()
  const headers = {}
  if (token) headers.authorization = `Bearer ${token}`
  const response = await fetch(url, { headers, method })
  const responseBody = await readJson(response)

  if (!response.ok || responseBody?.ok === false) {
    throw new Error(
      [
        `${method} ${url} failed`,
        `status=${response.status}`,
        `body=${JSON.stringify(responseBody)}`,
      ].join(" "),
    )
  }

  return responseBody
}

function runCli(args, includeToken) {
  const env = {
    ...process.env,
    CONTEXTBASE_API_URL: apiUrl,
  }
  if (includeToken && apiToken) {
    env.CONTEXTBASE_API_TOKEN = apiToken
  }

  const output = execFileSync("node", ["apps/cli/dist/index.js", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env,
  })
  return parseJsonOutput(output)
}

async function readJson(response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function parseJsonOutput(output) {
  try {
    return JSON.parse(output)
  } catch {
    // Some helper commands emit diagnostics before a final single-line JSON object.
  }
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  for (const line of lines.toReversed()) {
    if (!line.startsWith("{") || !line.endsWith("}")) continue
    try {
      return JSON.parse(line)
    } catch {}
  }
  throw new Error(`Expected JSON object in command output: ${output}`)
}
