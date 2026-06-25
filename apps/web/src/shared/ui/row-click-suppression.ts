let suppressedUntil = 0

export function suppressRowClick(durationMs = 250) {
  if (typeof performance === "undefined") {
    return
  }

  suppressedUntil = Math.max(suppressedUntil, performance.now() + durationMs)
}

export function isRowClickSuppressed() {
  if (typeof performance === "undefined") {
    return false
  }

  return performance.now() < suppressedUntil
}
