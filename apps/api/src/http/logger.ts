export type LogLevel = "error" | "info" | "warn"

export type LogEntry = {
  event: string
  level: LogLevel
  [key: string]: unknown
}

export type Logger = {
  error: (event: string, fields?: Record<string, unknown>) => void
  info: (event: string, fields?: Record<string, unknown>) => void
  warn: (event: string, fields?: Record<string, unknown>) => void
}

export type LoggerOptions = {
  sink?: (entry: LogEntry) => void
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const sink =
    options.sink ??
    ((entry: LogEntry) => {
      const output = JSON.stringify(entry)
      if (entry.level === "error") {
        console.error(output)
      } else {
        console.log(output)
      }
    })

  return {
    error: (event, fields = {}) => sink(createLogEntry("error", event, fields)),
    info: (event, fields = {}) => sink(createLogEntry("info", event, fields)),
    warn: (event, fields = {}) => sink(createLogEntry("warn", event, fields)),
  }
}

export function redactLogFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactLogFields(item))
  if (!value || typeof value !== "object") return value

  const redacted: Record<string, unknown> = {}
  for (const [key, fieldValue] of Object.entries(value)) {
    redacted[key] = shouldRedactKey(key) ? "[redacted]" : redactLogFields(fieldValue)
  }
  return redacted
}

function createLogEntry(level: LogLevel, event: string, fields: Record<string, unknown>) {
  return {
    event,
    level,
    ...(redactLogFields(fields) as Record<string, unknown>),
  }
}

function shouldRedactKey(key: string) {
  const normalized = key.toLowerCase()
  return (
    normalized === "authorization" ||
    normalized === "apitoken" ||
    normalized === "claimtoken" ||
    normalized === "token" ||
    normalized === "tokenhash" ||
    normalized.endsWith("_token") ||
    normalized.endsWith("token") ||
    normalized.endsWith("tokenhash")
  )
}
