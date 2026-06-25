import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve } from "node:path"

import { describe, expect, test } from "vitest"

import { saveCliOAuthCredential } from "./auth-config.js"
import { createPublicCliCommand } from "./public-cli.js"

describe("public CLI command surface", () => {
  test("registers only approved Contextbase command groups", async () => {
    const { output, root } = createTestPublicCli()

    await root.parseAsync(["node", "contextbase", "commands", "--json"])

    const data = JSON.parse(output.join("")).data as Array<{ path: string[] }>
    const groups = new Set(data.map((metadata) => metadata.path[0]))

    expect([...groups].sort()).toEqual([
      "auth",
      "commands",
      "doctor",
      "files",
      "invitations",
      "members",
      "workspaces",
    ])
  })

  test("removed copied command groups use normal unknown command behavior", async () => {
    const { root } = createTestPublicCli()

    for (const argv of [
      ["runtime", "queue", "list", "--json"],
      ["chats", "conversations", "list", "--json"],
      ["tasks", "list", "--json"],
      ["businesses", "list", "--json"],
      ["agents", "list", "--json"],
    ]) {
      await expect(root.parseAsync(["node", "contextbase", ...argv])).rejects.toMatchObject({
        code: "commander.unknownCommand",
        exitCode: 1,
      })
    }
  })

  test("root help lists only registered public commands", async () => {
    const { output, root } = createTestPublicCli()

    await ignoreHelpExit(root.parseAsync(["node", "contextbase", "--help"]))

    const rootHelp = output.join("")
    expect(rootHelp).toContain("workspaces")
    expect(rootHelp).toContain("members")
    expect(rootHelp).toContain("invitations")
    expect(rootHelp).toContain("files")
    expect(rootHelp).toContain("doctor")
    expect(rootHelp).not.toContain("businesses")
    expect(rootHelp).not.toContain("tasks")
    expect(rootHelp).not.toContain("agents")
  })

  test("every registered command example uses contextbase and passes dry-run validation", async () => {
    const { output, root } = createTestPublicCli()

    await root.parseAsync(["node", "contextbase", "commands", "--json"])

    const data = JSON.parse(output.join("")).data as Array<{ examples: string[] }>

    for (const metadata of data) {
      for (const example of metadata.examples) {
        expect(example).toMatch(/^contextbase\b/)
        const { output: exampleOutput, root: exampleRoot } = createTestPublicCli()
        const argv = ["node", "contextbase", "--dry-run", ...splitExample(example).slice(1)]

        await exampleRoot.parseAsync(argv)

        expect(JSON.parse(exampleOutput.join(""))).toMatchObject({ ok: true })
      }
    }
  })

  test("stored OAuth credentials are used by ordinary API commands", async () => {
    const dir = await mkdtemp(resolve(tmpdir(), "contextbase-public-cli-auth-"))
    const previousConfigPath = process.env.CONTEXTBASE_CONFIG_PATH
    const previousApiToken = process.env.CONTEXTBASE_API_TOKEN
    const calls: Array<{ input: string; token?: string }> = []

    try {
      process.env.CONTEXTBASE_CONFIG_PATH = resolve(dir, "config.json")
      delete process.env.CONTEXTBASE_API_TOKEN
      await saveCliOAuthCredential({
        accessToken: "vca_public",
        apiUrl: "http://local.test",
        authBaseUrl: "http://127.0.0.1:3317",
        clientId: "contextbase-cli",
        expiresAt: "2099-06-02T13:00:00.000Z",
        refreshToken: "vcr_public",
        resource: "http://local.test/api/v1",
        scopes: ["contextbase:read"],
      })
      const { root } = createTestPublicCli({
        fetch: async (input, init) => {
          const token = (init?.headers as Record<string, string> | undefined)?.authorization
          calls.push({ input: String(input), ...(token ? { token } : {}) })
          return new Response(JSON.stringify({ data: [], ok: true, page: { next_cursor: null } }))
        },
      })

      await root.parseAsync([
        "node",
        "contextbase",
        "--api-url",
        "http://local.test",
        "workspaces",
        "list",
        "--json",
      ])

      expect(calls).toContainEqual({
        input: "http://local.test/api/v1/workspaces",
        token: "Bearer vca_public",
      })
    } finally {
      restoreEnv("CONTEXTBASE_CONFIG_PATH", previousConfigPath)
      restoreEnv("CONTEXTBASE_API_TOKEN", previousApiToken)
      await rm(dir, { force: true, recursive: true })
    }
  })

  test("default OAuth credentials are used by default ordinary API commands", async () => {
    const dir = await mkdtemp(resolve(tmpdir(), "contextbase-public-cli-auth-"))
    const previousConfigPath = process.env.CONTEXTBASE_CONFIG_PATH
    const previousApiToken = process.env.CONTEXTBASE_API_TOKEN
    const calls: Array<{ input: string; token?: string }> = []

    try {
      process.env.CONTEXTBASE_CONFIG_PATH = resolve(dir, "config.json")
      delete process.env.CONTEXTBASE_API_TOKEN
      await saveCliOAuthCredential({
        accessToken: "vca_default",
        apiUrl: "http://127.0.0.1:3017",
        authBaseUrl: "http://127.0.0.1:3317",
        clientId: "contextbase-cli",
        expiresAt: "2099-06-02T13:00:00.000Z",
        refreshToken: "vcr_default",
        resource: "http://127.0.0.1:3017/api/v1",
        scopes: ["contextbase:read"],
      })
      const { root } = createTestPublicCli({
        fetch: async (input, init) => {
          const token = (init?.headers as Record<string, string> | undefined)?.authorization
          calls.push({ input: String(input), ...(token ? { token } : {}) })
          return new Response(JSON.stringify({ data: [], ok: true, page: { next_cursor: null } }))
        },
      })

      await root.parseAsync(["node", "contextbase", "workspaces", "list", "--json"])

      expect(calls).toContainEqual({
        input: "http://127.0.0.1:3017/api/v1/workspaces",
        token: "Bearer vca_default",
      })
    } finally {
      restoreEnv("CONTEXTBASE_CONFIG_PATH", previousConfigPath)
      restoreEnv("CONTEXTBASE_API_TOKEN", previousApiToken)
      await rm(dir, { force: true, recursive: true })
    }
  })

  test("stored OAuth credentials are not sent to a different API URL", async () => {
    const dir = await mkdtemp(resolve(tmpdir(), "contextbase-public-cli-auth-"))
    const previousConfigPath = process.env.CONTEXTBASE_CONFIG_PATH
    const previousApiToken = process.env.CONTEXTBASE_API_TOKEN
    const calls: Array<{ input: string; token?: string }> = []

    try {
      process.env.CONTEXTBASE_CONFIG_PATH = resolve(dir, "config.json")
      delete process.env.CONTEXTBASE_API_TOKEN
      await saveCliOAuthCredential({
        accessToken: "vca_production",
        apiUrl: "https://api.contextbase.example",
        authBaseUrl: "https://auth.contextbase.example",
        clientId: "contextbase-cli",
        expiresAt: "2099-06-02T13:00:00.000Z",
        refreshToken: "vcr_production",
        resource: "https://api.contextbase.example/api/v1",
        scopes: ["contextbase:read"],
      })
      const { root } = createTestPublicCli({
        fetch: async (input, init) => {
          const token = (init?.headers as Record<string, string> | undefined)?.authorization
          calls.push({ input: String(input), ...(token ? { token } : {}) })
          return new Response(JSON.stringify({ data: [], ok: true, page: { next_cursor: null } }))
        },
      })

      await root.parseAsync([
        "node",
        "contextbase",
        "--api-url",
        "https://api.staging.contextbase.example",
        "workspaces",
        "list",
        "--json",
      ])

      expect(calls).toContainEqual({
        input: "https://api.staging.contextbase.example/api/v1/workspaces",
      })
      expect(calls.some((call) => call.token === "Bearer vca_production")).toBe(false)
    } finally {
      restoreEnv("CONTEXTBASE_CONFIG_PATH", previousConfigPath)
      restoreEnv("CONTEXTBASE_API_TOKEN", previousApiToken)
      await rm(dir, { force: true, recursive: true })
    }
  })

  test("auth subcommands can run with stale stored OAuth credentials", async () => {
    const dir = await mkdtemp(resolve(tmpdir(), "contextbase-public-cli-auth-"))
    const previousConfigPath = process.env.CONTEXTBASE_CONFIG_PATH
    const previousApiToken = process.env.CONTEXTBASE_API_TOKEN
    let fetchCalls = 0

    try {
      process.env.CONTEXTBASE_CONFIG_PATH = resolve(dir, "config.json")
      delete process.env.CONTEXTBASE_API_TOKEN
      await saveCliOAuthCredential({
        accessToken: "vca_expired",
        apiUrl: "http://127.0.0.1:3017",
        authBaseUrl: "http://127.0.0.1:3317",
        clientId: "contextbase-cli",
        expiresAt: "2020-01-01T00:00:00.000Z",
        refreshToken: "vcr_revoked",
        resource: "http://127.0.0.1:3017/api/v1",
        scopes: ["contextbase:read"],
      })
      const { output, root } = createTestPublicCli({
        fetch: async () => {
          fetchCalls += 1
          throw new Error("stale OAuth credentials should not be refreshed for auth commands")
        },
      })

      await root.parseAsync(["node", "contextbase", "auth", "status", "--json"])

      expect(fetchCalls).toBe(0)
      expect(JSON.parse(output.join(""))).toMatchObject({
        data: {
          oauth: {
            apiUrl: "http://127.0.0.1:3017",
            hasRefreshToken: true,
          },
        },
        ok: true,
      })
    } finally {
      restoreEnv("CONTEXTBASE_CONFIG_PATH", previousConfigPath)
      restoreEnv("CONTEXTBASE_API_TOKEN", previousApiToken)
      await rm(dir, { force: true, recursive: true })
    }
  })
})

function createTestPublicCli(options: { fetch?: typeof fetch } = {}) {
  const output: string[] = []
  const root = createPublicCliCommand({
    fetch:
      options.fetch ??
      (async () =>
        new Response(JSON.stringify({ data: [], ok: true, page: { next_cursor: null } }))),
    output: {
      writeErr: (message) => output.push(message),
      writeOut: (message) => output.push(message),
    },
  })

  root.exitOverride()

  return { output, root }
}

function splitExample(example: string) {
  return example.match(/"[^"]*"|\S+/g)?.map((part) => part.replace(/^"|"$/g, "")) ?? []
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

async function ignoreHelpExit(parse: Promise<unknown>) {
  try {
    await parse
  } catch {
    // Commander exits after writing help when exitOverride is active in tests.
  }
}
