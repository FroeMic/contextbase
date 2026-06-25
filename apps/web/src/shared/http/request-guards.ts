export function rejectOversizedRequest(request: Request, maxBodyBytes: number) {
  const contentLength = request.headers.get("content-length")
  if (!contentLength) return null

  const parsed = Number.parseInt(contentLength, 10)
  if (!Number.isFinite(parsed) || parsed <= maxBodyBytes) return null

  return jsonError(413, "payload_too_large", "Request body is too large.")
}

export function createIpRateLimiter(input: { maxRequests: number; windowMs: number }) {
  const buckets = new Map<string, { count: number; resetAt: number }>()

  return (request: Request, now = Date.now()) => {
    const key = clientIpFor(request)
    const current = buckets.get(key)

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + input.windowMs })
      return null
    }

    current.count += 1
    if (current.count <= input.maxRequests) return null

    return jsonError(429, "rate_limited", "Too many requests.")
  }
}

function clientIpFor(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return (
    forwarded ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown"
  )
}

function jsonError(status: number, code: string, message: string) {
  return new Response(
    JSON.stringify({
      error: {
        code,
        details: {},
        message,
      },
      ok: false,
    }),
    {
      headers: { "content-type": "application/json" },
      status,
    },
  )
}
