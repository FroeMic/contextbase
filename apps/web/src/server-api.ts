import {
  handleInvitationAcceptRequest,
  handleLogoutRequest,
  handleMagicLinkConsume,
  handleMagicLinkRequest,
  handleOnboardingCompleteRequest,
  handleOnboardingSlugAvailabilityRequest,
  handlePasswordLoginRequest,
  handleSessionRequest,
  handleSignupVerificationConsume,
  handleSignupVerificationRequest,
  handleWorkspaceSwitchRequest,
} from "./domains/auth/server/handlers"
import {
  handleBrowserFileRequest,
  handlePublicAvatarRequest,
} from "./domains/files/server/browser-file-routes"
import {
  handleZeroMutateRequest,
  handleZeroQueryRequest,
} from "./domains/zero/server/zero-handlers"
import { createIpRateLimiter, rejectOversizedRequest } from "./shared/http/request-guards"
import { handleTrpcRequest } from "./trpc/handler"

type ApiRequestHandlers = {
  handleBrowserFileRequest?: typeof handleBrowserFileRequest
  handlePublicAvatarRequest?: typeof handlePublicAvatarRequest
  handleInvitationAcceptRequest?: typeof handleInvitationAcceptRequest
  handleLogoutRequest?: typeof handleLogoutRequest
  handleMagicLinkConsume?: typeof handleMagicLinkConsume
  handleMagicLinkRequest?: typeof handleMagicLinkRequest
  handleOnboardingCompleteRequest?: typeof handleOnboardingCompleteRequest
  handleOnboardingSlugAvailabilityRequest?: typeof handleOnboardingSlugAvailabilityRequest
  handlePasswordLoginRequest?: typeof handlePasswordLoginRequest
  handleSessionRequest?: typeof handleSessionRequest
  handleSignupVerificationConsume?: typeof handleSignupVerificationConsume
  handleSignupVerificationRequest?: typeof handleSignupVerificationRequest
  handleTrpcRequest?: typeof handleTrpcRequest
  handleWorkspaceSwitchRequest?: typeof handleWorkspaceSwitchRequest
  handleZeroMutateRequest?: typeof handleZeroMutateRequest
  handleZeroQueryRequest?: typeof handleZeroQueryRequest
}

const maxJsonBodyBytes = Number.parseInt(process.env.WEB_MAX_JSON_BODY_BYTES ?? "262144", 10)

export function createApiRequestHandler(handlers: ApiRequestHandlers = {}) {
  const authRateLimiter = createIpRateLimiter({
    maxRequests: Number.parseInt(process.env.WEB_AUTH_RATE_LIMIT_MAX ?? "20", 10),
    windowMs: Number.parseInt(process.env.WEB_AUTH_RATE_LIMIT_WINDOW_MS ?? "60000", 10),
  })

  return async function maybeHandleApiRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url)
    if (url.pathname.startsWith("/public/avatars/")) {
      return (handlers.handlePublicAvatarRequest ?? handlePublicAvatarRequest)(request)
    }

    if (!url.pathname.startsWith("/api/")) return null

    if (isBrowserFileRoute(url.pathname, request.method)) {
      return (handlers.handleBrowserFileRequest ?? handleBrowserFileRequest)(request)
    }

    if (request.method !== "GET") {
      const oversized = rejectOversizedRequest(request, maxJsonBodyBytes)
      if (oversized) return oversized
    }
    if (request.method === "POST" && url.pathname === "/api/auth/magic-link/request") {
      const limited = authRateLimiter(request)
      if (limited) return limited
      return (handlers.handleMagicLinkRequest ?? handleMagicLinkRequest)(request)
    }
    if (request.method === "POST" && url.pathname === "/api/auth/password/login") {
      const limited = authRateLimiter(request)
      if (limited) return limited
      return (handlers.handlePasswordLoginRequest ?? handlePasswordLoginRequest)(request)
    }
    if (request.method === "POST" && url.pathname === "/api/auth/signup/request") {
      const limited = authRateLimiter(request)
      if (limited) return limited
      return (handlers.handleSignupVerificationRequest ?? handleSignupVerificationRequest)(request)
    }
    if (request.method === "POST" && url.pathname === "/api/auth/signup/consume") {
      const limited = authRateLimiter(request)
      if (limited) return limited
      return (handlers.handleSignupVerificationConsume ?? handleSignupVerificationConsume)(request)
    }
    if (request.method === "POST" && url.pathname === "/api/auth/onboarding/complete") {
      const limited = authRateLimiter(request)
      if (limited) return limited
      return (handlers.handleOnboardingCompleteRequest ?? handleOnboardingCompleteRequest)(request)
    }
    if (request.method === "GET" && url.pathname === "/api/auth/onboarding/slug-availability") {
      const limited = authRateLimiter(request)
      if (limited) return limited
      return (
        handlers.handleOnboardingSlugAvailabilityRequest ?? handleOnboardingSlugAvailabilityRequest
      )(request)
    }
    if (request.method === "POST" && url.pathname === "/api/auth/invitations/accept") {
      const limited = authRateLimiter(request)
      if (limited) return limited
      return (handlers.handleInvitationAcceptRequest ?? handleInvitationAcceptRequest)(request)
    }
    if (request.method === "POST" && url.pathname === "/api/auth/magic-link/consume") {
      return (handlers.handleMagicLinkConsume ?? handleMagicLinkConsume)(request)
    }
    if (request.method === "POST" && url.pathname === "/api/auth/logout") {
      return (handlers.handleLogoutRequest ?? handleLogoutRequest)(request)
    }
    if (
      request.method === "POST" &&
      (url.pathname === "/api/auth/workspace/select" ||
        url.pathname === "/api/auth/workspace/switch")
    ) {
      return (handlers.handleWorkspaceSwitchRequest ?? handleWorkspaceSwitchRequest)(request)
    }
    if (request.method === "GET" && url.pathname === "/api/auth/session") {
      return (handlers.handleSessionRequest ?? handleSessionRequest)(request)
    }
    if (url.pathname === "/api/trpc" || url.pathname.startsWith("/api/trpc/")) {
      return (handlers.handleTrpcRequest ?? handleTrpcRequest)(request)
    }
    if (request.method === "POST" && url.pathname === "/api/zero/query") {
      return (handlers.handleZeroQueryRequest ?? handleZeroQueryRequest)(request)
    }
    if (request.method === "POST" && url.pathname === "/api/zero/mutate") {
      return (handlers.handleZeroMutateRequest ?? handleZeroMutateRequest)()
    }

    return json(
      {
        error: {
          code: "not_found",
          details: { path: url.pathname },
          message: "API route not found.",
        },
        ok: false,
      },
      { status: 404 },
    )
  }
}

export const maybeHandleApiRequest = createApiRequestHandler()

function isBrowserFileRoute(pathname: string, method: string) {
  if (pathname === "/api/settings/account/avatar") {
    return method === "POST" || method === "OPTIONS"
  }
  if (/^\/api\/files\/[^/]+\/content$/.test(pathname)) {
    return method === "GET" || method === "OPTIONS"
  }
  return false
}

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set("content-type", "application/json")
  return new Response(JSON.stringify(body), { ...init, headers })
}
