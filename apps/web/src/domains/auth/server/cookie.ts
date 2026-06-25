export const SESSION_COOKIE_NAME = "contextbase_session"
export const ONBOARDING_SESSION_COOKIE_NAME = "contextbase_onboarding_session"
export const AUTH_SHELL_COOKIE_NAME = "contextbase_auth_shell"

export type CookieOptions = {
  domain?: string | null
  expiresAt?: Date
  secure?: boolean
}

export function serializeSessionCookie(rawSessionToken: string, options: CookieOptions) {
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawSessionToken)}`,
    "Path=/",
    "HttpOnly",
    ...(options.secure ? ["Secure"] : []),
    "SameSite=Lax",
    ...(options.domain ? [`Domain=${options.domain}`] : []),
    ...(options.expiresAt ? [`Expires=${options.expiresAt.toUTCString()}`] : []),
  ].join("; ")
}

export function serializeOnboardingSessionCookie(rawSessionToken: string, options: CookieOptions) {
  return [
    `${ONBOARDING_SESSION_COOKIE_NAME}=${encodeURIComponent(rawSessionToken)}`,
    "Path=/",
    "HttpOnly",
    ...(options.secure ? ["Secure"] : []),
    "SameSite=Lax",
    ...(options.domain ? [`Domain=${options.domain}`] : []),
    ...(options.expiresAt ? [`Expires=${options.expiresAt.toUTCString()}`] : []),
  ].join("; ")
}

export function clearOnboardingSessionCookie(options: CookieOptions = {}) {
  return [
    `${ONBOARDING_SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    ...(options.secure ? ["Secure"] : []),
    "SameSite=Lax",
    ...(options.domain ? [`Domain=${options.domain}`] : []),
    "Max-Age=0",
  ].join("; ")
}

export function clearSessionCookie(options: CookieOptions = {}) {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    ...(options.secure ? ["Secure"] : []),
    "SameSite=Lax",
    ...(options.domain ? [`Domain=${options.domain}`] : []),
    "Max-Age=0",
  ].join("; ")
}

export function serializeAuthShellCookie(options: CookieOptions) {
  return [
    `${AUTH_SHELL_COOKIE_NAME}=1`,
    "Path=/",
    ...(options.secure ? ["Secure"] : []),
    "SameSite=Lax",
    ...(options.domain ? [`Domain=${options.domain}`] : []),
    ...(options.expiresAt ? [`Expires=${options.expiresAt.toUTCString()}`] : []),
  ].join("; ")
}

export function clearAuthShellCookie(options: CookieOptions = {}) {
  return [
    `${AUTH_SHELL_COOKIE_NAME}=`,
    "Path=/",
    ...(options.secure ? ["Secure"] : []),
    "SameSite=Lax",
    ...(options.domain ? [`Domain=${options.domain}`] : []),
    "Max-Age=0",
  ].join("; ")
}

export function readSessionCookie(cookieHeader: string | null | undefined) {
  return readSessionCookies(cookieHeader)[0] ?? null
}

export function readOnboardingSessionCookie(cookieHeader: string | null | undefined) {
  return readNamedCookie(cookieHeader, ONBOARDING_SESSION_COOKIE_NAME)
}

export function readSessionCookies(cookieHeader: string | null | undefined) {
  return readNamedCookies(cookieHeader, SESSION_COOKIE_NAME)
}

function readNamedCookie(cookieHeader: string | null | undefined, cookieName: string) {
  return readNamedCookies(cookieHeader, cookieName)[0] ?? null
}

function readNamedCookies(cookieHeader: string | null | undefined, cookieName: string) {
  if (!cookieHeader) return []
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .flatMap((part) => {
      const separatorIndex = part.indexOf("=")
      if (separatorIndex <= 0) return []
      const name = part.slice(0, separatorIndex)
      if (name !== cookieName) return []
      const value = part.slice(separatorIndex + 1)
      return value ? [decodeURIComponent(value)] : []
    })
}
