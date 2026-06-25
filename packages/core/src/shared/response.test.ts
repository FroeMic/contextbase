import { describe, expect, test } from "vitest"

import { errorEnvelope, successEnvelope } from "./response"

describe("response envelopes", () => {
  test("wraps success data", () => {
    expect(successEnvelope({ status: "ok" })).toEqual({
      ok: true,
      data: {
        status: "ok",
      },
    })
  })

  test("wraps typed errors with default details", () => {
    expect(errorEnvelope("not_found", "Route not found")).toEqual({
      ok: false,
      error: {
        code: "not_found",
        message: "Route not found",
        details: {},
      },
    })
  })
})
