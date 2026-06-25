import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

export type CliOAuthCredential = {
  accessToken: string
  apiUrl: string
  authBaseUrl: string
  clientId: string
  expiresAt: string
  refreshToken?: string
  resource: string
  scopes: string[]
}

export type CliAuthConfig = {
  auth?: CliOAuthCredential
}

export type CliConfigOptions = {
  configPath?: string
  env?: NodeJS.ProcessEnv
}

export type ResolveConfiguredAccessTokenOptions = CliConfigOptions & {
  apiUrl?: string
  fetch?: typeof fetch
  now?: Date
  resource?: string
}

export function getCliConfigPath(options: CliConfigOptions = {}) {
  const env = options.env ?? process.env
  return (
    options.configPath ??
    env.CONTEXTBASE_CONFIG_PATH ??
    join(homedir(), ".contextbase", "config.json")
  )
}

export async function loadCliAuthConfig(options: CliConfigOptions = {}): Promise<CliAuthConfig> {
  try {
    const text = await readFile(getCliConfigPath(options), "utf8")
    const value = JSON.parse(text) as unknown
    return isCliAuthConfig(value) ? value : {}
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return {}
    throw error
  }
}

export async function saveCliOAuthCredential(
  credential: CliOAuthCredential,
  options: CliConfigOptions = {},
) {
  const configPath = getCliConfigPath(options)
  const config = await loadCliAuthConfig(options)
  const nextConfig: CliAuthConfig = {
    ...config,
    auth: credential,
  }

  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, { mode: 0o600 })
}

export async function clearCliOAuthCredential(options: CliConfigOptions = {}) {
  const configPath = getCliConfigPath(options)
  const config = await loadCliAuthConfig(options)
  const nextConfig = { ...config }
  delete nextConfig.auth

  if (Object.keys(nextConfig).length === 0) {
    await rm(configPath, { force: true })
    return
  }

  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, { mode: 0o600 })
}

export async function resolveConfiguredAccessToken(
  options: ResolveConfiguredAccessTokenOptions = {},
) {
  const config = await loadCliAuthConfig(options)
  const credential = config.auth
  if (!credential) return undefined
  if (!credentialMatchesTarget(credential, options)) return undefined

  const now = options.now ?? new Date()
  if (new Date(credential.expiresAt).getTime() - 60_000 > now.getTime()) {
    return credential.accessToken
  }

  if (!credential.refreshToken) return undefined

  const tokenResponse = await refreshOAuthCredential(credential, options.fetch ?? fetch)
  await saveCliOAuthCredential(
    {
      ...credential,
      accessToken: tokenResponse.access_token,
      expiresAt: new Date(now.getTime() + tokenResponse.expires_in * 1000).toISOString(),
      refreshToken: tokenResponse.refresh_token ?? credential.refreshToken,
      scopes: parseScopeString(tokenResponse.scope),
    },
    options,
  )

  return tokenResponse.access_token
}

function credentialMatchesTarget(
  credential: CliOAuthCredential,
  options: ResolveConfiguredAccessTokenOptions,
) {
  if (options.apiUrl && normalizeUrl(credential.apiUrl) !== normalizeUrl(options.apiUrl)) {
    return false
  }
  if (options.resource && normalizeUrl(credential.resource) !== normalizeUrl(options.resource)) {
    return false
  }
  return true
}

function normalizeUrl(value: string) {
  const url = new URL(value)
  url.hash = ""
  url.search = ""
  return url.toString().replace(/\/$/, "")
}

export async function exchangeOAuthCode(
  input: {
    authBaseUrl: string
    clientId: string
    code: string
    codeVerifier: string
    redirectUri: string
    resource: string
  },
  fetchImpl: typeof fetch,
) {
  return postOAuthToken(
    input.authBaseUrl,
    new URLSearchParams({
      client_id: input.clientId,
      code: input.code,
      code_verifier: input.codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: input.redirectUri,
      resource: input.resource,
    }),
    fetchImpl,
  )
}

export async function revokeOAuthToken(
  input: { authBaseUrl: string; token: string },
  fetchImpl: typeof fetch,
) {
  await fetchImpl(new URL("/oauth/revoke", input.authBaseUrl), {
    body: new URLSearchParams({ token: input.token }),
    method: "POST",
  })
}

export function parseScopeString(scope: string) {
  return scope.split(/\s+/).filter(Boolean)
}

async function refreshOAuthCredential(credential: CliOAuthCredential, fetchImpl: typeof fetch) {
  return postOAuthToken(
    credential.authBaseUrl,
    new URLSearchParams({
      client_id: credential.clientId,
      refresh_token: credential.refreshToken ?? "",
      grant_type: "refresh_token",
      resource: credential.resource,
    }),
    fetchImpl,
  )
}

async function postOAuthToken(authBaseUrl: string, body: URLSearchParams, fetchImpl: typeof fetch) {
  const response = await fetchImpl(new URL("/oauth/token", authBaseUrl), {
    body,
    method: "POST",
  })
  const responseBody = (await response.json()) as Partial<OAuthTokenResponse>

  if (!response.ok || !responseBody.access_token || !responseBody.expires_in) {
    throw new Error("OAuth token exchange failed")
  }

  return {
    access_token: responseBody.access_token,
    expires_in: responseBody.expires_in,
    refresh_token: responseBody.refresh_token,
    scope: responseBody.scope ?? "",
    token_type: responseBody.token_type ?? "Bearer",
  }
}

type OAuthTokenResponse = {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope: string
  token_type: "Bearer"
}

function isCliAuthConfig(value: unknown): value is CliAuthConfig {
  if (typeof value !== "object" || value === null) return false
  const auth = (value as { auth?: unknown }).auth
  if (auth === undefined) return true
  return typeof auth === "object" && auth !== null && "accessToken" in auth
}
