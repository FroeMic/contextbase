import { randomBytes, randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import type {
  BrowserAuthStore,
  BrowserSessionContext,
} from "@contextbase/core/domains/auth/browser-session"
import { validateBrowserSession } from "@contextbase/core/domains/auth/browser-session"
import type { OAuthClientRecord } from "@contextbase/core/domains/oauth/clients"
import {
  findStaticOAuthClient,
  normalizeOAuthClientRegistration,
  validateOAuthClientAuthorization,
} from "@contextbase/core/domains/oauth/clients"
import type {
  OAuthAuthorizationCodeRecord,
  OAuthRepository,
} from "@contextbase/core/domains/oauth/repository"
import type { OAuthScope } from "@contextbase/core/domains/oauth/service"
import {
  createOAuthAccessToken,
  createOAuthAuthorizationCode,
  createOAuthRefreshToken,
  hashOAuthToken,
  validateOAuthAuthorizationRequest,
  verifyOAuthToken,
  verifyPkceChallenge,
} from "@contextbase/core/domains/oauth/service"
import { mapAppErrorToHttp } from "@contextbase/core/shared/errors"
import { errorEnvelope, successEnvelope } from "@contextbase/core/shared/response"
import { Effect } from "effect"
import { Hono } from "hono"

export type CreateAuthAppOptions = {
  apiResourceUrl: string
  authBaseUrl: string
  browserAuthStore?: BrowserAuthStore
  logger?: AuthLogger
  mcpResourceUrl: string
  now?: () => Date
  oauthRepository?: OAuthRepository
  webBaseUrl: string
}

type AuthLogEntry = {
  event: string
  [key: string]: unknown
}

type AuthLogger = {
  error?: (entry: AuthLogEntry) => void
  info: (entry: AuthLogEntry) => void
  warn: (entry: AuthLogEntry) => void
}

const contextbaseScopes = [
  "contextbase:read",
  "contextbase:write",
  "contextbase:files",
  "contextbase:manage",
] as const
const supportedOAuthScopes = [...contextbaseScopes] satisfies OAuthScope[]
const accessTokenTtlSeconds = 60 * 60
const authorizationCodeTtlSeconds = 5 * 60
const authorizationRequestTtlSeconds = 5 * 60
const refreshTokenTtlSeconds = 60 * 60 * 24 * 30
const sessionCookieName = "contextbase_session"
const themeCookieName = "vertical-ui-theme"
const requestIds = new WeakMap<Request, string>()
const require = createRequire(import.meta.url)
const interFontPath = join(
  dirname(require.resolve("@fontsource-variable/inter/package.json")),
  "files/inter-latin-wght-normal.woff2",
)

export function createAuthApp(options: CreateAuthAppOptions) {
  const app = new Hono()

  app.get("/healthz", (context) =>
    context.json(
      successEnvelope({
        service: "auth",
        status: "ok",
      }),
      200,
    ),
  )

  app.get("/.well-known/oauth-authorization-server", (context) =>
    context.json(authorizationServerMetadata(options), 200),
  )

  app.get("/.well-known/openid-configuration", (context) =>
    context.json(authorizationServerMetadata(options), 200),
  )

  app.post("/oauth/register", async (context) => {
    const requestId = getRequestId(context.req.raw)
    logInfo(options, {
      event: "oauth.dcr.started",
      requestId,
      userAgent: context.req.header("user-agent") ?? null,
    })
    const contentLength = Number(context.req.header("content-length") ?? "0")
    if (contentLength > 32 * 1024) {
      logWarn(options, {
        event: "oauth.dcr.failed",
        oauthError: "invalid_client_metadata",
        reason: "metadata_too_large",
        requestId,
      })
      return context.json(
        oauthError("invalid_client_metadata", "OAuth client metadata is too large"),
        400,
        noStoreHeaders(),
      )
    }

    if (!options.oauthRepository) {
      logWarn(options, {
        event: "oauth.dcr.failed",
        oauthError: "invalid_request",
        reason: "storage_unavailable",
        requestId,
      })
      return context.json(
        oauthError("invalid_request", "OAuth client registration storage is unavailable"),
        400,
        noStoreHeaders(),
      )
    }

    let body: unknown
    try {
      body = await context.req.json()
    } catch {
      logWarn(options, {
        event: "oauth.dcr.failed",
        oauthError: "invalid_client_metadata",
        reason: "invalid_json",
        requestId,
      })
      return context.json(
        oauthError("invalid_client_metadata", "OAuth client metadata must be JSON"),
        400,
        noStoreHeaders(),
      )
    }

    const registration = normalizeOAuthClientRegistration(
      body && typeof body === "object" ? body : {},
      { issuedAt: getNow(options) },
    )
    if (registration._tag === "Left") {
      logWarn(options, {
        event: "oauth.dcr.failed",
        oauthDescription: registration.left.error_description,
        oauthError: registration.left.error,
        reason: "metadata_validation_failed",
        requestId,
      })
      return context.json(registration.left, 400, noStoreHeaders())
    }

    const clientSecret =
      registration.right.record.tokenEndpointAuthMethod === "client_secret_post"
        ? createOAuthClientSecret()
        : null
    const clientRecord = clientSecret
      ? {
          ...registration.right.record,
          clientSecretExpiresAt: null,
          clientSecretHash: hashOAuthToken(clientSecret),
        }
      : registration.right.record

    await options.oauthRepository.registerClient(clientRecord)
    logInfo(options, {
      clientId: clientRecord.clientId,
      clientName: clientRecord.clientName,
      event: "oauth.dcr.succeeded",
      grantTypes: clientRecord.grantTypes,
      redirectHosts: clientRecord.redirectUris.map(safeUrlHost),
      requestId,
      responseTypes: clientRecord.responseTypes,
      scopes: clientRecord.scopes,
      tokenEndpointAuthMethod: clientRecord.tokenEndpointAuthMethod,
    })
    return context.json(
      clientSecret
        ? {
            ...registration.right.response,
            client_secret: clientSecret,
            client_secret_expires_at: 0,
          }
        : registration.right.response,
      201,
      noStoreHeaders(),
    )
  })

  app.get("/.well-known/oauth-protected-resource/mcp", (context) =>
    context.json(protectedResourceMetadata(options.mcpResourceUrl, options.authBaseUrl), 200),
  )

  app.get("/.well-known/oauth-protected-resource/api", (context) =>
    context.json(protectedResourceMetadata(options.apiResourceUrl, options.authBaseUrl), 200),
  )

  app.get("/oauth/assets/inter-latin-wght-normal.woff2", async (context) => {
    const fontBytes = await readFile(interFontPath)
    return context.body(fontBytes, 200, {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "font/woff2",
    })
  })

  app.get("/oauth/authorize", async (context) => {
    const requestId = getRequestId(context.req.raw)
    const url = new URL(context.req.url)
    logInfo(options, {
      clientId: url.searchParams.get("client_id") ?? "",
      event: "oauth.authorize.started",
      redirectHost: safeUrlHost(url.searchParams.get("redirect_uri") ?? ""),
      requestId,
      resource: url.searchParams.get("resource") ?? "",
      scopes: parseScopeParam(url.searchParams.get("scope")),
      userAgent: context.req.header("user-agent") ?? null,
    })
    const result = await Effect.runPromiseExit(
      validateOAuthAuthorizationRequest(
        {
          clientId: url.searchParams.get("client_id") ?? "",
          codeChallenge: url.searchParams.get("code_challenge") ?? "",
          codeChallengeMethod: url.searchParams.get("code_challenge_method") ?? "",
          redirectUri: url.searchParams.get("redirect_uri") ?? "",
          resource: url.searchParams.get("resource") ?? "",
          responseType: url.searchParams.get("response_type") ?? "",
          scopes: parseScopeParam(url.searchParams.get("scope")),
          state: url.searchParams.get("state") ?? "",
        },
        {
          allowedResources: [options.apiResourceUrl, options.mcpResourceUrl],
        },
      ),
    )

    if (result._tag === "Failure") {
      const error = result.cause._tag === "Fail" ? result.cause.error : undefined
      if (error) {
        const mapped = mapAppErrorToHttp(error)
        logWarn(options, {
          clientId: url.searchParams.get("client_id") ?? "",
          event: "oauth.authorize.failed",
          oauthError: mapped.body.error.details.oauth_error ?? mapped.body.error.code,
          reason: "request_validation_failed",
          requestId,
          status: mapped.status,
        })
        return context.json(mapped.body, mapped.status)
      }
      logWarn(options, {
        clientId: url.searchParams.get("client_id") ?? "",
        event: "oauth.authorize.failed",
        reason: "internal_validation_failure",
        requestId,
        status: 500,
      })
      return context.json(errorEnvelope("internal_error", "Internal server error"), 500)
    }

    if (!options.oauthRepository) {
      logWarn(options, {
        clientId: result.value.clientId,
        event: "oauth.authorize.failed",
        oauthError: "invalid_request",
        reason: "storage_unavailable",
        requestId,
        status: 400,
      })
      return context.json(
        errorEnvelope("invalid_request", "OAuth request storage is unavailable"),
        400,
      )
    }

    const request = result.value
    const client = await loadOAuthClientForAuthorization(request, options.oauthRepository)
    if (!client.ok) {
      logWarn(options, {
        clientId: request.clientId,
        event: "oauth.authorize.failed",
        oauthError: client.body.error.details.oauth_error ?? client.body.error.code,
        reason: "client_validation_failed",
        redirectHost: safeUrlHost(request.redirectUri),
        requestId,
        resource: request.resource,
        scopes: request.scopes,
        status: client.status,
      })
      return context.json(client.body, client.status)
    }

    const now = getNow(options)
    const pendingRequest = await options.oauthRepository.createAuthorizationRequest({
      clientId: request.clientId,
      codeChallenge: request.codeChallenge,
      codeChallengeMethod: request.codeChallengeMethod,
      expiresAt: addSeconds(now, authorizationRequestTtlSeconds),
      redirectUri: request.redirectUri,
      resource: request.resource,
      scope: request.scopes,
      state: request.state,
      stateHash: hashOAuthToken(request.state),
    })
    logInfo(options, {
      clientId: request.clientId,
      event: "oauth.authorize.pending_request_created",
      oauthRequestId: pendingRequest.id,
      redirectHost: safeUrlHost(request.redirectUri),
      requestId,
      resource: request.resource,
      scopes: request.scopes,
    })
    const resumeUrl = `${options.authBaseUrl}/oauth/authorize/resume?request_id=${pendingRequest.id}`
    const loginUrl = new URL("/login", options.webBaseUrl)
    loginUrl.searchParams.set("redirect_to", resumeUrl)

    return context.redirect(loginUrl.toString(), 302)
  })

  app.get("/oauth/authorize/resume", async (context) => {
    const authContext = await getBrowserSessionContext(context.req.raw, options)
    if (!authContext.ok) return context.json(authContext.body, authContext.status)

    const request = await loadPendingAuthorizationRequest(
      context.req.query("request_id") ?? "",
      options,
      getNow(options),
    )
    if (!request.ok) return context.json(request.body, request.status)

    const principals = loadConsentPrincipals(authContext.value)
    return context.html(
      renderConsentPage(request.value, authContext.value, context.req.raw, principals),
      200,
    )
  })

  app.post("/oauth/consent", async (context) => {
    const authContext = await getBrowserSessionContext(context.req.raw, options)
    if (!authContext.ok) return context.json(authContext.body, authContext.status)

    if (!options.oauthRepository) {
      return context.json(errorEnvelope("invalid_request", "OAuth storage is unavailable"), 400)
    }

    const body = await context.req.parseBody()
    const action = bodyString(body.action)
    const request = await loadPendingAuthorizationRequest(
      bodyString(body.request_id),
      options,
      getNow(options),
    )
    if (!request.ok) return context.json(request.body, request.status)

    if (action === "deny") {
      const redirectUrl = new URL(request.value.redirectUri)
      redirectUrl.searchParams.set("error", "access_denied")
      redirectUrl.searchParams.set("error_description", "User denied access")
      redirectUrl.searchParams.set("state", request.value.state)
      return context.redirect(redirectUrl.toString(), 302)
    }

    if (action !== "approve") {
      return context.json(errorEnvelope("invalid_request", "Invalid OAuth consent action"), 400)
    }

    const actor = resolveSelectedActor(authContext.value, bodyString(body.principal))
    if (!actor.ok) return context.json(actor.body, actor.status)

    if (
      request.value.scope.includes("contextbase:manage") &&
      !canApproveAdminScope(authContext.value)
    ) {
      return context.json(
        errorEnvelope("forbidden", "Workspace admin access is required for admin OAuth grants"),
        403,
      )
    }

    const rawCode = createOAuthAuthorizationCode()
    await options.oauthRepository.createAuthorizationCode({
      actorId: actor.value.actorId,
      actorKind: actor.value.actorKind,
      clientId: request.value.clientId,
      codeChallengeHash: request.value.codeChallenge,
      codeHash: hashOAuthToken(rawCode),
      expiresAt: addSeconds(getNow(options), authorizationCodeTtlSeconds),
      redirectUri: request.value.redirectUri,
      resource: request.value.resource,
      scope: request.value.scope,
      userId: authContext.value.userId,
      workspaceId: authContext.value.activeWorkspaceId,
      workspaceSlug: authContext.value.activeWorkspaceSlug,
    })

    const redirectUrl = new URL(request.value.redirectUri)
    redirectUrl.searchParams.set("code", rawCode)
    redirectUrl.searchParams.set("state", request.value.state)
    return context.redirect(redirectUrl.toString(), 302)
  })

  app.post("/oauth/token", async (context) => {
    const body = await context.req.parseBody()
    const grantType = bodyString(body.grant_type)

    if (grantType !== "authorization_code" && grantType !== "refresh_token") {
      return context.json(oauthError("unsupported_grant_type", "Unsupported OAuth grant_type"), 400)
    }

    if (!options.oauthRepository) {
      return context.json(oauthError("invalid_request", "OAuth storage is unavailable"), 400)
    }

    const now = getNow(options)
    let result: RouteResult<OAuthTokenResponse>
    try {
      result =
        grantType === "authorization_code"
          ? await exchangeAuthorizationCode(options.oauthRepository, body, now)
          : await exchangeRefreshToken(options.oauthRepository, body, now)
    } catch {
      return context.json(oauthError("server_error", "OAuth token exchange failed"), 500)
    }

    if (!result.ok) return context.json(oauthErrorFromEnvelope(result.body), result.status)
    return context.json(result.value, 200)
  })

  app.post("/oauth/revoke", async (context) => {
    const body = await context.req.parseBody()
    const token = bodyString(body.token)
    if (options.oauthRepository && token) {
      await options.oauthRepository.revokeTokenByHash({
        revokedAt: getNow(options),
        tokenHash: hashOAuthToken(token),
      })
    }
    return context.json(successEnvelope({ revoked: true }), 200)
  })

  app.notFound((context) => context.json(errorEnvelope("not_found", "Route not found"), 404))

  return app
}

function authorizationServerMetadata(options: CreateAuthAppOptions) {
  return {
    issuer: options.authBaseUrl,
    authorization_endpoint: `${options.authBaseUrl}/oauth/authorize`,
    token_endpoint: `${options.authBaseUrl}/oauth/token`,
    revocation_endpoint: `${options.authBaseUrl}/oauth/revoke`,
    registration_endpoint: `${options.authBaseUrl}/oauth/register`,
    grant_types_supported: ["authorization_code", "refresh_token"],
    response_types_supported: ["code"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [...supportedOAuthScopes, "offline_access"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    client_id_metadata_document_supported: false,
  }
}

function protectedResourceMetadata(resource: string, authBaseUrl: string) {
  return {
    resource,
    authorization_servers: [authBaseUrl],
    scopes_supported: [...supportedOAuthScopes],
  }
}

function parseScopeParam(scope: string | null) {
  return scope?.split(/\s+/).filter(Boolean) ?? []
}

type RouteResult<T> =
  | { ok: true; value: T }
  | {
      body: ReturnType<typeof errorEnvelope>
      ok: false
      status: 400 | 401 | 403 | 404 | 409 | 422 | 500
    }

function oauthError(error: string, errorDescription: string) {
  return {
    error,
    error_description: errorDescription,
  }
}

function createOAuthClientSecret() {
  return `dcr_secret_${randomBytes(32).toString("base64url")}`
}

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store",
    Pragma: "no-cache",
  }
}

function getRequestId(request: Request) {
  const headerRequestId = request.headers.get("x-request-id")
  if (headerRequestId) return headerRequestId
  const existing = requestIds.get(request)
  if (existing) return existing
  const requestId = randomUUID()
  requestIds.set(request, requestId)
  return requestId
}

function logInfo(options: CreateAuthAppOptions, entry: AuthLogEntry) {
  ;(options.logger ?? defaultLogger).info(withService(entry))
}

function logWarn(options: CreateAuthAppOptions, entry: AuthLogEntry) {
  ;(options.logger ?? defaultLogger).warn(withService(entry))
}

function withService(entry: AuthLogEntry): AuthLogEntry {
  return {
    service: "auth",
    timestamp: new Date().toISOString(),
    ...entry,
  }
}

function safeUrlHost(value: string) {
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}`
  } catch {
    return null
  }
}

const defaultLogger: AuthLogger = {
  error: (entry) => {
    if (process.env.NODE_ENV !== "test") console.error(JSON.stringify(entry))
  },
  info: (entry) => {
    if (process.env.NODE_ENV !== "test") console.info(JSON.stringify(entry))
  },
  warn: (entry) => {
    if (process.env.NODE_ENV !== "test") console.warn(JSON.stringify(entry))
  },
}

async function loadOAuthClientForAuthorization(
  request: {
    clientId: string
    redirectUri: string
    responseType: string
    scopes: OAuthScope[]
  },
  repository: OAuthRepository,
) {
  const client =
    findStaticOAuthClient(request.clientId) ??
    (await repository.findClientByClientId(request.clientId))
  if (!client) {
    return {
      body: errorEnvelope("invalid_request", "OAuth client is not registered"),
      ok: false,
      status: 400,
    } as const
  }

  const validation = validateOAuthClientAuthorization({
    client,
    redirectUri: request.redirectUri,
    responseType: request.responseType,
    scopes: request.scopes,
  })
  if (validation._tag === "Left") {
    return {
      body: errorEnvelope("invalid_request", validation.left.error_description, {
        oauth_error: validation.left.error,
      }),
      ok: false,
      status: 400,
    } as const
  }

  return { ok: true, value: validation.right } as const
}

function oauthErrorFromEnvelope(envelope: ReturnType<typeof errorEnvelope>) {
  const code = envelope.error.code === "invalid_request" ? "invalid_grant" : envelope.error.code
  return oauthError(code, envelope.error.message)
}

async function getBrowserSessionContext(request: Request, options: CreateAuthAppOptions) {
  if (!options.browserAuthStore) {
    return {
      body: errorEnvelope("unauthenticated", "Browser session validation is unavailable"),
      ok: false,
      status: 401,
    } as const
  }

  const rawSessionToken = readCookie(request.headers.get("cookie"), sessionCookieName)
  if (!rawSessionToken) {
    return {
      body: errorEnvelope("unauthenticated", "Browser session is required"),
      ok: false,
      status: 401,
    } as const
  }

  const result = await Effect.runPromiseExit(
    validateBrowserSession(options.browserAuthStore, {
      now: getNow(options),
      rawSessionToken,
    }),
  )
  if (result._tag === "Success") return { ok: true, value: result.value } as const

  const error = result.cause._tag === "Fail" ? result.cause.error : undefined
  if (error) {
    const mapped = mapAppErrorToHttp(error)
    return { body: mapped.body, ok: false, status: mapped.status } as const
  }

  return {
    body: errorEnvelope("internal_error", "Internal server error"),
    ok: false,
    status: 500,
  } as const
}

async function loadPendingAuthorizationRequest(
  requestId: string,
  options: CreateAuthAppOptions,
  now: Date,
) {
  if (!options.oauthRepository) {
    return {
      body: errorEnvelope("invalid_request", "OAuth storage is unavailable"),
      ok: false,
      status: 400,
    } as const
  }

  const request = await options.oauthRepository.findAuthorizationRequestById(requestId)
  if (!request || request.status !== "pending" || request.expiresAt.getTime() <= now.getTime()) {
    return {
      body: errorEnvelope("invalid_request", "OAuth authorization request is invalid or expired"),
      ok: false,
      status: 400,
    } as const
  }

  return { ok: true, value: request } as const
}

async function exchangeAuthorizationCode(
  repository: OAuthRepository,
  body: Record<string, unknown>,
  now: Date,
): Promise<RouteResult<OAuthTokenResponse>> {
  const rawCode = bodyString(body.code)
  const code = rawCode
    ? await repository.findAuthorizationCodeByHash(hashOAuthToken(rawCode))
    : null
  if (!code || !isValidAuthorizationCodeExchange(code, body, now)) {
    return invalidGrant("OAuth authorization code is invalid")
  }

  const clientAuthentication = await authenticateTokenEndpointClient(
    repository,
    code.clientId,
    body,
    now,
  )
  if (!clientAuthentication.ok) return clientAuthentication

  const consumed = await repository.consumeAuthorizationCode({
    codeId: code.id,
    consumedAt: now,
  })
  if (!consumed) return invalidGrant("OAuth authorization code was already consumed")

  const grant = await repository.createGrant({
    actorId: code.actorId,
    actorKind: code.actorKind,
    clientId: code.clientId,
    clientName: clientAuthentication.client?.clientName ?? "OAuth client",
    resource: code.resource,
    scope: code.scope,
    userId: code.userId,
    workspaceId: code.workspaceId,
    workspaceSlug: code.workspaceSlug,
  })

  return issueTokens(
    repository,
    {
      actorId: code.actorId,
      actorKind: code.actorKind,
      grantId: grant.id,
      refreshTokenFamilyId: createRefreshTokenFamilyId(),
      resource: code.resource,
      scope: code.scope,
      userId: code.userId,
      workspaceId: code.workspaceId,
      workspaceSlug: code.workspaceSlug,
    },
    now,
  )
}

async function exchangeRefreshToken(
  repository: OAuthRepository,
  body: Record<string, unknown>,
  now: Date,
): Promise<RouteResult<OAuthTokenResponse>> {
  const rawRefreshToken = bodyString(body.refresh_token)
  const refreshToken = rawRefreshToken
    ? await repository.findRefreshTokenByHash(hashOAuthToken(rawRefreshToken))
    : null
  if (!refreshToken) return invalidGrant("OAuth refresh token is invalid")

  if (
    bodyString(body.client_id) !== refreshToken.clientId ||
    (bodyString(body.resource) && bodyString(body.resource) !== refreshToken.resource)
  ) {
    return invalidGrant("OAuth refresh token is invalid")
  }

  const clientAuthentication = await authenticateTokenEndpointClient(
    repository,
    refreshToken.clientId,
    body,
    now,
  )
  if (!clientAuthentication.ok) return clientAuthentication

  if (refreshToken.consumedAt) {
    await repository.revokeGrantTokens({ grantId: refreshToken.grantId, revokedAt: now })
    return invalidGrant("OAuth refresh token was already consumed")
  }

  if (refreshToken.revokedAt || refreshToken.expiresAt.getTime() <= now.getTime()) {
    return invalidGrant("OAuth refresh token is invalid")
  }

  const consumed = await repository.consumeRefreshToken({
    consumedAt: now,
    refreshTokenId: refreshToken.id,
  })
  if (!consumed) {
    await repository.revokeGrantTokens({ grantId: refreshToken.grantId, revokedAt: now })
    return invalidGrant("OAuth refresh token was already consumed")
  }

  const result = await issueTokens(
    repository,
    {
      actorId: refreshToken.actorId,
      actorKind: refreshToken.actorKind,
      grantId: refreshToken.grantId,
      parentRefreshTokenId: refreshToken.id,
      refreshTokenFamilyId: refreshToken.tokenFamilyId,
      resource: refreshToken.resource,
      scope: refreshToken.scope,
      userId: refreshToken.userId,
      workspaceId: refreshToken.workspaceId,
      workspaceSlug: refreshToken.workspaceSlug,
    },
    now,
  )
  if (!result.ok) return result
  const replacementTokenId = result.value.refresh_token_id
  if (!replacementTokenId) return invalidGrant("OAuth refresh token is invalid")

  return {
    ok: true,
    value: toPublicTokenResponse(result.value),
  }
}

function isValidAuthorizationCodeExchange(
  code: OAuthAuthorizationCodeRecord,
  body: Record<string, unknown>,
  now: Date,
) {
  return (
    code.consumedAt === null &&
    code.expiresAt.getTime() > now.getTime() &&
    bodyString(body.client_id) === code.clientId &&
    bodyString(body.redirect_uri) === code.redirectUri &&
    bodyString(body.resource) === code.resource &&
    verifyPkceChallenge(bodyString(body.code_verifier), code.codeChallengeHash)
  )
}

type TokenEndpointClientAuthenticationResult =
  | { client: OAuthClientRecord | null; ok: true }
  | {
      body: ReturnType<typeof errorEnvelope>
      ok: false
      status: 401
    }

async function authenticateTokenEndpointClient(
  repository: OAuthRepository,
  clientId: string,
  body: Record<string, unknown>,
  now: Date,
): Promise<TokenEndpointClientAuthenticationResult> {
  if (bodyString(body.client_id) !== clientId) return invalidClient()

  const client =
    findStaticOAuthClient(clientId) ?? (await repository.findClientByClientId(clientId))
  if (!client)
    return isDynamicOAuthClientId(clientId) ? invalidClient() : { client: null, ok: true }

  if (client.tokenEndpointAuthMethod === "none") return { client, ok: true }

  const clientSecret = bodyString(body.client_secret)
  const clientSecretExpiresAt = client.clientSecretExpiresAt ?? null
  const clientSecretIsExpired =
    clientSecretExpiresAt !== null && clientSecretExpiresAt.getTime() <= now.getTime()
  if (
    !client.clientSecretHash ||
    !clientSecret ||
    clientSecretIsExpired ||
    !verifyOAuthToken(clientSecret, client.clientSecretHash)
  ) {
    return invalidClient()
  }

  return { client, ok: true }
}

function isDynamicOAuthClientId(clientId: string) {
  return clientId.startsWith("dcr_")
}

type TokenIssueInput = {
  actorId: string
  actorKind: string
  grantId: string
  parentRefreshTokenId?: string
  refreshTokenFamilyId: string
  resource: string
  scope: OAuthAuthorizationCodeRecord["scope"]
  userId: string
  workspaceId: string
  workspaceSlug: string
}

type OAuthTokenResponse = {
  access_token: string
  expires_in: number
  refresh_token?: string
  refresh_token_id?: string
  scope: string
  token_type: "Bearer"
}

async function issueTokens(
  repository: OAuthRepository,
  input: TokenIssueInput,
  now: Date,
): Promise<RouteResult<OAuthTokenResponse>> {
  if (input.actorKind !== "user") {
    return invalidGrant("OAuth authorization code actor is not supported")
  }

  const rawAccessToken = createOAuthAccessToken()
  await repository.createAccessToken({
    actorId: input.actorId,
    actorKind: input.actorKind,
    expiresAt: addSeconds(now, accessTokenTtlSeconds),
    grantId: input.grantId,
    resource: input.resource,
    scope: input.scope,
    tokenHash: hashOAuthToken(rawAccessToken),
    userId: input.userId,
    workspaceId: input.workspaceId,
    workspaceSlug: input.workspaceSlug,
  })

  const response: OAuthTokenResponse = {
    access_token: rawAccessToken,
    expires_in: accessTokenTtlSeconds,
    scope: input.scope.join(" "),
    token_type: "Bearer",
  }

  if (input.scope.includes("offline_access")) {
    const rawRefreshToken = createOAuthRefreshToken()
    const refreshToken = await repository.createRefreshToken({
      actorId: input.actorId,
      actorKind: input.actorKind,
      expiresAt: addSeconds(now, refreshTokenTtlSeconds),
      grantId: input.grantId,
      parentTokenId: input.parentRefreshTokenId ?? null,
      tokenFamilyId: input.refreshTokenFamilyId,
      tokenHash: hashOAuthToken(rawRefreshToken),
      userId: input.userId,
      workspaceId: input.workspaceId,
      workspaceSlug: input.workspaceSlug,
    })
    response.refresh_token = rawRefreshToken
    response.refresh_token_id = refreshToken.id
  }

  return {
    ok: true,
    value: input.parentRefreshTokenId ? response : toPublicTokenResponse(response),
  }
}

function toPublicTokenResponse(response: OAuthTokenResponse): OAuthTokenResponse {
  const { refresh_token_id: _refreshTokenId, ...publicResponse } = response
  return publicResponse
}

type ConsentPrincipal = {
  label: string
  selected: boolean
  value: string
}

type SelectedActor = {
  actorId: string
  actorKind: "user"
}

function loadConsentPrincipals(session: BrowserSessionContext): ConsentPrincipal[] {
  return [
    {
      label: `You (${session.email})`,
      selected: true,
      value: `user:${session.userId}`,
    },
  ]
}

function resolveSelectedActor(
  session: BrowserSessionContext,
  selectedPrincipal: string,
): RouteResult<SelectedActor> {
  const principal = selectedPrincipal || `user:${session.userId}`

  if (principal === `user:${session.userId}`) {
    return {
      ok: true,
      value: {
        actorId: session.userId,
        actorKind: "user",
      },
    }
  }

  return {
    body: errorEnvelope("invalid_request", "Invalid OAuth principal"),
    ok: false,
    status: 400,
  }
}

function canApproveAdminScope(session: BrowserSessionContext) {
  return session.activeWorkspaceRole === "workspace_admin"
}

function renderConsentPage(
  request: { clientId: string; id: string; scope: string[] },
  session: BrowserSessionContext,
  rawRequest: Request,
  principals: ConsentPrincipal[],
) {
  const clientName = clientDisplayName(request.clientId)
  const escapedClientName = escapeHtml(clientName)
  const escapedRequestId = escapeHtml(request.id)
  const escapedWorkspaceSlug = escapeHtml(session.activeWorkspaceSlug)
  const theme = resolveConsentTheme(rawRequest)
  const scopeItems = request.scope
    .map(scopeConsentCopy)
    .map(
      (scope) => `<li>
        <strong>${escapeHtml(scope.title)}</strong>
      </li>`,
    )
    .join("")
  const principalOptions = principals
    .map(
      (principal) =>
        `<option value="${escapeHtml(principal.value)}"${principal.selected ? " selected" : ""}>${escapeHtml(principal.label)}</option>`,
    )
    .join("")
  return `<!doctype html>
<html class="${theme}" lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <title>Authorize ${escapedClientName} | Contextbase</title>
    <script>${themeBootScript(theme)}</script>
    <style>
      @font-face {
        font-family: "Inter Variable";
        font-style: normal;
        font-weight: 100 900;
        font-display: swap;
        src: url("/oauth/assets/inter-latin-wght-normal.woff2") format("woff2");
      }

      :root {
        color-scheme: light;
        --background: oklch(0.99913 0.001 286.38);
        --surface: oklch(1 0 0);
        --surface-subtle: oklch(0.985 0 0);
        --foreground: oklch(0.145 0 0);
        --muted-foreground: oklch(0.556 0 0);
        --border: oklch(0.922 0 0);
        --primary: oklch(0.205 0 0);
        --primary-foreground: oklch(0.985 0 0);
        --secondary: oklch(0.97 0 0);
        --secondary-foreground: oklch(0.205 0 0);
        --ring: oklch(0.708 0 0);
        --radius: 0.45rem;
      }

      html.dark {
        color-scheme: dark;
        --background: oklch(0.145 0 0);
        --surface: oklch(0.205 0 0);
        --surface-subtle: oklch(0.18 0.006 285);
        --foreground: oklch(0.985 0 0);
        --muted-foreground: oklch(0.708 0 0);
        --border: oklch(1 0 0 / 10%);
        --primary: oklch(0.922 0 0);
        --primary-foreground: oklch(0.205 0 0);
        --secondary: oklch(0.269 0 0);
        --secondary-foreground: oklch(0.985 0 0);
        --ring: oklch(0.556 0 0);
      }

      * {
        box-sizing: border-box;
      }

      html {
        min-height: 100%;
        background: var(--surface-subtle);
        color: var(--foreground);
        font-family: "Inter Variable", Arial, Helvetica, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      body {
        min-height: 100vh;
        margin: 0;
      }

      button {
        font: inherit;
      }

      .consent-shell {
        display: grid;
        min-height: 100vh;
        place-items: center;
        padding: 1.25rem;
      }

      .consent-card {
        width: min(100%, 31rem);
        overflow: hidden;
        border: 1px solid var(--border);
        border-radius: calc(var(--radius) * 1.4);
        background: var(--background);
        box-shadow: 0 1px 2px rgb(0 0 0 / 0.03), 0 8px 28px rgb(0 0 0 / 0.045);
      }

      .consent-header {
        padding: 1.5rem 1.5rem 1.05rem;
      }

      .brand-row {
        margin-bottom: 1.25rem;
        color: var(--muted-foreground);
        font-size: 0.8125rem;
        font-weight: 550;
      }

      h1 {
        margin: 0;
        color: var(--foreground);
        font-size: 1.25rem;
        font-weight: 650;
        letter-spacing: 0;
        line-height: 1.25;
      }

      .lead {
        margin: 0.5rem 0 0;
        color: var(--muted-foreground);
        font-size: 0.875rem;
        line-height: 1.55;
      }

      .lead strong {
        color: var(--foreground);
        font-weight: 600;
      }

      .principal-picker {
        display: grid;
        gap: 0.45rem;
        padding: 0 1.5rem 1.25rem;
      }

      .principal-picker label {
        color: var(--muted-foreground);
        font-size: 0.75rem;
        font-weight: 550;
        line-height: 1.25;
      }

      .principal-picker select {
        width: 100%;
        min-height: 2.25rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface-subtle);
        color: var(--foreground);
        font: inherit;
        font-size: 0.875rem;
        line-height: 1.2;
        padding: 0 0.75rem;
      }

      .principal-picker select:focus-visible {
        outline: 3px solid color-mix(in oklch, var(--ring) 45%, transparent);
        outline-offset: 2px;
      }

      .scope-list {
        display: grid;
        margin: 0;
        padding: 0;
        list-style: none;
        border-top: 1px solid var(--border);
      }

      .scope-list li {
        padding: 0.95rem 1.5rem;
        border-bottom: 1px solid var(--border);
      }

      .scope-list strong {
        display: block;
        color: var(--foreground);
        font-size: 0.875rem;
        font-weight: 550;
        line-height: 1.35;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        padding: 1rem 1.5rem 1.5rem;
      }

      .button {
        display: inline-flex;
        min-height: 2.25rem;
        align-items: center;
        justify-content: center;
        border: 1px solid transparent;
        border-radius: 999px;
        padding: 0 0.9rem;
        font-size: 0.875rem;
        font-weight: 550;
        line-height: 1;
        text-decoration: none;
        transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
        cursor: pointer;
      }

      .button:focus-visible {
        outline: 3px solid color-mix(in oklch, var(--ring) 45%, transparent);
        outline-offset: 2px;
      }

      .button-secondary {
        border-color: var(--border);
        background: color-mix(in oklch, var(--secondary) 72%, transparent);
        color: var(--secondary-foreground);
      }

      .button-secondary:hover {
        background: var(--secondary);
      }

      .button-primary {
        background: var(--primary);
        color: var(--primary-foreground);
      }

      .button-primary:hover {
        background: color-mix(in oklch, var(--primary) 84%, transparent);
      }

      @media (max-width: 34rem) {
        .consent-shell {
          align-items: end;
          padding: 0.75rem;
        }

        .consent-card {
          border-radius: calc(var(--radius) * 1.4);
        }

        .actions {
          flex-direction: column-reverse;
        }

        .button {
          width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <main class="consent-shell">
      <section class="consent-card" aria-labelledby="consent-title">
        <div class="consent-header">
          <div class="brand-row">Contextbase authorization</div>
          <h1 id="consent-title">Connect ${escapedClientName} to Contextbase</h1>
          <p class="lead">${escapedClientName} is requesting access to your workspace <strong>${escapedWorkspaceSlug}</strong>.</p>
        </div>
        <form method="post" action="/oauth/consent">
          <div class="principal-picker">
            <label for="principal">Authorize as</label>
            <select id="principal" name="principal">
              ${principalOptions}
            </select>
          </div>
        <ul class="scope-list" aria-label="Requested permissions">
          ${scopeItems}
        </ul>
        <div class="actions">
          <input type="hidden" name="request_id" value="${escapedRequestId}">
          <button class="button button-secondary" name="action" value="deny" type="submit">Deny</button>
          <button class="button button-primary" name="action" value="approve" type="submit">Approve</button>
        </div>
        </form>
      </section>
    </main>
  </body>
</html>`
}

function clientDisplayName(clientId: string) {
  if (
    clientId.includes("claude-code-client-metadata") ||
    clientId.includes("client.example") ||
    clientId === "client"
  ) {
    return "Claude Code"
  }

  try {
    return new URL(clientId).hostname
  } catch {
    return clientId
  }
}

function resolveConsentTheme(request: Request) {
  const theme = readCookie(request.headers.get("cookie"), themeCookieName)
  return theme === "dark" ? "dark" : "light"
}

function themeBootScript(fallbackTheme: "dark" | "light") {
  return `(function(){try{var t=null;var c=document.cookie.match(/(?:^|; )${themeCookieName}=([^;]*)/);if(c){t=decodeURIComponent(c[1])}if(t!=="light"&&t!=="dark"&&t!=="system"){t=localStorage.getItem("${themeCookieName}")}if(t!=="light"&&t!=="dark"&&t!=="system"){t="${fallbackTheme}"}var r=t==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;var e=document.documentElement;e.classList.remove("light","dark");e.classList.add(r);e.style.colorScheme=r}catch(e){}})();`
}

function scopeConsentCopy(scope: string) {
  switch (scope) {
    case "contextbase:read":
      return {
        description: "Workspace records available to your account.",
        title: "Read Contextbase data",
      }
    case "contextbase:write":
      return {
        description: "Records in this workspace.",
        title: "Create and update data",
      }
    case "contextbase:files":
      return {
        description: "Short-lived links for files and attachments.",
        title: "Use file links",
      }
    case "contextbase:manage":
      return {
        description: "Workspace settings and security operations.",
        title: "Manage workspace",
      }
    case "offline_access":
      return {
        description: "Allow Claude Code to refresh this connection.",
        title: "Stay connected without asking again",
      }
    default:
      return {
        description: "Allow this requested OAuth permission.",
        title: scope,
      }
  }
}

function readCookie(cookieHeader: string | null, name: string) {
  return (
    cookieHeader
      ?.split(";")
      .map((part) => part.trim())
      .map((part) => {
        const separatorIndex = part.indexOf("=")
        return separatorIndex === -1
          ? ([part, ""] as const)
          : ([
              part.slice(0, separatorIndex),
              decodeURIComponent(part.slice(separatorIndex + 1)),
            ] as const)
      })
      .find(([cookieName]) => cookieName === name)?.[1] ?? null
  )
}

function bodyString(value: unknown) {
  if (Array.isArray(value)) return String(value[0] ?? "")
  if (value instanceof File) return ""
  return String(value ?? "")
}

function getNow(options: CreateAuthAppOptions) {
  return options.now?.() ?? new Date()
}

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000)
}

function createRefreshTokenFamilyId() {
  return `ort_${Math.random().toString(36).slice(2, 18)}`
}

function invalidGrant(message: string): RouteResult<never> {
  return {
    body: errorEnvelope("invalid_request", message),
    ok: false,
    status: 400,
  }
}

function invalidClient(): {
  body: ReturnType<typeof errorEnvelope>
  ok: false
  status: 401
} {
  return {
    body: errorEnvelope("invalid_client", "OAuth client authentication failed"),
    ok: false,
    status: 401,
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}
