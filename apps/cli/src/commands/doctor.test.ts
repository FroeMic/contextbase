import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

import { saveCliOAuthCredential } from "../auth-config.js"
import { createCliRegistrationContext, registerCommands } from "../registry.js"
import { createRootCommand } from "../root.js"
import { createAuthCommand } from "./auth.js"
import { createDoctorCommand } from "./doctor.js"

describe("utility commander commands", () => {
  test("doctor --json checks health and auth probe", async () => {
    const output: string[] = []
    const requests: Array<{ input: string; token?: string }> = []
    const root = createRootCommand()
    const context = createCliRegistrationContext()

    root.exitOverride()
    root.configureOutput({
      writeOut: (message) => output.push(message),
      writeErr: (message) => output.push(message),
    })

    registerCommands(
      root,
      [
        createDoctorCommand({
          fetch: async (input, init) => {
            const token = (init?.headers as Record<string, string> | undefined)?.authorization
            requests.push({
              input: String(input),
              ...(token ? { token } : {}),
            })
            return new Response(JSON.stringify({ ok: true, data: { status: "ok" } }))
          },
        }),
      ],
      context,
    )

    await root.parseAsync([
      "node",
      "contextbase",
      "--api-url",
      "http://local.test",
      "--token",
      "token_123",
      "doctor",
      "--json",
    ])

    expect(requests).toEqual([
      { input: "http://local.test/healthz", token: "Bearer token_123" },
      { input: "http://local.test/api/v1/auth/probe", token: "Bearer token_123" },
    ])
    expect(JSON.parse(output.join(""))).toEqual({
      data: {
        apiUrl: "http://local.test",
        auth: { ok: true },
        health: { ok: true },
        token: { present: true },
      },
      ok: true,
    })
  })

  test("auth probe --json calls the auth probe endpoint", async () => {
    const output: string[] = []
    const requests: string[] = []
    const root = createRootCommand()
    const context = createCliRegistrationContext()

    root.exitOverride()
    root.configureOutput({
      writeOut: (message) => output.push(message),
      writeErr: (message) => output.push(message),
    })

    registerCommands(
      root,
      [
        createAuthCommand({
          fetch: async (input) => {
            requests.push(String(input))
            return new Response(
              JSON.stringify({
                ok: true,
                data: { principalId: "usr_123", workspaceId: "wrk_123" },
              }),
            )
          },
        }),
      ],
      context,
    )

    await root.parseAsync([
      "node",
      "contextbase",
      "--api-url",
      "http://local.test",
      "--token",
      "token_123",
      "auth",
      "probe",
      "--json",
    ])

    expect(requests).toEqual(["http://local.test/api/v1/auth/probe"])
    expect(JSON.parse(output.join(""))).toEqual({
      data: { principalId: "usr_123", workspaceId: "wrk_123" },
      ok: true,
    })
  })

  test("auth login exchanges an OAuth code and stores credentials", async () => {
    const dir = await mkdtemp(join(tmpdir(), "contextbase-cli-auth-command-"))
    const previousConfigPath = process.env.CONTEXTBASE_CONFIG_PATH
    const output: string[] = []
    const requests: Array<{ body: string; input: string }> = []
    const root = createRootCommand()
    const context = createCliRegistrationContext()

    try {
      process.env.CONTEXTBASE_CONFIG_PATH = join(dir, "config.json")
      root.exitOverride()
      root.configureOutput({
        writeOut: (message) => output.push(message),
        writeErr: (message) => output.push(message),
      })

      registerCommands(
        root,
        [
          createAuthCommand({
            fetch: async (input, init) => {
              requests.push({ body: String(init?.body), input: String(input) })
              return new Response(
                JSON.stringify({
                  access_token: "vca_login",
                  expires_in: 3600,
                  refresh_token: "vcr_login",
                  scope: "contextbase:read contextbase:write offline_access",
                  token_type: "Bearer",
                }),
              )
            },
          }),
        ],
        context,
      )

      await root.parseAsync([
        "node",
        "contextbase",
        "--api-url",
        "http://127.0.0.1:3017",
        "auth",
        "login",
        "--auth-url",
        "http://127.0.0.1:3317",
        "--code",
        "oa_code_test",
        "--code-verifier",
        "verifier",
        "--json",
      ])

      expect(requests[0]?.input).toBe("http://127.0.0.1:3317/oauth/token")
      expect(Object.fromEntries(new URLSearchParams(requests[0]?.body))).toEqual({
        client_id: "contextbase-cli",
        code: "oa_code_test",
        code_verifier: "verifier",
        grant_type: "authorization_code",
        redirect_uri: "http://127.0.0.1:48117/oauth/callback",
        resource: "http://127.0.0.1:3017/api/v1",
      })
      expect(JSON.parse(output.join(""))).toMatchObject({
        data: {
          authKind: "oauth",
          apiUrl: "http://127.0.0.1:3017",
          scopes: ["contextbase:read", "contextbase:write", "offline_access"],
        },
        ok: true,
      })
    } finally {
      if (previousConfigPath === undefined) {
        delete process.env.CONTEXTBASE_CONFIG_PATH
      } else {
        process.env.CONTEXTBASE_CONFIG_PATH = previousConfigPath
      }
      await rm(dir, { force: true, recursive: true })
    }
  })

  test("auth login defaults to the local OAuth API resource", async () => {
    const previousApiUrl = process.env.CONTEXTBASE_API_URL
    const output: string[] = []
    const root = createRootCommand()
    const context = createCliRegistrationContext()

    try {
      delete process.env.CONTEXTBASE_API_URL
      root.exitOverride()
      root.configureOutput({
        writeOut: (message) => output.push(message),
        writeErr: (message) => output.push(message),
      })

      registerCommands(root, [createAuthCommand()], context)

      await root.parseAsync(["node", "contextbase", "auth", "login", "--json"])

      const data = JSON.parse(output.join("")).data as { authorizationUrl: string }
      const authorizationUrl = new URL(data.authorizationUrl)

      expect(authorizationUrl.searchParams.get("resource")).toBe("http://127.0.0.1:3017/api/v1")
    } finally {
      if (previousApiUrl === undefined) {
        delete process.env.CONTEXTBASE_API_URL
      } else {
        process.env.CONTEXTBASE_API_URL = previousApiUrl
      }
    }
  })

  test("auth probe uses stored OAuth access token when no token flag is provided", async () => {
    const dir = await mkdtemp(join(tmpdir(), "contextbase-cli-auth-command-"))
    const previousConfigPath = process.env.CONTEXTBASE_CONFIG_PATH
    const previousApiToken = process.env.CONTEXTBASE_API_TOKEN
    const output: string[] = []
    const requests: Array<{ input: string; token?: string }> = []
    const root = createRootCommand()
    const context = createCliRegistrationContext()

    try {
      process.env.CONTEXTBASE_CONFIG_PATH = join(dir, "config.json")
      delete process.env.CONTEXTBASE_API_TOKEN
      await saveCliOAuthCredential({
        accessToken: "vca_stored",
        apiUrl: "http://local.test",
        authBaseUrl: "http://127.0.0.1:3317",
        clientId: "contextbase-cli",
        expiresAt: "2099-06-02T13:00:00.000Z",
        refreshToken: "vcr_stored",
        resource: "http://local.test/api/v1",
        scopes: ["contextbase:read"],
      })
      root.exitOverride()
      root.configureOutput({
        writeOut: (message) => output.push(message),
        writeErr: (message) => output.push(message),
      })

      registerCommands(
        root,
        [
          createAuthCommand({
            fetch: async (input, init) => {
              const token = (init?.headers as Record<string, string> | undefined)?.authorization
              requests.push({ input: String(input), ...(token ? { token } : {}) })
              return new Response(
                JSON.stringify({
                  ok: true,
                  data: { authKind: "oauth_access_token", principalId: "usr_123" },
                }),
              )
            },
          }),
        ],
        context,
      )

      await root.parseAsync([
        "node",
        "contextbase",
        "--api-url",
        "http://local.test",
        "auth",
        "probe",
        "--json",
      ])

      expect(requests).toEqual([
        { input: "http://local.test/api/v1/auth/probe", token: "Bearer vca_stored" },
      ])
    } finally {
      if (previousConfigPath === undefined) {
        delete process.env.CONTEXTBASE_CONFIG_PATH
      } else {
        process.env.CONTEXTBASE_CONFIG_PATH = previousConfigPath
      }
      if (previousApiToken === undefined) {
        delete process.env.CONTEXTBASE_API_TOKEN
      } else {
        process.env.CONTEXTBASE_API_TOKEN = previousApiToken
      }
      await rm(dir, { force: true, recursive: true })
    }
  })

  test("auth probe does not send stored OAuth credentials to a different API URL", async () => {
    const dir = await mkdtemp(join(tmpdir(), "contextbase-cli-auth-command-"))
    const previousConfigPath = process.env.CONTEXTBASE_CONFIG_PATH
    const previousApiToken = process.env.CONTEXTBASE_API_TOKEN
    const output: string[] = []
    const requests: Array<{ input: string; token?: string }> = []
    const root = createRootCommand()
    const context = createCliRegistrationContext()

    try {
      process.env.CONTEXTBASE_CONFIG_PATH = join(dir, "config.json")
      delete process.env.CONTEXTBASE_API_TOKEN
      await saveCliOAuthCredential({
        accessToken: "vca_production",
        apiUrl: "https://api.contextbase.localhost",
        authBaseUrl: "https://contextbase.localhost",
        clientId: "contextbase-cli",
        expiresAt: "2099-06-02T13:00:00.000Z",
        refreshToken: "vcr_production",
        resource: "https://api.contextbase.localhost/api/v1",
        scopes: ["contextbase:read"],
      })
      root.exitOverride()
      root.configureOutput({
        writeOut: (message) => output.push(message),
        writeErr: (message) => output.push(message),
      })

      registerCommands(
        root,
        [
          createAuthCommand({
            fetch: async (input, init) => {
              const token = (init?.headers as Record<string, string> | undefined)?.authorization
              requests.push({ input: String(input), ...(token ? { token } : {}) })
              return new Response(
                JSON.stringify({
                  ok: true,
                  data: { authKind: "api_token", principalId: "usr_123" },
                }),
              )
            },
          }),
        ],
        context,
      )

      await root.parseAsync([
        "node",
        "contextbase",
        "--api-url",
        "https://api.staging.contextbase.localhost",
        "auth",
        "probe",
        "--json",
      ])

      expect(requests).toEqual([
        { input: "https://api.staging.contextbase.localhost/api/v1/auth/probe" },
      ])
    } finally {
      if (previousConfigPath === undefined) {
        delete process.env.CONTEXTBASE_CONFIG_PATH
      } else {
        process.env.CONTEXTBASE_CONFIG_PATH = previousConfigPath
      }
      if (previousApiToken === undefined) {
        delete process.env.CONTEXTBASE_API_TOKEN
      } else {
        process.env.CONTEXTBASE_API_TOKEN = previousApiToken
      }
      await rm(dir, { force: true, recursive: true })
    }
  })
})
