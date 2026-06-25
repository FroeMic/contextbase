/**
 * Debug utility for development-only logging
 *
 * In development mode: Logs messages with [Datatable] prefix
 * In production mode: No-op (logs nothing)
 *
 * Usage:
 * ```typescript
 * import { debug } from './utils/debug'
 * debug('Something happened:', data)
 * ```
 */
const isDevelopment =
  typeof process !== "undefined"
    ? process.env.NODE_ENV !== "production"
    : Boolean(import.meta.env?.DEV)

export const debug = isDevelopment
  ? (...args: unknown[]) => console.log("[Datatable]", ...args)
  : () => {}
