/**
 * Error raised by a provider when image/prompt generation fails. `retryable`
 * tells the pipeline whether a bounded retry is worthwhile (rate limits, 5xx,
 * network, timeout) or pointless (content-policy/validation rejections).
 */
export class ProviderError extends Error {
  readonly retryable: boolean
  readonly status?: number

  constructor(message: string, options: { retryable: boolean; status?: number; cause?: unknown }) {
    super(message)
    this.name = "ProviderError"
    this.retryable = options.retryable
    if (options.status !== undefined) {
      this.status = options.status
    }
    if (options.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }
}

/** True only when the error explicitly marks itself retryable. Default: false. */
export function isRetryableProviderError(error: unknown): boolean {
  return error instanceof ProviderError && error.retryable
}
