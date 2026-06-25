import { schema, type ZeroAuthContext } from "@contextbase/zero-schema"
import type { ZeroOptions } from "@rocicorp/zero"

import type { AuthSession } from "../../auth/client/auth-api"

type ZeroEndpointConfig = {
  cacheURL?: string
}

export function buildZeroContext(session: AuthSession): ZeroAuthContext {
  return {
    activeWorkspaceId: session.activeWorkspaceId,
    activeWorkspaceRole: session.activeWorkspaceRole,
    activeWorkspaceSlug: session.activeWorkspaceSlug,
    capabilities: ["contextbase:read"],
    userId: session.userId,
  }
}

export function buildZeroOptions(
  session: AuthSession,
  config: ZeroEndpointConfig = {},
): ZeroOptions<typeof schema, undefined, ZeroAuthContext> {
  return {
    auth: undefined,
    cacheURL:
      normalizeLocalCacheUrl(config.cacheURL ?? configuredCacheUrl()) ??
      browserCacheUrl() ??
      "http://localhost:4817",
    context: buildZeroContext(session),
    logLevel: import.meta.env.DEV ? "info" : "error",
    schema,
    storageKey: [session.userId, session.sessionId, session.activeWorkspaceId].join(":"),
    userID: session.userId,
  }
}

function configuredCacheUrl() {
  const value = import.meta.env.VITE_ZERO_CACHE_URL
  return value?.trim() ? value : null
}

function browserCacheUrl() {
  if (typeof window === "undefined") return null
  return `${window.location.protocol}//${window.location.hostname}:4817`
}

function normalizeLocalCacheUrl(value: string | null | undefined) {
  if (!value?.trim()) return null
  if (typeof window === "undefined") return value

  try {
    const url = new URL(value)
    const browserHost = window.location.hostname
    if (isLoopbackHost(url.hostname) && isLoopbackHost(browserHost)) {
      url.hostname = browserHost
    }
    return url.toString().replace(/\/$/, "")
  } catch {
    return value
  }
}

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
}
