import posthog, { type CaptureOptions, type CaptureResult } from "posthog-js"

export type BrowserPostHogConfig = {
  apiHost: string
  enabled: boolean
  environment: string
  serviceVersion?: string
  token: string
  uiHost: string
}

export type PostHogBrowserSessionIdentity = {
  activeWorkspaceId?: string | null
  activeWorkspaceSlug?: string | null
  email?: string | null
  sessionId?: string | null
  userId?: string | null
}

declare global {
  interface Window {
    __CONTEXTBASE_POSTHOG__?: BrowserPostHogConfig
  }
}

let hasInitializedPostHog = false
let lastIdentifiedBrowserSessionKey: string | null = null

export function initPostHogBrowserAnalytics(): boolean {
  const config = getWindowPostHogConfig()
  if (!config || hasInitializedPostHog) return false

  try {
    posthog.init(config.token, {
      api_host: config.apiHost,
      autocapture: false,
      capture_pageleave: false,
      capture_pageview: "history_change",
      defaults: "2026-01-30",
      disable_session_recording: true,
      disable_surveys: true,
      enable_heatmaps: false,
      capture_exceptions: {
        capture_console_errors: false,
        capture_unhandled_errors: true,
        capture_unhandled_rejections: true,
      },
      person_profiles: "identified_only",
      ui_host: config.uiHost,
      before_send: redactPostHogEvent,
    })
  } catch {
    return false
  }
  hasInitializedPostHog = true
  return true
}

export function capturePostHogBrowserEvent(
  eventName: string,
  properties?: Record<string, unknown>,
  options?: CaptureOptions,
): void {
  if (!getWindowPostHogConfig()) return

  try {
    posthog.capture(eventName, properties, options)
  } catch {
    return
  }
}

export function capturePostHogBrowserException(
  error: unknown,
  properties?: Record<string, unknown>,
): void {
  const config = getWindowPostHogConfig()
  if (!config) return

  try {
    posthog.captureException(
      normalizeError(error),
      redactPostHogProperties(enrichBrowserExceptionProperties(properties ?? {}, config)),
    )
  } catch {
    return
  }
}

export function identifyPostHogBrowserSession(
  session: PostHogBrowserSessionIdentity | null | undefined,
): boolean {
  if (!session) {
    resetPostHogBrowserSession()
    return false
  }

  if (!getWindowPostHogConfig()) return false

  const email = normalizeIdentityEmail(session.email)
  if (!email) return false

  const sessionKey = [
    email,
    session.sessionId ?? "",
    session.activeWorkspaceId ?? "",
    session.activeWorkspaceSlug ?? "",
  ].join(":")
  if (lastIdentifiedBrowserSessionKey === sessionKey) return false

  try {
    posthog.identify(email, {
      active_workspace_id: session.activeWorkspaceId ?? null,
      active_workspace_slug: session.activeWorkspaceSlug ?? null,
      email,
      session_id: session.sessionId ?? null,
      user_id: session.userId ?? null,
    })
  } catch {
    return false
  }
  lastIdentifiedBrowserSessionKey = sessionKey
  return true
}

export function resetPostHogBrowserSession(): boolean {
  if (!getWindowPostHogConfig()) {
    lastIdentifiedBrowserSessionKey = null
    return false
  }

  try {
    posthog.reset()
  } catch {
    return false
  }
  lastIdentifiedBrowserSessionKey = null
  return true
}

export function resetPostHogBrowserAnalyticsForTest(): void {
  hasInitializedPostHog = false
  lastIdentifiedBrowserSessionKey = null
}

function getWindowPostHogConfig(): BrowserPostHogConfig | null {
  if (typeof window === "undefined") return null

  const config = window.__CONTEXTBASE_POSTHOG__
  if (!config?.enabled || !config.token) return null

  return {
    ...config,
    apiHost: config.apiHost || "/ingest",
  }
}

function redactPostHogEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) return event

  const config = getWindowPostHogConfig()
  const properties =
    config && event.event === "$exception"
      ? enrichBrowserExceptionProperties(event.properties ?? {}, config)
      : (event.properties ?? {})

  return {
    ...event,
    properties: redactPostHogProperties(properties),
  }
}

function enrichBrowserExceptionProperties(
  properties: Record<string, unknown>,
  config: BrowserPostHogConfig,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    environment: config.environment,
    service_name: "vertical-web",
    surface: "web",
  }
  if (config.serviceVersion) {
    metadata.service_version = config.serviceVersion
  }

  return {
    ...properties,
    ...metadata,
  }
}

function redactPostHogProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(properties)) {
    if (shouldRedactKey(key)) {
      redacted[key] = "[redacted]"
    } else if (Array.isArray(value)) {
      redacted[key] = value.map((item) => redactPostHogValue(item))
    } else {
      redacted[key] = redactPostHogValue(value)
    }
  }
  return redacted
}

function redactPostHogValue(value: unknown): unknown {
  if (typeof value === "string") return truncateString(value)
  if (Array.isArray(value)) return value.map((item) => redactPostHogValue(item))
  if (!value || typeof value !== "object") return value
  return redactPostHogProperties(value as Record<string, unknown>)
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error
  return new Error(String(error))
}

function truncateString(value: string): string {
  return value.length > 4_000 ? `${value.slice(0, 4_000)}...` : value
}

function shouldRedactKey(key: string) {
  const normalized = key.toLowerCase()
  return (
    normalized === "authorization" ||
    normalized === "cookie" ||
    normalized === "apitoken" ||
    normalized === "claimtoken" ||
    normalized === "token" ||
    normalized === "tokenhash" ||
    normalized.endsWith("_token") ||
    normalized.endsWith("token") ||
    normalized.endsWith("tokenhash")
  )
}

function normalizeIdentityEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null
}
