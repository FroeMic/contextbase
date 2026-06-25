type BrowserCookieSameSite = "Strict" | "Lax" | "None"

type BrowserCookieOptions = {
  domain?: string
  maxAge?: number
  path?: string
  sameSite?: BrowserCookieSameSite
  secure?: boolean
}

export function serializeBrowserCookie(
  name: string,
  value: string,
  options: BrowserCookieOptions = {},
) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`]

  if (options.path) parts.push(`Path=${options.path}`)
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`)
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`)
  if (options.domain) parts.push(`Domain=${options.domain}`)
  if (options.secure) parts.push("Secure")

  return parts.join("; ")
}

export function setBrowserCookie(name: string, value: string, options: BrowserCookieOptions = {}) {
  // biome-ignore lint/suspicious/noDocumentCookie: Centralized writer for non-sensitive browser preference cookies.
  document.cookie = serializeBrowserCookie(name, value, options)
}
