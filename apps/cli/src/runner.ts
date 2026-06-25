import { ApiClientError } from "@contextbase/api-client"

export type CliExitCode = 0 | 2 | 3 | 4 | 5 | 10

export type CliIo = {
  setExitCode?: (code: CliExitCode) => void
  stderr?: {
    write: (message: string) => unknown
  }
}

export async function runCliMain(action: () => Promise<void>, io: CliIo = {}) {
  try {
    await action()
  } catch (error) {
    const exitCode = mapCliErrorToExitCode(error)
    const stderr = io.stderr ?? process.stderr
    const setExitCode =
      io.setExitCode ??
      ((code: CliExitCode) => {
        process.exitCode = code
      })
    stderr.write(`${formatCliError(error)}\n`)
    setExitCode(exitCode)
  }
}

export function mapCliErrorToExitCode(error: unknown): CliExitCode {
  if (error instanceof ApiClientError) {
    if (error.status === 400) return 2
    if (error.status === 401 || error.status === 403) return 3
    if (error.status === 404) return 4
    if (error.status === 409 || error.status === 422) return 5
    return 10
  }

  if (error instanceof Error && isUsageErrorMessage(error.message)) return 2

  return 10
}

function formatCliError(error: unknown) {
  if (error instanceof ApiClientError) return error.message
  if (error instanceof Error) return error.message
  return String(error)
}

function isUsageErrorMessage(message: string) {
  return (
    message.startsWith("Usage:") ||
    message.startsWith("Missing ") ||
    message.startsWith("Expected ") ||
    message.startsWith("Unknown ")
  )
}
