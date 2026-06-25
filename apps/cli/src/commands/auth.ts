import { createHash, randomBytes } from "node:crypto"
import { createApiClient } from "@contextbase/api-client"

import {
  clearCliOAuthCredential,
  exchangeOAuthCode,
  loadCliAuthConfig,
  parseScopeString,
  resolveConfiguredAccessToken,
  revokeOAuthToken,
  saveCliOAuthCredential,
} from "../auth-config.js"
import type { CliCommandModule } from "../registry.js"

type UtilityCommandOptions = {
  fetch?: typeof fetch
}

type CliGlobalOptions = {
  apiUrl?: string
  compact?: boolean
  dryRun?: boolean
  json?: boolean
  token?: string
}

export function createAuthCommand(options: UtilityCommandOptions = {}): CliCommandModule {
  return {
    metadata: {
      arguments: [],
      description: "Probe the configured API token and print the authenticated scope.",
      examples: ["contextbase auth probe --json"],
      id: "auth.probe",
      options: [
        {
          description: "Output JSON",
          name: "json",
          repeatable: false,
          required: false,
          type: "boolean",
        },
      ],
      output: {
        dryRun: true,
        json: true,
      },
      path: ["auth", "probe"],
      summary: "Probe API authentication",
    },
    register: (root) => {
      const auth = root.command("auth").description("Authentication utilities")
      const probe = auth
        .command("probe")
        .description("Probe API authentication")
        .option("--json", "Output JSON")
        .action(async () => {
          const globals = probe.optsWithGlobals() as CliGlobalOptions
          const request = {
            method: "GET",
            path: "/api/v1/auth/probe",
          }

          if (globals.dryRun) {
            writeJson(probe, { ok: true, data: request }, globals)
            return
          }

          const token = await resolveToken(globals, options.fetch)
          const client = createApiClient({
            baseUrl: resolveApiUrl(globals),
            ...(options.fetch ? { fetch: options.fetch } : {}),
            ...(token ? { token } : {}),
          })
          writeJson(probe, await client.get(request.path), globals)
        })
      const login = auth
        .command("login")
        .description("Authenticate the CLI with OAuth")
        .option("--auth-url <url>", "Contextbase auth service URL")
        .option("--client-id <id>", "OAuth client id")
        .option("--redirect-uri <uri>", "OAuth redirect URI")
        .option("--resource <resource>", "OAuth resource")
        .option("--scope <scope>", "OAuth scope string")
        .option("--code <code>", "Authorization code to exchange")
        .option("--code-verifier <verifier>", "PKCE verifier for the authorization code")
        .option("--json", "Output JSON")
        .action(async () => {
          const globals = login.optsWithGlobals() as CliGlobalOptions
          const locals = login.opts() as OAuthLoginOptions
          const authBaseUrl =
            locals.authUrl ?? process.env.CONTEXTBASE_AUTH_URL ?? "http://127.0.0.1:3317"
          const apiUrl = resolveApiUrl(globals)
          const clientId = locals.clientId ?? "contextbase-cli"
          const redirectUri = locals.redirectUri ?? "http://127.0.0.1:48117/oauth/callback"
          const resource = locals.resource ?? resolveApiResourceUrl(apiUrl)
          const scope =
            locals.scope ?? "contextbase:read contextbase:write contextbase:files offline_access"

          if (!locals.code) {
            const codeVerifier = createPkceVerifier()
            const authorizationUrl = new URL("/oauth/authorize", authBaseUrl)
            authorizationUrl.searchParams.set("response_type", "code")
            authorizationUrl.searchParams.set("client_id", clientId)
            authorizationUrl.searchParams.set("redirect_uri", redirectUri)
            authorizationUrl.searchParams.set("code_challenge", createPkceChallenge(codeVerifier))
            authorizationUrl.searchParams.set("code_challenge_method", "S256")
            authorizationUrl.searchParams.set("scope", scope)
            authorizationUrl.searchParams.set("state", createPkceVerifier())
            authorizationUrl.searchParams.set("resource", resource)
            writeJson(
              login,
              {
                ok: true,
                data: {
                  authorizationUrl: authorizationUrl.toString(),
                  codeVerifier,
                },
              },
              globals,
            )
            return
          }

          if (!locals.codeVerifier) {
            throw new Error("--code-verifier is required when --code is provided")
          }

          const tokenResponse = await exchangeOAuthCode(
            {
              authBaseUrl,
              clientId,
              code: locals.code,
              codeVerifier: locals.codeVerifier,
              redirectUri,
              resource,
            },
            options.fetch ?? fetch,
          )
          const credential = {
            accessToken: tokenResponse.access_token,
            apiUrl,
            authBaseUrl,
            clientId,
            expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString(),
            ...(tokenResponse.refresh_token ? { refreshToken: tokenResponse.refresh_token } : {}),
            resource,
            scopes: parseScopeString(tokenResponse.scope),
          }
          await saveCliOAuthCredential(credential)
          writeJson(
            login,
            {
              ok: true,
              data: {
                authKind: "oauth",
                apiUrl,
                expiresAt: credential.expiresAt,
                scopes: credential.scopes,
              },
            },
            globals,
          )
        })
      const refresh = auth
        .command("refresh")
        .description("Refresh stored OAuth credentials")
        .option("--json", "Output JSON")
        .action(async () => {
          const globals = refresh.optsWithGlobals() as CliGlobalOptions
          const token = await resolveConfiguredAccessToken({ fetch: options.fetch ?? fetch })
          const config = await loadCliAuthConfig()
          writeJson(
            refresh,
            {
              ok: true,
              data: {
                refreshed: Boolean(token),
                expiresAt: config.auth?.expiresAt ?? null,
              },
            },
            globals,
          )
        })
      const status = auth
        .command("status")
        .description("Show CLI authentication status")
        .option("--json", "Output JSON")
        .action(async () => {
          const globals = status.optsWithGlobals() as CliGlobalOptions
          const config = await loadCliAuthConfig()
          writeJson(
            status,
            {
              ok: true,
              data: {
                apiTokenPresent: Boolean(globals.token ?? process.env.CONTEXTBASE_API_TOKEN),
                oauth: config.auth
                  ? {
                      apiUrl: config.auth.apiUrl,
                      authBaseUrl: config.auth.authBaseUrl,
                      expiresAt: config.auth.expiresAt,
                      hasRefreshToken: Boolean(config.auth.refreshToken),
                      scopes: config.auth.scopes,
                    }
                  : null,
              },
            },
            globals,
          )
        })
      const logout = auth
        .command("logout")
        .description("Clear stored OAuth credentials")
        .option("--local-only", "Do not call the OAuth revocation endpoint")
        .option("--json", "Output JSON")
        .action(async () => {
          const globals = logout.optsWithGlobals() as CliGlobalOptions
          const locals = logout.opts() as { localOnly?: boolean }
          const config = await loadCliAuthConfig()
          const token = config.auth?.refreshToken ?? config.auth?.accessToken
          if (config.auth && token && !locals.localOnly) {
            await revokeOAuthToken(
              {
                authBaseUrl: config.auth.authBaseUrl,
                token,
              },
              options.fetch ?? fetch,
            )
          }
          await clearCliOAuthCredential()
          writeJson(logout, { ok: true, data: { loggedOut: true } }, globals)
        })
    },
  }
}

