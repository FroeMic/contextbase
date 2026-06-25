import { createId } from "../../shared/ids"
import type { OAuthScope } from "./service"

export type OAuthClientTokenEndpointAuthMethod = "none" | "client_secret_post"

export type OAuthClientRegistrationError = {
  error:
    | "invalid_client_metadata"
    | "invalid_grant_type"
    | "invalid_redirect_uri"
    | "invalid_response_type"
    | "invalid_scope"
  error_description: string
}

export type OAuthClientRegistrationInput = {
  client_name?: unknown
  client_uri?: unknown
  grant_types?: unknown
  redirect_uris?: unknown
  response_types?: unknown
  scope?: unknown
  token_endpoint_auth_method?: unknown
}

export type OAuthClientRegistrationRecordInput = {
  clientId: string
  clientName: string
  clientSecretExpiresAt?: Date | null
  clientSecretHash?: string | null
  clientUri: string | null
  grantTypes: string[]
  redirectUris: string[]
  responseTypes: string[]
  scopes: OAuthScope[]
  tokenEndpointAuthMethod: OAuthClientTokenEndpointAuthMethod
}

export type OAuthClientRegistrationResponse = {
  client_id: string
  client_id_issued_at: number
  client_name: string
  client_secret?: string
  client_secret_expires_at?: number
  client_uri?: string
  grant_types: string[]
  redirect_uris: string[]
  response_types: string[]
  scope: string
  token_endpoint_auth_method: OAuthClientTokenEndpointAuthMethod
}

export type OAuthClientRecord = OAuthClientRegistrationRecordInput & {
  status: string
}

type RegistrationOptions = {
  clientId?: string
  issuedAt: Date
}

type Result<T> =
  | {
      _tag: "Left"
      left: OAuthClientRegistrationError
    }
  | {
      _tag: "Right"
      right: T
    }

const defaultScopes: OAuthScope[] = [
  "contextbase:read",
  "contextbase:write",
  "contextbase:files",
  "offline_access",
]
const supportedScopes: OAuthScope[] = [...defaultScopes, "contextbase:manage"]
const supportedScopeSet = new Set<string>(supportedScopes)
const defaultGrantTypes = ["authorization_code", "refresh_token"]
const defaultResponseTypes = ["code"]
const supportedGrantTypes = new Set(defaultGrantTypes)
const supportedResponseTypes = new Set(defaultResponseTypes)
const supportedTokenEndpointAuthMethods = new Set<OAuthClientTokenEndpointAuthMethod>([
  "none",
  "client_secret_post",
])
const loopbackRedirectHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"])
const claudeCodeClientId = "https://claude.ai/oauth/claude-code-client-metadata"
const allowedCustomSchemeRedirectUris = new Set(["cursor://anysphere.cursor-mcp/oauth/callback"])

export function findStaticOAuthClient(clientId: string): OAuthClientRecord | null {
  if (clientId !== claudeCodeClientId) return null
  return {
    clientId,
    clientName: "Claude Code",
    clientUri: "https://claude.ai",
    grantTypes: defaultGrantTypes,
    redirectUris: [],
    responseTypes: defaultResponseTypes,
    scopes: supportedScopes,
    status: "active",
    tokenEndpointAuthMethod: "none",
  }
}

export function normalizeOAuthClientRegistration(
  input: OAuthClientRegistrationInput,
  options: RegistrationOptions,
): Result<{
  record: OAuthClientRegistrationRecordInput
  response: OAuthClientRegistrationResponse
}> {
  const redirectUris = normalizeRedirectUris(input.redirect_uris)
  if (redirectUris._tag === "Left") return redirectUris

  const grantTypes = normalizeStringArray(input.grant_types, defaultGrantTypes)
  if (!grantTypes.every((grantType) => supportedGrantTypes.has(grantType))) {
    return left("invalid_grant_type", "grant_types contains an unsupported grant type")
  }

  const responseTypes = normalizeStringArray(input.response_types, defaultResponseTypes)
  if (!responseTypes.every((responseType) => supportedResponseTypes.has(responseType))) {
    return left("invalid_response_type", "response_types contains an unsupported response type")
  }

  const tokenEndpointAuthMethod =
    typeof input.token_endpoint_auth_method === "string" ? input.token_endpoint_auth_method : "none"
  if (
    !supportedTokenEndpointAuthMethods.has(
      tokenEndpointAuthMethod as OAuthClientTokenEndpointAuthMethod,
    )
  ) {
    return left(
      "invalid_client_metadata",
      "token_endpoint_auth_method must be none or client_secret_post",
    )
  }
  const registeredTokenEndpointAuthMethod =
    tokenEndpointAuthMethod as OAuthClientTokenEndpointAuthMethod

  const scopes = normalizeScopeString(input.scope)
  if (scopes._tag === "Left") return scopes
  const registeredScopes = grantTypes.includes("refresh_token")
    ? [...new Set<OAuthScope>([...scopes.right, "offline_access"])]
    : scopes.right

  const clientName =
    typeof input.client_name === "string" && input.client_name.trim()
      ? input.client_name.trim().slice(0, 120)
      : "MCP client"
  const clientUri = normalizeOptionalHttpsUri(input.client_uri)
  if (clientUri._tag === "Left") return clientUri

  const clientId = options.clientId ?? createId("dcr")
  const record = {
    clientId,
    clientName,
    clientSecretExpiresAt: null,
    clientSecretHash: null,
    clientUri: clientUri.right,
    grantTypes,
    redirectUris: redirectUris.right,
    responseTypes,
    scopes: registeredScopes,
    tokenEndpointAuthMethod: registeredTokenEndpointAuthMethod,
  }

  return right({
    record,
    response: {
      client_id: clientId,
      client_id_issued_at: Math.floor(options.issuedAt.getTime() / 1000),
      client_name: clientName,
      ...(clientUri.right ? { client_uri: clientUri.right } : {}),
      grant_types: grantTypes,
      redirect_uris: redirectUris.right,
      response_types: responseTypes,
      scope: registeredScopes.join(" "),
      token_endpoint_auth_method: registeredTokenEndpointAuthMethod,
    },
  })
}

