const defaultBrowserApiHost = "/ingest"
const defaultUiHost = "https://eu.posthog.com"

type BrowserPostHogConfig = {
  apiHost: string
  enabled: boolean
  environment: string
  serviceVersion?: string
  token: string
  uiHost: string
}

type PostHogServerEnv = Record<string, string | undefined>

type PostHogProxyFetch = (request: Request) => Promise<Response>

type PostHogProxyOptions = {
  assetTarget: string
  fetch?: PostHogProxyFetch
  ingestTarget: string
}

export function getBrowserPostHogConfig(env: PostHogServerEnv): BrowserPostHogConfig | null {
  const token = env.POSTHOG_TOKEN?.trim()

  if (env.NODE_ENV !== "production" || !isTruthyEnv(env.POSTHOG_ENABLED) || !token) {
    return null
  }

  return {
    apiHost: env.POSTHOG_BROWSER_HOST?.trim() || env.POSTHOG_HOST?.trim() || defaultBrowserApiHost,
    enabled: true,
    environment: env.POSTHOG_ENVIRONMENT?.trim() || env.NODE_ENV || "production",
    serviceVersion: env.POSTHOG_SERVICE_VERSION?.trim() || undefined,
    token,
    uiHost: defaultUiHost,
  }
}

export function serializeBrowserPostHogConfig(config: BrowserPostHogConfig | null): string | null {
  if (!config) return null

  return JSON.stringify(config).replace(/</g, "\\u003c")
}

export function getBrowserPostHogBootScript(env: NodeJS.ProcessEnv): string {
  const serializedConfig = serializeBrowserPostHogConfig(getBrowserPostHogConfig(env))
  if (!serializedConfig) return ""

  return `window.__CONTEXTBASE_POSTHOG__ = ${serializedConfig};`
}

export function createPostHogProxyRequestHandler(options: PostHogProxyOptions) {
  const proxyFetch = options.fetch ?? fetch

  return async function maybeHandlePostHogProxyRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith(defaultBrowserApiHost)) return null

    const targetOrigin = isPostHogAssetPath(url.pathname)
      ? options.assetTarget
      : options.ingestTarget
    const proxiedPath = url.pathname.slice(defaultBrowserApiHost.length) || "/"
    const targetUrl = new URL(`${proxiedPath}${url.search}`, targetOrigin)
    const headers = proxiedRequestHeaders(request)
    const init: RequestInit & { duplex?: "half" } = {
      headers,
      method: request.method,
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body
      init.duplex = "half"
    }

    const response = await proxyFetch(new Request(targetUrl, init))
    const responseHeaders = new Headers(response.headers)
    responseHeaders.delete("content-encoding")
    responseHeaders.delete("content-length")
    responseHeaders.delete("transfer-encoding")

    return new Response(response.body, {
      headers: responseHeaders,
      status: response.status,
      statusText: response.statusText,
    })
  }
}

function isPostHogAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith(`${defaultBrowserApiHost}/array/`) ||
    pathname.startsWith(`${defaultBrowserApiHost}/static/`)
  )
}

function proxiedRequestHeaders(request: Request): Headers {
  const headers = new Headers(request.headers)
  headers.delete("connection")
  headers.delete("cookie")
  headers.delete("host")
  headers.delete("proxy-authenticate")
  headers.delete("proxy-authorization")
  headers.delete("transfer-encoding")
  headers.delete("upgrade")
  return headers
}

function isTruthyEnv(value: string | undefined): boolean {
  return value === "true" || value === "1"
}