export const authCommand = createAuthCommand()

function resolveApiUrl(options: CliGlobalOptions) {
  return options.apiUrl ?? process.env.CONTEXTBASE_API_URL ?? "http://127.0.0.1:3017"
}

async function resolveToken(options: CliGlobalOptions, fetchImpl?: typeof fetch) {
  const apiUrl = resolveApiUrl(options)
  return (
    options.token ??
    process.env.CONTEXTBASE_API_TOKEN ??
    (await resolveConfiguredAccessToken({
      apiUrl,
      fetch: fetchImpl ?? fetch,
      resource: resolveApiResourceUrl(apiUrl),
    }))
  )
}

function writeJson(
  command: { configureOutput: () => { writeOut?: (message: string) => void } },
  value: unknown,
  options: CliGlobalOptions,
) {
  const indent = options.compact ? 0 : 2
  command.configureOutput().writeOut?.(`${JSON.stringify(value, null, indent)}\n`)
}

type OAuthLoginOptions = {
  authUrl?: string
  clientId?: string
  code?: string
  codeVerifier?: string
  redirectUri?: string
  resource?: string
  scope?: string
}

function resolveApiResourceUrl(apiUrl: string) {
  return new URL("/api/v1", apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`)
    .toString()
    .replace(/\/$/, "")
}

function createPkceVerifier() {
  return randomBytes(32).toString("base64url")
}

function createPkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url")
}