export function validateOAuthClientAuthorization(input: {
  client: OAuthClientRecord
  redirectUri: string
  responseType: string
  scopes: OAuthScope[]
}): Result<OAuthClientRecord> {
  if (input.client.status !== "active") {
    return left("invalid_client_metadata", "OAuth client is not active")
  }

  const redirectUriAllowed =
    input.client.redirectUris.length > 0
      ? input.client.redirectUris.includes(input.redirectUri)
      : isAllowedRedirectUri(input.redirectUri)
  if (!redirectUriAllowed) {
    return left("invalid_redirect_uri", "redirect_uri is not registered for this client")
  }

  if (!input.client.responseTypes.includes(input.responseType)) {
    return left("invalid_response_type", "response_type is not registered for this client")
  }

  const effectiveScopes = input.client.grantTypes.includes("refresh_token")
    ? [...new Set<OAuthScope>([...input.client.scopes, "offline_access"])]
    : input.client.scopes
  const registeredScopes = new Set(effectiveScopes)
  const unsupportedScope = input.scopes.find((scope) => !registeredScopes.has(scope))
  if (unsupportedScope) {
    return left("invalid_scope", "Requested scope is not registered for this client")
  }

  return right(input.client)
}

function normalizeRedirectUris(value: unknown): Result<string[]> {
  if (!Array.isArray(value) || value.length === 0) {
    return left("invalid_redirect_uri", "redirect_uris must contain at least one URI")
  }
  if (value.length > 10) {
    return left("invalid_redirect_uri", "redirect_uris must contain at most 10 URIs")
  }

  const redirectUris: string[] = []
  for (const item of value) {
    if (typeof item !== "string" || item.length > 2048) {
      return left("invalid_redirect_uri", "redirect_uris contains an invalid URI")
    }
    const normalized = normalizeRedirectUri(item)
    if (!normalized) {
      return left(
        "invalid_redirect_uri",
        "redirect_uris must contain allowed HTTPS or HTTP loopback URIs",
      )
    }
    redirectUris.push(normalized)
  }

  return right([...new Set(redirectUris)])
}

function normalizeRedirectUri(value: string) {
  if (allowedCustomSchemeRedirectUris.has(value)) return value

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }

  if (url.username || url.password) return null
  if (url.protocol === "https:") return url.href
  if (url.protocol !== "http:") return null
  if (!loopbackRedirectHosts.has(url.hostname) || !url.port) return null
  return url.href
}

function isAllowedRedirectUri(value: string) {
  return normalizeRedirectUri(value) === value
}

function normalizeOptionalHttpsUri(value: unknown): Result<string | null> {
  if (value === undefined || value === null || value === "") return right(null)
  if (typeof value !== "string" || value.length > 2048) {
    return left("invalid_client_metadata", "client_uri must be an HTTPS URI")
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return left("invalid_client_metadata", "client_uri must be an HTTPS URI")
  }

  if (url.protocol !== "https:" || url.username || url.password) {
    return left("invalid_client_metadata", "client_uri must be an HTTPS URI")
  }

  return right(url.href)
}

function normalizeScopeString(value: unknown): Result<OAuthScope[]> {
  const scopes =
    typeof value === "string" && value.trim() ? value.trim().split(/\s+/) : defaultScopes
  const unknownScope = scopes.find((scope) => !supportedScopeSet.has(scope))
  if (unknownScope) {
    return left("invalid_scope", "scope contains an unsupported scope")
  }

  return right(supportedScopes.filter((scope) => scopes.includes(scope)))
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback
  const strings = value.filter((item): item is string => typeof item === "string")
  return strings.length > 0 ? [...new Set(strings)] : fallback
}

function left(
  error: OAuthClientRegistrationError["error"],
  error_description: string,
): Result<never> {
  return {
    _tag: "Left",
    left: { error, error_description },
  }
}

function right<T>(value: T): Result<T> {
  return {
    _tag: "Right",
    right: value,
  }
}
