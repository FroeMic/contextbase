import { ApiClientError } from "@contextbase/api-client"
import { describe, expect, test } from "vitest"

import { mapCliErrorToExitCode, runCliMain } from "./runner.js"

describe("CLI error handling", () => {
  test("maps documented exit codes", () => {
    expect(mapCliErrorToExitCode(new Error("Usage: contextbase tasks list"))).toBe(2)
    expect(mapCliErrorToExitCode(apiError(401, "unauthenticated"))).toBe(3)
    expect(mapCliErrorToExitCode(apiError(403, "forbidden"))).toBe(3)
    expect(mapCliErrorToExitCode(apiError(404, "not_found"))).toBe(4)
    expect(mapCliErrorToExitCode(apiError(409, "conflict"))).toBe(5)
    expect(mapCliErrorToExitCode(apiError(422, "invariant_violation"))).toBe(5)
    expect(mapCliErrorToExitCode(new Error("unexpected"))).toBe(10)
  })

  test("writes failures to stderr and sets exitCode", async () => {
    const stderr: string[] = []
    const state = { exitCode: 0 }

    await runCliMain(
      async () => {
        throw apiError(404, "not_found", "Task not found")
      },
      {
        setExitCode: (code) => {
          state.exitCode = code
        },
        stderr: { write: (message) => stderr.push(message) },
      },
    )

    expect(state.exitCode).toBe(4)
    expect(stderr.join("")).toContain("Task not found")
  })
})

function apiError(status: number, code: string, message = code) {
  return new ApiClientError({
    body: {
      error: {
        code,
        details: {},
        message,
      },
      ok: false,
    },
    message,
    status,
  })
}
