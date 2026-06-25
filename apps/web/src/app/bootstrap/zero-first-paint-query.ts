const FIRST_PAINT_ZERO_TTL = "5m"
export const DEFAULT_FIRST_PAINT_ZERO_TIMEOUT_MS = 3_000

export type ZeroFirstPaintPreloadHandle = {
  cleanup: () => void
  complete: Promise<void>
}

export type ZeroFirstPaintClient = {
  preload: (
    query: never,
    options: { ttl: typeof FIRST_PAINT_ZERO_TTL },
  ) => ZeroFirstPaintPreloadHandle
  run: (
    query: never,
    options: { ttl: typeof FIRST_PAINT_ZERO_TTL; type: "complete" },
  ) => Promise<unknown>
}

export type ZeroFirstPaintQueryResult<T> =
  | { data: T; status: "ready" }
  | { status: "timeout"; timeoutMs: number }

export async function readZeroFirstPaintQuery<T>(
  zero: ZeroFirstPaintClient,
  query: never,
  options: { timeoutMs?: number } = {},
): Promise<ZeroFirstPaintQueryResult<T>> {
  const timeoutMs = Math.max(0, options.timeoutMs ?? DEFAULT_FIRST_PAINT_ZERO_TIMEOUT_MS)
  const preload = zero.preload(query, { ttl: FIRST_PAINT_ZERO_TTL })

  try {
    const result = await withTimeout(async () => {
      await preload.complete
      return (await zero.run(query, { ttl: FIRST_PAINT_ZERO_TTL, type: "complete" })) as T
    }, timeoutMs)

    return result.status === "ready" ? result : { status: "timeout", timeoutMs }
  } finally {
    preload.cleanup()
  }
}

export async function waitForZeroPreloads(
  preloads: readonly ZeroFirstPaintPreloadHandle[],
  options: { timeoutMs?: number } = {},
): Promise<{ status: "ready" } | { status: "timeout"; timeoutMs: number }> {
  const timeoutMs = Math.max(0, options.timeoutMs ?? DEFAULT_FIRST_PAINT_ZERO_TIMEOUT_MS)

  try {
    const result = await withTimeout(async () => {
      await Promise.all(preloads.map((preload) => preload.complete))
    }, timeoutMs)

    return result.status === "ready" ? { status: "ready" } : { status: "timeout", timeoutMs }
  } finally {
    for (const preload of preloads) {
      preload.cleanup()
    }
  }
}

function withTimeout<T>(
  run: () => Promise<T>,
  timeoutMs: number,
): Promise<{ data: T; status: "ready" } | { status: "timeout" }> {
  if (timeoutMs <= 0) return Promise.resolve({ status: "timeout" })

  return new Promise((resolve, reject) => {
    let settled = false
    const timeout = setTimeout(() => {
      settled = true
      resolve({ status: "timeout" })
    }, timeoutMs)

    run().then(
      (data) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        resolve({ data, status: "ready" })
      },
      (error) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        reject(error)
      },
    )
  })
}
