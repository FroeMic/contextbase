export function withPreloadTimeout(operation: Promise<void>, timeoutMs: number): Promise<void> {
  if (timeoutMs <= 0) return Promise.resolve()

  return new Promise((resolve) => {
    let settled = false
    const timeout = setTimeout(() => {
      settled = true
      resolve()
    }, timeoutMs)

    operation.then(
      () => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        resolve()
      },
      () => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        resolve()
      },
    )
  })
}

export function once(callback: () => void): () => void {
  let called = false

  return () => {
    if (called) return
    called = true
    callback()
  }
}
