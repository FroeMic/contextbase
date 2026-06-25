import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { Effect } from "effect"

import { InvalidRequestError } from "../../shared/errors"

export type OAuthScope =
  | "contextbase:read"
  | "contextbase:write"
  | "contextbase:files"
  | "contextbase:manage"
  | "offline_access"

const scopeOrder: OAuthScope[] = [
  "contextbase:read",
  "contextbase:write",
  "contextbase:files",
  "contextbase:manage",
  "offline_access",
]

const knownScopes = new Set<string>(scopeOrder)

export type OAuthAuthorizationRequestInput = {
  clientId: string
  codeChallenge: string
  codeChallengeMethod: string
  redirectUri: string
  resource: string
  responseType: string
  scopes: string[]
  state: string
}

export type OAuthAuthorizationRequestValidationOptions = {
  allowedResources: string[]
}

const loopbackRedirectHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"])
const allowedCustomSchemeRedirectUris = new Set(["cursor://anysphere.cursor-mcp/oauth/callback"])

export function normalizeOAuthScopes(
  scopes: string[],
): Effect.Effect<OAuthScope[], InvalidRequestError> {
  const unknownScope = scopes.find((scope) => !knownScopes.has(scope))
  if (unknownScope) {
    return Effect.fail(
      new InvalidRequestError({
        code: "invalid_request",
        details: { scope: unknownScope },
        message: "Unknown OAuth scope",
      }),
    )
  }

  const requestedScopes = new Set(scopes)
  return Effect.succeed(scopeOrder.filter((scope) => requestedScopes.has(scope)))
}

export function validateOAuthAuthorizationRequest(
  input: OAuthAuthorizationRequestInput,
  options: OAuthAuthorizationRequestValidationOptions,
): Effect.Effect<OAuthAuthorizationRequestInput & { scopes: OAuthScope[] }, InvalidRequestError> {
  if (input.responseType !== "code") {
    return invalidAuthorizationRequest("OAuth response_type must be code")
  }

  if (input.codeChallengeMethod !== "S256") {
    return invalidAuthorizationRequest("OAuth PKCE code_challenge_method must be S256")
  }

  if (!input.codeChallenge) {
    return invalidAuthorizationRequest("OAuth PKCE code_challenge is required")
  }

  if (!input.state) {
    return invalidAuthorizationRequest("OAuth state is required")
  }

  if (!options.allowedResources.includes(input.resource)) {
    return invalidAuthorizationRequest("OAuth resource is not allowed", {
      resource: input.resource,
    })
  }

  if (!isAllowedRedirectUri(input.redirectUri)) {
    return invalidAuthorizationRequest("OAuth redirect_uri must be an HTTPS or loopback URL", {
      redirectUri: input.redirectUri,
    })
  }

  return Effect.map(normalizeOAuthScopes(input.scopes), (scopes) => ({
    ...input,
    scopes,
  }))
}

export function createOAuthAuthorizationCode() {
  return createOpaqueToken("oa_code")
}

export function createOAuthAccessToken() {
  return createOpaqueToken("vca")
}

export function createOAuthRefreshToken() {
  return createOpaqueToken("vcr")
}

export function hashOAuthToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function verifyOAuthToken(token: string, tokenHash: string) {
  const actual = Buffer.from(hashOAuthToken(token), "hex")
  const expected = Buffer.from(tokenHash, "hex")

  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function verifyPkceChallenge(verifier: string, challenge: string) {
  const actualChallenge = createHash("sha256").update(verifier).digest("base64url")
  const actual = Buffer.from(actualChallenge)
  const expected = Buffer.from(challenge)

  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function createOpaqueToken(prefix: string) {
  return `${prefix}_${randomBytes(32).toString("base64url")}`
}

function isAllowedRedirectUri(redirectUri: string) {
  if (allowedCustomSchemeRedirectUris.has(redirectUri)) return true

  let url: URL
  try {
    url = new URL(redirectUri)
  } catch {
    return false
  }

  if (url.username || url.password) return false
  if (url.protocol === "https:") return true
  return url.protocol === "http:" && loopbackRedirectHosts.has(url.hostname) && url.port.length > 0
}

function invalidAuthorizationRequest(message: string, details?: Record<string, unknown>) {
  return Effect.fail(
    new InvalidRequestError({
      code: "invalid_request",
      ...(details ? { details } : {}),
      message,
    }),
  )
}
